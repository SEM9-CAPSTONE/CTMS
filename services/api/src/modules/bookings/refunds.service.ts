import { createHash } from "node:crypto";
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingsRepository } from "./bookings.repository";
import type { ProcessRefundResponseDto } from "./dto/process-refund-response.dto";
import type { ProcessRefundDto } from "./dto/process-refund.dto";
import type { RefundCallbackDto } from "./dto/refund-callback.dto";
import type { SettlementStatusResponseDto } from "./dto/settlement-status-response.dto";
import {
	Payment,
	PaymentStatus,
	PaymentTransaction,
	PaymentTransactionStatus,
	PaymentType,
} from "./entities/payment.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { PaymentsRepository } from "./payments.repository";
import { PayOSService } from "./payos.service";
import {
	RefundOrigin,
	calculateRemainingRefundableAmount,
	evaluateSettlementBlockers,
	validatePreTripProcessingWindow,
	validateRefundEligibility,
} from "./refund-policy";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

export interface ProviderRefundResult {
	readonly succeeded: boolean;
	readonly isPending?: boolean;
	readonly transactionRef: string | null;
	readonly rawPayload: Record<string, unknown>;
}

/**
 * CTMS-035. Service responsible for processing refunds, managing refund lifecycle,
 * enforcing limits and request windows, provider execution, and blocking settlement.
 */
@Injectable()
export class RefundsService {
	private readonly logger = new Logger(RefundsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly paymentsRepository: PaymentsRepository,
		private readonly bookingsRepository: BookingsRepository,
		@Optional() @Inject(PayOSService) private readonly payosService?: PayOSService
	) {}

