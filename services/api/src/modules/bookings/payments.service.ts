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
import type { WebhookData } from "@payos/node";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import {
	type Booking,
	BookingPaymentStatus,
	BookingStatus,
} from "../profiles/entities/booking.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsRepository } from "./bookings.repository";
import type { PayBookingResponseDto } from "./dto/pay-booking-response.dto";
import type { PayBookingDto } from "./dto/pay-booking.dto";
import {
	Payment,
	PaymentStatus,
	PaymentTransaction,
	PaymentTransactionStatus,
	PaymentType,
} from "./entities/payment.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { PaymentsRepository } from "./payments.repository";
import { PayOSService } from "./payos.service";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

/**
 * Describes the result contract returned by the internal provider port stub.
 * Extracted as an interface so a real adapter can be dropped in later without
 * touching service logic (BR-197, BR-198).
 */
interface ProviderChargeResult {
	readonly succeeded: boolean;
	readonly isPending?: boolean;
	readonly transactionRef: string | null;
	readonly rawPayload: Record<string, unknown>;
	readonly checkoutUrl?: string | null;
	readonly qrCode?: string | null;
}

/**
 * CTMS-032-T01. Service responsible for the `Pay for Booking` workflow.
 *
 * Design constraints (all BR references from CTMS-032 spec §5.4):
 * - Every state-changing operation runs inside a single `dataSource.transaction()`
 *   call so partial failures roll back atomically (BR-176, BR-177).
 * - The Booking row is pessimistically locked before any mutation so concurrent
 *   pay requests are serialised (BR-179).
 * - An advisory lock on (bookingId, idempotencyKey) serialises duplicate
 *   submissions before the replay check so only one charge is ever created
 *   (BR-178, BR-209).
 * - The Booking state is only transitioned to CONFIRMED/PAID after the provider
 *   returns `succeeded`; a provider timeout or error leaves the Payment as
 *   `failed` and the Booking unchanged (BR-197).
 * - All amounts are computed server-side from `Booking.totalAmount`; no
 *   client-supplied amount is trusted (BR-175).
 */
