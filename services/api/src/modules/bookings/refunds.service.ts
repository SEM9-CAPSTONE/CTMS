import { createHash } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
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
import { AUTO_CANCEL_REASON } from "../trips/services/trip-auto-cancel.service";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingsRepository } from "./bookings.repository";
import { minorToMoney } from "./cancellation-policy";
import type {
	AdminRefundItemResponseDto,
	AdminRefundListResponseDto,
} from "./dto/admin-refund-item-response.dto";
import type { AdminRefundListQueryDto } from "./dto/admin-refund-list-query.dto";
import type {
	BookingRefundApplicableWindowDto,
	BookingRefundInfoResponseDto,
	BookingRefundItemDto,
} from "./dto/booking-refund-info-response.dto";
import type { ConfirmManualRefundDto } from "./dto/confirm-manual-refund.dto";
import type { ProcessRefundResponseDto } from "./dto/process-refund-response.dto";
import type { ProcessRefundDto } from "./dto/process-refund.dto";
import type { RefundCallbackDto } from "./dto/refund-callback.dto";
import type { RejectRefundDto } from "./dto/reject-refund.dto";
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
		options?: { mockProvider?: boolean; processingTime?: Date; userRoles?: string[] }
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

			// Check ownership if caller is not an admin
			if (
				options?.userRoles &&
				!options.userRoles.includes(UserRole.ADMIN) &&
				booking.userId !== actorId
			) {
				throw new ForbiddenException(
					"Only the booking owner or an admin can request or process a refund"
				);
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
					if (booking.status === BookingStatus.COMPLETED) {
						origin = RefundOrigin.CAMPER_COMPLAINT;
					} else {
						origin = RefundOrigin.CAMPER_CANCELLATION;
					}
				}
				if (!refundAmount) {
					const existingRefunds = paymentRows.filter((p) => p.type === PaymentType.REFUND);
					const { remainingAmount } = calculateRemainingRefundableAmount(
						parentCharge.amount,
						existingRefunds
					);
					refundAmount = remainingAmount;
				}
				if (!refundAmount || refundAmount === "0.00") {
					throw new ConflictException("Refund amount must be greater than zero");
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

			// 11. Determine execution mode (Manual Bank Transfer vs Auto Provider)
			const isCamperRequest =
				Boolean(options?.userRoles && !options.userRoles.includes(UserRole.ADMIN)) ||
				Boolean(dto.bankName || dto.accountNumber);

			let providerResult: ProviderRefundResult;
			let txnStatus: PaymentTransactionStatus;

			if (isCamperRequest) {
				providerResult = {
					succeeded: false,
					isPending: true,
					transactionRef: null,
					rawPayload: {
						bankName: dto.bankName ?? null,
						accountNumber: dto.accountNumber ?? null,
						accountHolderName: dto.accountHolderName ?? null,
						reason: dto.reason ?? eligibility.reason,
						origin,
						manualTransfer: true,
					},
				};
				txnStatus = PaymentTransactionStatus.PENDING;
			} else {
				providerResult = await this.submitProviderRefund(
					parentCharge,
					refundPayment.amount,
					dto.reason ?? eligibility.reason,
					options?.mockProvider
				);
				txnStatus = providerResult.succeeded
					? PaymentTransactionStatus.SUCCEEDED
					: providerResult.isPending
						? PaymentTransactionStatus.PENDING
						: PaymentTransactionStatus.FAILED;
			}

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

	async getBookingRefundInfo(
		actorId: string,
		actorRoles: string[],
		bookingId: string
	): Promise<BookingRefundInfoResponseDto> {
		const booking = await this.bookingsRepository.findOne({
			where: { id: bookingId },
		});
		if (!booking) {
			throw new NotFoundException("Booking not found");
		}

		if (!actorRoles.includes(UserRole.ADMIN) && booking.userId !== actorId) {
			throw new ForbiddenException("Only the booking owner or an admin can view refund details");
		}

		const trip = await this.dataSource.getRepository(Trip).findOne({
			where: { id: booking.tripId },
		});
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}

		const payments = await this.paymentsRepository.find({
			where: { bookingId },
			order: { createdAt: "DESC" },
		});

		const charges = payments.filter(
			(p) => p.type === PaymentType.CHARGE && p.status === PaymentStatus.SUCCEEDED
		);
		const parentCharge = charges[0] ?? null;

		const refundPayments = payments.filter((p) => p.type === PaymentType.REFUND);

		const { committedMinor, remainingAmount } = parentCharge
			? calculateRemainingRefundableAmount(parentCharge.amount, refundPayments)
			: { committedMinor: 0n, remainingAmount: "0.00" };
		const totalRefundedAmount = minorToMoney(committedMinor);

		// CTMS-179: when the Trip itself is cancelled, the Booking's own `cancelled`
		// status is a SIDE EFFECT of that (via cancelTripWithCommitments, shared by
		// CTMS-027's Host-cancel and CTMS-036's auto-cancel) -- it must be checked
		// before the generic Camper-cancellation fallback below, or every
		// Trip-cancellation-caused refund would be mislabeled as the Camper's own
		// cancellation. `cancellationReason` distinguishes the automated worker
		// (CTMS-036) from a Host's own free-text reason (CTMS-027).
		let determinedOrigin: RefundOrigin | undefined;
		if (booking.status === BookingStatus.COMPLETED) {
			determinedOrigin = RefundOrigin.CAMPER_COMPLAINT;
		} else if (trip.status === TripStatus.CANCELLED) {
			determinedOrigin =
				trip.cancellationReason === AUTO_CANCEL_REASON
					? RefundOrigin.SYSTEM_TRIP_CANCELLATION
					: RefundOrigin.HOST_TRIP_CANCELLATION;
		} else if (booking.status === BookingStatus.CANCELLED) {
			determinedOrigin = RefundOrigin.CAMPER_CANCELLATION;
		}

		const now = new Date();
		let isEligible = false;
		let ineligibleReason: string | undefined;
		let policySource: string | undefined;

		if (determinedOrigin && parentCharge) {
			try {
				const eligibility = validateRefundEligibility({
					booking,
					trip,
					origin: determinedOrigin,
					requestTime: now,
				});
				isEligible = eligibility.eligible;
				policySource = eligibility.policySource;
			} catch (err) {
				isEligible = false;
				ineligibleReason = err instanceof Error ? err.message : "Not eligible for refund";
			}
		} else if (!parentCharge) {
			ineligibleReason = "No succeeded charge found to refund";
		} else {
			ineligibleReason = "Booking state is not eligible for refund request";
		}

		let applicableWindow: BookingRefundApplicableWindowDto | undefined;
		if (determinedOrigin === RefundOrigin.CAMPER_COMPLAINT) {
			const completedAt =
				(trip as unknown as { completedAt?: Date }).completedAt ??
				trip.endsAt ??
				booking.tripEndsAtSnapshot;
			const deadline = completedAt
				? new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
				: undefined;
			applicableWindow = {
				startsAt: completedAt ?? undefined,
				endsAt: deadline,
				deadline,
				isExpired: deadline ? now.getTime() > deadline.getTime() : false,
				description: "Trong vòng 24 giờ kể từ khi hoàn thành chuyến đi",
			};
		} else if (determinedOrigin === RefundOrigin.CAMPER_CANCELLATION) {
			const tripStartsAt = booking.tripStartsAtSnapshot ?? trip.startsAt;
			applicableWindow = {
				startsAt: booking.createdAt,
				endsAt: tripStartsAt ?? undefined,
				deadline: tripStartsAt ?? undefined,
				isExpired: tripStartsAt ? now.getTime() >= tripStartsAt.getTime() : false,
				description: "Trước thời điểm bắt đầu chuyến đi",
			};
		}

		const hasPendingRefund = refundPayments.some((r) => r.status === PaymentStatus.PENDING);
		const settlementStatus = await this.getSettlementStatus(trip.id);

		const refundTxns =
			refundPayments.length > 0
				? await this.dataSource.getRepository(PaymentTransaction).find({
						where: refundPayments.map((r) => ({ paymentId: r.id })),
						order: { createdAt: "DESC" },
					})
				: [];

		const refundItems: BookingRefundItemDto[] = refundPayments.map((r) => {
			const txns = refundTxns.filter((t) => t.paymentId === r.id);
			const firstTxn = txns[txns.length - 1];
			const latestTxn = txns[0];
			const firstPayload = (firstTxn?.rawPayload || {}) as Record<string, unknown>;
			const latestPayload = (latestTxn?.rawPayload || {}) as Record<string, unknown>;

			return {
				id: r.id,
				amount: r.amount,
				status: r.status,
				providerReference: r.providerReference ?? null,
				failureReason:
					r.status === PaymentStatus.FAILED
						? (latestPayload.rejectionReason as string) || "Yêu cầu bị từ chối"
						: null,
				bankName: (firstPayload.bankName as string) ?? null,
				accountNumber: (firstPayload.accountNumber as string) ?? null,
				accountHolderName: (firstPayload.accountHolderName as string) ?? null,
				reason: (firstPayload.reason as string) ?? null,
				note: (latestPayload.note as string) ?? null,
				createdAt: r.createdAt,
			};
		});

		return {
			bookingId: booking.id,
			isEligible,
			ineligibleReason,
			origin: determinedOrigin,
			policySource,
			applicableWindow,
			chargeAmount: parentCharge?.amount,
			totalRefundedAmount,
			remainingRefundableAmount: remainingAmount,
			refunds: refundItems,
			settlementBlocked: settlementStatus.isBlocked || hasPendingRefund,
			awaitingResolution: hasPendingRefund,
		};
	}

	/**
	 * Lists all refund obligations for Admin management (CTMS-035).
	 */
	async listAdminRefunds(query: AdminRefundListQueryDto): Promise<AdminRefundListResponseDto> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const skip = (page - 1) * limit;

		const qb = this.paymentsRepository
			.createQueryBuilder("payment")
			.innerJoinAndSelect("payment.booking", "booking")
			.leftJoinAndSelect("booking.user", "user")
			.leftJoinAndSelect("booking.trip", "trip")
			.leftJoinAndSelect("payment.transactions", "transaction")
			.where("payment.type = :type", { type: PaymentType.REFUND })
			.orderBy("payment.createdAt", "DESC")
			.addOrderBy("transaction.createdAt", "DESC");

		if (query.status) {
			qb.andWhere("payment.status = :status", { status: query.status });
		}

		if (query.search?.trim()) {
			const term = `%${query.search.trim().toLowerCase()}%`;
			qb.andWhere(
				"(LOWER(user.full_name) LIKE :term OR LOWER(user.email) LIKE :term OR CAST(payment.bookingId AS text) LIKE :term OR LOWER(payment.providerReference) LIKE :term)",
				{ term }
			);
		}

		const [payments, total] = await qb.skip(skip).take(limit).getManyAndCount();

		const items: AdminRefundItemResponseDto[] = payments.map((p) => {
			const txns = p.transactions || [];
			const origTxn = txns[txns.length - 1];
			const latestTxn = txns[0];
			const origPayload = (origTxn?.rawPayload || {}) as Record<string, unknown>;
			const latestPayload = (latestTxn?.rawPayload || {}) as Record<string, unknown>;

			return {
				id: p.id,
				bookingId: p.bookingId,
				tripTitle: p.booking?.trip?.title,
				camper: {
					id: p.booking?.user?.id ?? "",
					fullName: p.booking?.user?.fullName ?? "Camper",
					email: p.booking?.user?.email ?? null,
					phone: p.booking?.user?.phone ?? null,
				},
				amount: p.amount,
				status: p.status,
				transactionStatus: latestTxn?.status,
				providerReference: p.providerReference,
				reason: (origPayload.reason as string) ?? null,
				rejectionReason: (latestPayload.rejectionReason as string) ?? null,
				note: (latestPayload.note as string) ?? null,
				beneficiary: {
					bankName: (origPayload.bankName as string) ?? null,
					accountNumber: (origPayload.accountNumber as string) ?? null,
					accountHolderName: (origPayload.accountHolderName as string) ?? null,
				},
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
			};
		});

		return {
			items,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit) || 1,
		};
	}

	/**
	 * Admin confirms manual bank transfer for a refund obligation (CTMS-035).
	 */
	async confirmManualRefund(
		actorId: string,
		obligationId: string,
		dto: ConfirmManualRefundDto
	): Promise<ProcessRefundResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const paymentsRepo = manager.withRepository(this.paymentsRepository);
			const refund = await paymentsRepo.findForUpdate(obligationId);
			if (!refund) {
				throw new NotFoundException("Refund payment obligation not found");
			}
			if (refund.type !== PaymentType.REFUND) {
				throw new ConflictException("Payment is not a refund obligation");
			}
			if (refund.status === PaymentStatus.SUCCEEDED) {
				throw new ConflictException("Refund has already been confirmed");
			}
			if (refund.status === PaymentStatus.FAILED) {
				throw new ConflictException("Refund has already failed or been rejected");
			}

			const beforeStatus = refund.status;
			refund.status = PaymentStatus.SUCCEEDED;
			refund.providerReference = dto.transactionRef;
			await paymentsRepo.save(refund);

			const txn = await manager.getRepository(PaymentTransaction).save(
				manager.getRepository(PaymentTransaction).create({
					paymentId: refund.id,
					transactionRef: dto.transactionRef,
					status: PaymentTransactionStatus.SUCCEEDED,
					rawPayload: {
						adminConfirmedBy: actorId,
						note: dto.note ?? null,
						confirmedAt: new Date().toISOString(),
					},
				})
			);

			await manager.getRepository(AuditLog).save({
				actorId: actorId || null,
				action: "booking.refund_confirmed",
				targetType: "payment",
				targetId: refund.id,
				before: { status: beforeStatus },
				after: {
					status: PaymentStatus.SUCCEEDED,
					transactionRef: dto.transactionRef,
					note: dto.note,
				},
				reason: dto.note ?? "Admin manual bank transfer confirmation",
			});

			return this.toResponse(refund, txn.status, "admin_manual_transfer");
		});
	}

	/**
	 * Admin rejects a refund request (CTMS-035).
	 */
	async rejectRefund(
		actorId: string,
		obligationId: string,
		dto: RejectRefundDto
	): Promise<ProcessRefundResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const paymentsRepo = manager.withRepository(this.paymentsRepository);
			const refund = await paymentsRepo.findForUpdate(obligationId);
			if (!refund) {
				throw new NotFoundException("Refund payment obligation not found");
			}
			if (refund.type !== PaymentType.REFUND) {
				throw new ConflictException("Payment is not a refund obligation");
			}
			if (refund.status === PaymentStatus.SUCCEEDED) {
				throw new ConflictException("Cannot reject an already succeeded refund");
			}
			if (refund.status === PaymentStatus.FAILED) {
				throw new ConflictException("Refund has already been rejected or failed");
			}

			const beforeStatus = refund.status;
			refund.status = PaymentStatus.FAILED;
			await paymentsRepo.save(refund);

			const txn = await manager.getRepository(PaymentTransaction).save(
				manager.getRepository(PaymentTransaction).create({
					paymentId: refund.id,
					status: PaymentTransactionStatus.FAILED,
					rawPayload: {
						adminRejectedBy: actorId,
						rejectionReason: dto.rejectionReason,
						rejectedAt: new Date().toISOString(),
					},
				})
			);

			await manager.getRepository(AuditLog).save({
				actorId: actorId || null,
				action: "booking.refund_rejected",
				targetType: "payment",
				targetId: refund.id,
				before: { status: beforeStatus },
				after: {
					status: PaymentStatus.FAILED,
					rejectionReason: dto.rejectionReason,
				},
				reason: dto.rejectionReason,
			});

			return this.toResponse(refund, txn.status, "admin_rejection");
		});
	}
}