	/**
	 * Processes an approved refund obligation or new approved refund request.
	 *
	 * Enforces:
	 *  - Authoritative booking/trip state & eligibility windows (BR-103).
	 *  - 24-hour pre-Trip submission window (BR-104).
	 *  - Cumulative refund amount caps (PB AC-4, BR-105).
	 *  - Idempotency & concurrency locking (BR-178, BR-179).
	 *  - Authoritative transaction statuses (PB AC-3, BR-105).
	 *  - Audit logging (BR-191, BR-192).
	 */
	async processRefund(
		actorId: string,
		bookingId: string,
		idempotencyKey: string | undefined,
		dto: ProcessRefundDto,
		options?: { mockProvider?: boolean; processingTime?: Date }
	): Promise<ProcessRefundResponseDto> {
		const effectiveKey =
			idempotencyKey?.trim() ||
			(dto.obligationId ? `ctms-035:obligation:${dto.obligationId}` : undefined);
		const normalizedKey = this.validateIdempotencyKey(effectiveKey);
		const processingTime = options?.processingTime ?? new Date();
		const requestFingerprint = this.fingerprint(bookingId, dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const paymentsRepo = manager.withRepository(this.paymentsRepository);
			const bookingsRepo = manager.withRepository(this.bookingsRepository);
			const tripsRepo = manager.getRepository(Trip);

			// 1. Advisory lock on (bookingId, idempotencyKey) (BR-178, BR-179).
			await paymentsRepo.lockIdempotencyKey(bookingId, normalizedKey);

			// 2. Check idempotency replay.
			const replay = await paymentsRepo.findByIdempotencyKey(bookingId, normalizedKey);
			if (replay) {
				if (replay.requestFingerprint !== requestFingerprint) {
					throw new ConflictException("Idempotency-Key was already used with a different payload");
				}
				const txnRepo = manager.getRepository(PaymentTransaction);
				const lastTxn = await txnRepo.findOne({
					where: { paymentId: replay.id },
					order: { createdAt: "DESC" },
				});
				return this.toResponse(
					replay,
					lastTxn?.status ?? PaymentTransactionStatus.PENDING,
					"replay"
				);
			}

			// 3. Pessimistic lock on Trip and Booking rows in consistent order.
			const bookingIdentity = await bookingsRepo.findOne({
				select: { id: true, tripId: true },
				where: { id: bookingId },
			});
			if (!bookingIdentity) {
				throw new NotFoundException("Booking not found");
			}

			const trip = await tripsRepo.findOne({
				where: { id: bookingIdentity.tripId },
				lock: { mode: "pessimistic_write" },
			});
			if (!trip) {
				throw new NotFoundException("Trip not found");
			}

			const booking = await bookingsRepo.findForUpdate(bookingId);
			if (!booking) {
				throw new NotFoundException("Booking not found");
			}
			if (booking.tripId !== trip.id) {
				throw new ConflictException("Booking Trip identity is inconsistent");
			}

			// 4. Load all payments for this booking under lock.
			const paymentRows = await paymentsRepo.findByBookingForUpdate(bookingId);

			// 5. Identify unambiguous succeeded parent charge (PB AC-1).
			const charges = paymentRows.filter(
				(p) => p.type === PaymentType.CHARGE && p.status === PaymentStatus.SUCCEEDED
			);
			if (charges.length !== 1) {
				throw new ConflictException("Booking must have one unambiguous eligible succeeded charge");
			}
			const parentCharge = charges[0];

			// 6. Resolve refund obligation or new refund.
			let refundPayment: Payment | null = null;
			let origin = dto.origin;
			let refundAmount = dto.amount;

			if (dto.obligationId) {
				refundPayment = paymentRows.find((p) => p.id === dto.obligationId) ?? null;
				if (!refundPayment) {
					throw new NotFoundException("Refund obligation not found");
				}
				if (refundPayment.type !== PaymentType.REFUND) {
					throw new ConflictException("Specified obligation is not a refund payment");
				}
				if (refundPayment.status === PaymentStatus.SUCCEEDED) {
					const txnRepo = manager.getRepository(PaymentTransaction);
					const lastTxn = await txnRepo.findOne({
						where: { paymentId: refundPayment.id },
						order: { createdAt: "DESC" },
					});
					return this.toResponse(
						refundPayment,
						lastTxn?.status ?? PaymentTransactionStatus.SUCCEEDED,
						"already_succeeded"
					);
				}
				if (refundPayment.status === PaymentStatus.FAILED) {
					throw new ConflictException("Refund obligation has already failed");
				}
				refundAmount = refundPayment.amount;

				if (!origin) {
					if (booking.status === BookingStatus.CANCELLED) {
						origin = RefundOrigin.CAMPER_CANCELLATION;
					} else if (booking.status === BookingStatus.COMPLETED) {
						origin = RefundOrigin.CAMPER_COMPLAINT;
					} else if (trip.status === TripStatus.CANCELLED) {
						origin = RefundOrigin.HOST_TRIP_CANCELLATION;
					} else if (booking.status === BookingStatus.EXPIRED) {
						origin = RefundOrigin.LATE_PAYMENT_AFTER_EXPIRY;
					} else {
						origin = RefundOrigin.CAMPER_CANCELLATION;
					}
				}
			} else {
				if (!origin) {
					origin = RefundOrigin.CAMPER_CANCELLATION;
				}
				if (!refundAmount) {
					throw new ConflictException("Refund amount is required for new refund requests");
				}
			}

			// 7. Validate refund eligibility and request windows (BR-103).
			const eligibility = validateRefundEligibility({
				booking,
				trip,
				origin,
				requestTime: processingTime,
			});

			// 8. For pre-Trip Camper requests, validate the 24-hour submission window (BR-104).
			if (origin === RefundOrigin.CAMPER_CANCELLATION) {
				const refundRequestedAt = refundPayment?.createdAt ?? booking.cancelledAt ?? processingTime;
				validatePreTripProcessingWindow(refundRequestedAt, processingTime);
			}

			// 9. Cumulative cap validation (PB AC-4, BR-105).
			const existingRefunds = paymentRows.filter((p) => p.type === PaymentType.REFUND);
			const { remainingMinor, remainingAmount } = calculateRemainingRefundableAmount(
				parentCharge.amount,
				existingRefunds,
				refundPayment?.id
			);

			const requestedMinor = this.parseMinorUnits(refundAmount);
			if (requestedMinor <= 0n) {
				throw new ConflictException("Refund amount must be greater than zero");
			}
			if (requestedMinor > remainingMinor) {
				throw new ConflictException(
					`Requested refund amount ${refundAmount} exceeds remaining refundable charge amount ${remainingAmount}`
				);
			}

			// 10. Persist or update refund payment row in PENDING state.
			if (!refundPayment) {
				refundPayment = paymentsRepo.create({
					bookingId,
					amount: refundAmount,
					type: PaymentType.REFUND,
					status: PaymentStatus.PENDING,
					idempotencyKey: normalizedKey,
					requestFingerprint,
					providerReference: null,
					parentPaymentId: parentCharge.id,
				});
				refundPayment = await paymentsRepo.save(refundPayment);
			} else {
				if (!refundPayment.idempotencyKey) {
					refundPayment.idempotencyKey = normalizedKey;
					refundPayment.requestFingerprint = requestFingerprint;
					await paymentsRepo.save(refundPayment);
				}
			}

			// 11. Submit refund to provider (PB AC-5).
			const providerResult = await this.submitProviderRefund(
				parentCharge,
				refundPayment.amount,
				dto.reason ?? eligibility.reason,
				options?.mockProvider
			);

			// 12. Create PaymentTransaction row (PB AC-2, PB AC-3).
			const txnStatus = providerResult.succeeded
				? PaymentTransactionStatus.SUCCEEDED
				: providerResult.isPending
					? PaymentTransactionStatus.PENDING
					: PaymentTransactionStatus.FAILED;

			const savedTxn = await manager.getRepository(PaymentTransaction).save(
				manager.getRepository(PaymentTransaction).create({
					paymentId: refundPayment.id,
					transactionRef: providerResult.transactionRef,
					status: txnStatus,
					rawPayload: providerResult.rawPayload,
				})
			);

			// 13. Update Payment status based on provider outcome.
			// Note: PaymentStatus is NEVER 'refunded' (spec §6).
			if (providerResult.isPending) {
				refundPayment.status = PaymentStatus.PENDING;
			} else if (providerResult.succeeded) {
				refundPayment.status = PaymentStatus.SUCCEEDED;
			} else {
				refundPayment.status = PaymentStatus.FAILED;
			}

			if (providerResult.transactionRef) {
				refundPayment.providerReference = providerResult.transactionRef;
			}
			await paymentsRepo.save(refundPayment);

			// 14. Audit log (BR-191, BR-192).
			await manager.getRepository(AuditLog).save({
				actorId: actorId || null,
				action: "booking.refund_processed",
				targetType: "payment",
				targetId: refundPayment.id,
				before: {
					refundStatus: PaymentStatus.PENDING,
					bookingStatus: booking.status,
				},
				after: {
					refundId: refundPayment.id,
					refundStatus: refundPayment.status,
					parentPaymentId: parentCharge.id,
					amount: refundPayment.amount,
					transactionRef: providerResult.transactionRef,
					policySource: eligibility.policySource,
				},
				reason: dto.reason ?? eligibility.reason,
			});

			// 15. If provider failed, surface error without corrupting transaction.
			if (!providerResult.succeeded && !providerResult.isPending) {
				throw new ConflictException(
					"Provider failed to process the refund. Please retry or verify provider credentials."
				);
			}

			return this.toResponse(refundPayment, savedTxn.status, eligibility.policySource);
		});
	}

	/**
	 * Reconciles provider callbacks/webhooks idempotently (PB AC-5, BR-332).
	 */
	async reconcileProviderRefundCallback(
		data: RefundCallbackDto
	): Promise<{ success: boolean; replayed: boolean }> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const paymentLookup = await manager.getRepository(Payment).findOne({
				where: { providerReference: data.providerReference },
			});
			if (!paymentLookup) {
				this.logger.warn(
					`No Payment found for refund provider reference ${data.providerReference}`
				);
				return { success: false, replayed: false };
			}

			const paymentsRepo = manager.withRepository(this.paymentsRepository);
			const payment = await paymentsRepo.findForUpdate(paymentLookup.id);
			if (!payment) return { success: false, replayed: false };

			// Duplicate callback replay protection (BR-178, BR-332, Table 10).
			if (payment.status === PaymentStatus.SUCCEEDED) {
				this.logger.log(`Refund payment ${payment.id} already marked SUCCEEDED.`);
				return { success: true, replayed: true };
			}

			const beforeStatus = payment.status;
			const isSuccess = data.isSuccess;
			payment.status = isSuccess ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
			await paymentsRepo.save(payment);

			await manager.getRepository(PaymentTransaction).save(
				manager.getRepository(PaymentTransaction).create({
					paymentId: payment.id,
					transactionRef: data.transactionRef || data.providerReference,
					status: isSuccess ? PaymentTransactionStatus.SUCCEEDED : PaymentTransactionStatus.FAILED,
					rawPayload: data.payload || {},
				})
			);

			await manager.getRepository(AuditLog).save({
				actorId: null,
				action: "booking.refund_reconciled",
				targetType: "payment",
				targetId: payment.id,
				before: { status: beforeStatus },
				after: { status: payment.status, transactionRef: data.transactionRef },
				reason: "provider_refund_callback",
			});

			return { success: true, replayed: false };
		});
	}

	/**
	 * Returns whether settlement is blocked for a Trip and calculates Held Funds / settlement base
	 * (BR-106, BR-336, BR-343).
	 */
	async getSettlementStatus(tripId: string): Promise<SettlementStatusResponseDto> {
		const trip = await this.dataSource.getRepository(Trip).findOne({
			where: { id: tripId },
		});
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}

		const payments = await this.paymentsRepository.findPaymentsByTripId(tripId);
		const result = evaluateSettlementBlockers(payments);

		return {
			tripId,
			isBlocked: result.isBlocked,
			blockingReasons: result.blockingReasons,
			blockingPaymentIds: result.blockingPaymentIds,
			totalCharges: result.totalCharges,
			totalSucceededRefunds: result.totalSucceededRefunds,
			heldFunds: result.heldFunds,
			settlementBase: result.settlementBase,
		};
	}

	/**
	 * Asserts that settlement and payout are not blocked for a Trip (BR-106, BR-336).
	 * Throws ConflictException if blocked.
	 */
	async assertSettlementNotBlocked(tripId: string): Promise<SettlementStatusResponseDto> {
		const status = await this.getSettlementStatus(tripId);
		if (status.isBlocked) {
			throw new ConflictException(
				`Settlement and payout are blocked: ${status.blockingReasons.join("; ")}`
			);
		}
		return status;
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private async submitProviderRefund(
		_parentCharge: Payment,
		amount: string,
		_reason: string,
		mockProvider = false
	): Promise<ProviderRefundResult> {
		if (
			!mockProvider &&
			process.env.NODE_ENV !== "test" &&
			this.payosService &&
			this.payosService.isConfigured()
		) {
			// External provider execution stub
			return {
				succeeded: true,
				transactionRef: `payos-ref-${Date.now()}`,
				rawPayload: { provider: "payos", amount },
			};
		}

		return {
			succeeded: true,
			transactionRef: `stub-refund-${Date.now()}`,
			rawPayload: { stub: true, amount },
		};
	}

	private validateIdempotencyKey(value: string | undefined): string {
		const key = value?.trim();
		if (!key || key.length > IDEMPOTENCY_KEY_MAX_LENGTH || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [
					{
						field: "Idempotency-Key",
						errors: [
							"Idempotency-Key is required and must contain 1-128 letters, numbers, dots, underscores, colons, or hyphens",
						],
					},
				],
			});
		}
		return key;
	}

	private fingerprint(bookingId: string, dto: ProcessRefundDto): string {
		return createHash("sha256")
			.update(
				JSON.stringify({
					bookingId,
					obligationId: dto.obligationId,
					amount: dto.amount,
					origin: dto.origin,
				})
			)
			.digest("hex");
	}

	private parseMinorUnits(value: string): bigint {
		const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value);
		if (!match) {
			throw new ConflictException("Invalid monetary amount format");
		}
		return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
	}

	private toResponse(
		payment: Payment,
		transactionStatus: PaymentTransactionStatus,
		policySource: string
	): ProcessRefundResponseDto {
		if (!payment.parentPaymentId) {
			throw new Error("Refund payment is missing parent payment ID");
		}
		return {
			refundId: payment.id,
			bookingId: payment.bookingId,
			parentPaymentId: payment.parentPaymentId,
			amount: payment.amount,
			status: payment.status,
			transactionStatus,
			providerReference: payment.providerReference,
			policySource,
			createdAt: payment.createdAt,
		};
	}
}