@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);

	constructor(
		private readonly paymentsRepository: PaymentsRepository,
		private readonly bookingsRepository: BookingsRepository,
		private readonly dataSource: DataSource,
		@Optional() @Inject(PayOSService) private readonly payosService?: PayOSService
	) {}

	/**
	 * Charges the authoritative `Booking.totalAmount` for the given Booking.
	 *
	 * Pre-conditions (enforced before any write):
	 *   - Caller is authenticated (enforced by `JwtAuthGuard` in controller).
	 *   - Caller is the Booking owner (BR-172, BR-211).
	 *   - Booking exists and is in `PENDING_PAYMENT` / `UNPAID` state (BR-091).
	 *   - Idempotency-Key is valid and unique per (bookingId) scope (BR-090).
	 *
	 * Post-conditions on success:
	 *   - One `Payment` row with `status = succeeded` persisted.
	 *   - One `PaymentTransaction` row capturing provider result.
	 *   - `Booking.status` transitioned to `CONFIRMED`.
	 *   - `Booking.paymentStatus` transitioned to `PAID`.
	 *   - One `AuditLog` row recorded (BR-210).
	 *
	 * On provider failure:
	 *   - Payment row persisted with `status = failed`.
	 *   - Booking state unchanged.
	 *   - Caller receives an actionable error (BR-225).
	 */
	async pay(
		actorId: string,
		bookingId: string,
		idempotencyKey: string | undefined,
		dto: PayBookingDto,
		options?: { mockProvider?: boolean }
	): Promise<PayBookingResponseDto> {
		const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
		const requestFingerprint = this.fingerprint(bookingId, dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const paymentsRepository = manager.withRepository(this.paymentsRepository);

			// 1. Acquire advisory lock to serialise concurrent requests with the same
			//    (bookingId, idempotencyKey) before touching any rows (BR-178, BR-179).
			await paymentsRepository.lockIdempotencyKey(bookingId, normalizedKey);

			// 2. Idempotency replay — return the existing Payment without re-charging
			//    if this key was already used with the same payload (BR-178).
			const replay = await paymentsRepository.findByIdempotencyKey(bookingId, normalizedKey);
			if (replay) {
				if (replay.requestFingerprint !== requestFingerprint) {
					throw new ConflictException("Idempotency-Key was already used with a different payload");
				}
				const replayedBooking = await manager
					.withRepository(this.bookingsRepository)
					.findOneBy({ id: bookingId });
				if (!replayedBooking) throw new NotFoundException("Booking not found");
				const txnRepo = manager.getRepository(PaymentTransaction);
				const lastTxn =
					typeof txnRepo.findOne === "function"
						? await txnRepo.findOne({
								where: { paymentId: replay.id },
								order: { createdAt: "DESC" },
							})
						: null;
				const checkoutUrl =
					typeof lastTxn?.rawPayload?.checkoutUrl === "string"
						? lastTxn.rawPayload.checkoutUrl
						: null;
				const qrCode =
					typeof lastTxn?.rawPayload?.qrCode === "string" ? lastTxn.rawPayload.qrCode : null;
				return this.toResponse(replay, replayedBooking, { checkoutUrl, qrCode });
			}

			// 3. Pessimistic lock on the Booking row to prevent concurrent state
			//    mutations (BR-179).
			const bookingRepository = manager.withRepository(this.bookingsRepository);
			const booking = await bookingRepository.findForUpdate(bookingId);
			if (!booking) throw new NotFoundException("Booking not found");

			// 4. Ownership check — only the Booking owner may pay (BR-172, BR-211).
			if (booking.userId !== actorId) {
				throw new ForbiddenException("Only the Booking owner can pay for this Booking");
			}

			// 5. State guard — Booking must be payable (BR-091, BR-211).
			this.assertBookingPayable(booking);

			// 6. Server-authoritative amount snapshot (BR-175).
			// Charges the trip booking amount (basePrice), excluding separate equipment rental fees.
			const amount = booking.basePrice ?? booking.totalAmount;
			if (amount === null) {
				throw new Error("Booking is missing its total amount");
			}

			// 7. Persist the Payment in `pending` state before the provider call
			//    so a provider crash leaves an auditable record (BR-197).
			const payment = paymentsRepository.create({
				bookingId,
				amount,
				type: PaymentType.CHARGE,
				status: PaymentStatus.PENDING,
				idempotencyKey: normalizedKey,
				requestFingerprint,
				providerReference: null,
				parentPaymentId: null,
			});
			const savedPayment = await paymentsRepository.save(payment);

			// 8. Call the provider (PayOS when configured or fallback stub).
			const chargeResult = await this.chargeViaProvider(
				bookingId,
				amount,
				dto.method,
				options?.mockProvider
			);

			// 9. Persist the transaction record (one row per provider callback — BR-092).
			await manager.getRepository(PaymentTransaction).save(
				manager.getRepository(PaymentTransaction).create({
					paymentId: savedPayment.id,
					transactionRef: chargeResult.transactionRef,
					status: chargeResult.succeeded
						? PaymentTransactionStatus.SUCCEEDED
						: PaymentTransactionStatus.FAILED,
					rawPayload: chargeResult.rawPayload,
				})
			);

			// 10. Update Payment status based on provider outcome.
			if (chargeResult.isPending) {
				savedPayment.status = PaymentStatus.PENDING;
			} else {
				savedPayment.status = chargeResult.succeeded
					? PaymentStatus.SUCCEEDED
					: PaymentStatus.FAILED;
			}
			if (chargeResult.transactionRef) {
				savedPayment.providerReference = chargeResult.transactionRef;
			}
			await paymentsRepository.save(savedPayment);

			// 11. Transition Booking only on a confirmed charge (BR-091, BR-176, BR-177).
			if (chargeResult.succeeded && !chargeResult.isPending) {
				booking.status = BookingStatus.CONFIRMED;
				booking.paymentStatus = BookingPaymentStatus.PAID;
				await bookingRepository.save(booking);
			}

			// 12. Audit log (always written, regardless of charge outcome — BR-210).
			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.payment_charge",
				targetType: "payment",
				targetId: savedPayment.id,
				before: {
					bookingStatus: BookingStatus.PENDING_PAYMENT,
					bookingPaymentStatus: BookingPaymentStatus.UNPAID,
				},
				after: {
					paymentId: savedPayment.id,
					paymentStatus: savedPayment.status,
					bookingStatus: booking.status,
					bookingPaymentStatus: booking.paymentStatus,
					amount,
					method: dto.method,
					transactionRef: chargeResult.transactionRef,
				},
				reason: chargeResult.isPending
					? "camper_pay_booking_link_created"
					: chargeResult.succeeded
						? "camper_pay_booking_succeeded"
						: "camper_pay_booking_failed",
			});

			// 13. Surface actionable failure to caller without leaking internals (BR-200, BR-225).
			if (!chargeResult.succeeded && !chargeResult.isPending) {
				throw new ConflictException(
					"Payment charge failed. Please retry or contact support if the problem persists."
				);
			}

			return this.toResponse(savedPayment, booking, {
				checkoutUrl: chargeResult.checkoutUrl,
				qrCode: chargeResult.qrCode,
			});
		});
	}

	/**
	 * Handles a verified PayOS webhook callback to mark a Payment as succeeded
	 * and record the associated Booking as paid without restoring cancelled participation.
	 */
	async handlePayOSWebhook(data: WebhookData): Promise<void> {
		const orderCodeStr = String(data.orderCode);
		await this.dataSource.transaction(async (manager: EntityManager) => {
			const paymentLookup = await manager.getRepository(Payment).findOne({
				where: { providerReference: orderCodeStr },
			});
			if (!paymentLookup) {
				this.logger.warn(`No payment found for PayOS orderCode ${orderCodeStr}`);
				return;
			}
			// Match Booking mutations' lock order, then reload the Payment under lock
			// so concurrent callbacks cannot both apply the same successful charge.
			const bookingRepository = manager.withRepository(this.bookingsRepository);
			const booking = await bookingRepository.findForUpdate(paymentLookup.bookingId);
			const paymentsRepository = manager.withRepository(this.paymentsRepository);
			const payment = await paymentsRepository.findForUpdate(paymentLookup.id);
			if (!payment) return;
			if (payment.status === PaymentStatus.SUCCEEDED) {
				this.logger.log(`Payment ${payment.id} already marked SUCCEEDED.`);
				return;
			}

			const before = {
				paymentStatus: payment.status,
				bookingStatus: booking?.status ?? null,
				bookingPaymentStatus: booking?.paymentStatus ?? null,
			};
			const isSuccess = data.code === "00";
			payment.status = isSuccess ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
			await paymentsRepository.save(payment);

			await manager.getRepository(PaymentTransaction).save(
				manager.getRepository(PaymentTransaction).create({
					paymentId: payment.id,
					transactionRef: data.reference || orderCodeStr,
					status: isSuccess ? PaymentTransactionStatus.SUCCEEDED : PaymentTransactionStatus.FAILED,
					rawPayload: data as unknown as Record<string, unknown>,
				})
			);

			if (booking && isSuccess) {
				if (booking.status !== BookingStatus.CANCELLED) {
					booking.status = BookingStatus.CONFIRMED;
				}
				booking.paymentStatus = BookingPaymentStatus.PAID;
				await bookingRepository.save(booking);

				await manager.getRepository(AuditLog).save({
					actorId: booking.userId,
					action: "booking.payment_received",
					targetType: "payment",
					targetId: payment.id,
					before,
					after: {
						paymentId: payment.id,
						paymentStatus: payment.status,
						bookingStatus: booking.status,
						bookingPaymentStatus: booking.paymentStatus,
						amount: data.amount,
						orderCode: data.orderCode,
						reference: data.reference,
					},
					reason: "payos_webhook_confirmed",
				});
				this.logger.log(
					`Payment received for Booking ${booking.id}; status remains ${booking.status}.`
				);
			}
		});
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Provider charge handler.
	 * When PayOS is configured and not in test environment, generates a real
	 * PayOS payment link and QR code. Otherwise falls back to the synthetic stub.
	 */
	private async chargeViaProvider(
		bookingId: string,
		amount: string,
		_method: string,
		mockProvider = false
	): Promise<ProviderChargeResult> {
		if (
			!mockProvider &&
			process.env.NODE_ENV !== "test" &&
			this.payosService &&
			this.payosService.isConfigured()
		) {
			try {
				const orderCode = Number(
					String(Date.now()).slice(-7) + Math.floor(1000 + Math.random() * 9000)
				);
				const numericAmount = Math.round(Number(amount));
				const paymentLink = await this.payosService.createPaymentLink({
					orderCode,
					amount: numericAmount,
					description: `CTMS ${bookingId.slice(0, 8)}`,
				});
				return {
					succeeded: true,
					isPending: true,
					transactionRef: String(orderCode),
					rawPayload: paymentLink as unknown as Record<string, unknown>,
					checkoutUrl: paymentLink.checkoutUrl,
					qrCode: paymentLink.qrCode,
				};
			} catch (error) {
				this.logger.error("PayOS createPaymentLink failed", error);
				throw new ConflictException(
					`Không thể tạo giao dịch thanh toán PayOS: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		return {
			succeeded: true,
			transactionRef: `stub-${Date.now()}`,
			rawPayload: { stub: true },
		};
	}

	/**
	 * Guards that the Booking is in the correct state to accept a charge.
	 * Only `PENDING_PAYMENT` bookings with `UNPAID` payment status are payable
	 * (BR-091, BR-211).
	 */
	private assertBookingPayable(booking: Booking): void {
		if (
			booking.status !== BookingStatus.PENDING_PAYMENT ||
			booking.paymentStatus !== BookingPaymentStatus.UNPAID
		) {
			const reason = this.describeNonPayableBooking(booking);
			throw new ConflictException(reason);
		}
	}

	private describeNonPayableBooking(booking: Booking): string {
		switch (booking.status) {
			case BookingStatus.CONFIRMED:
				return "Booking has already been paid and confirmed";
			case BookingStatus.CANCELLED:
				return "Booking has been cancelled and cannot be paid";
			case BookingStatus.EXPIRED:
				return "Booking has expired and cannot be paid";
			case BookingStatus.COMPLETED:
				return "Booking is completed and cannot be re-paid";
			default:
				return "Booking is not in a payable state";
		}
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

	private fingerprint(bookingId: string, dto: PayBookingDto): string {
		return createHash("sha256")
			.update(JSON.stringify({ bookingId, type: PaymentType.CHARGE, method: dto.method }))
			.digest("hex");
	}

	private toResponse(
		payment: Payment,
		booking: Booking,
		extra?: { checkoutUrl?: string | null; qrCode?: string | null }
	): PayBookingResponseDto {
		if (booking.status === null || booking.paymentStatus === null) {
			throw new Error("Booking is missing required status fields");
		}
		return {
			paymentId: payment.id,
			bookingId: payment.bookingId,
			paymentStatus: payment.status,
			amount: payment.amount,
			bookingStatus: booking.status,
			bookingPaymentStatus: booking.paymentStatus,
			createdAt: payment.createdAt,
			checkoutUrl: extra?.checkoutUrl ?? null,
			qrCode: extra?.qrCode ?? null,
		};
	}
}
