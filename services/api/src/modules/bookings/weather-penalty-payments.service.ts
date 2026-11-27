import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { WebhookData } from "@payos/node";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { HostWeatherPenaltiesService } from "../trips/weather-decisions/host-weather-penalties.service";
import { moneyToMinor } from "./cancellation-policy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { PayOSService } from "./payos.service";

/** Where PayOS sends the Host back after paying or cancelling. */
const HOST_WALLET_PATH = "/host/wallet";

interface PenaltyPaymentRow {
	id: string;
	penalty_id: string;
	host_id: string;
	order_code: string;
	amount: string;
	status: "pending" | "succeeded" | "cancelled";
	checkout_url: string;
}

export interface WeatherPenaltyCheckout {
	checkoutUrl: string;
	amount: string;
	orderCode: number;
}

/**
 * The Host pays a weather penalty online through PayOS, like a Camper pays a Booking: a payment
 * link for exactly what is still owed, recorded as collected when PayOS reports it paid (webhook,
 * or a status check when the Host opens the wallet). No Admin confirmation is involved.
 */
@Injectable()
export class WeatherPenaltyPaymentsService {
	private readonly logger = new Logger(WeatherPenaltyPaymentsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly payos: PayOSService,
		private readonly penalties: HostWeatherPenaltiesService
	) {}

	/** Opens (or reuses) the PayOS payment link for what the Host still owes on the penalty. */
	async createCheckout(
		hostId: string,
		penaltyId: string,
		now = new Date()
	): Promise<WeatherPenaltyCheckout> {
		if (!this.payos.isConfigured()) {
			throw new ServiceUnavailableException("Online payment is not configured");
		}
		let replaced: number | null = null;
		const checkout = await this.dataSource.transaction(async (manager) => {
			const owed = await this.penalties.lockOutstandingForHost(manager, hostId, penaltyId);
			if (owed === null) throw new NotFoundException("Weather penalty not found");
			if (moneyToMinor(owed) <= 0n) {
				throw new ConflictException("Nothing is left to pay on this weather penalty");
			}
			const pending = await this.findPending(manager, penaltyId);
			if (pending && moneyToMinor(pending.amount) === moneyToMinor(owed)) {
				return this.toCheckout(pending);
			}
			if (pending) {
				// The amount owed changed (a settlement deducted part of it): the old link is void.
				await this.markCancelled(manager, pending.id, now);
				replaced = Number(pending.order_code);
			}
			const orderCode = Number(
				String(Date.now()).slice(-7) + Math.floor(1000 + Math.random() * 9000)
			);
			const link = await this.payos
				.createPaymentLink({
					orderCode,
					amount: Math.round(Number(owed)),
					description: `CTMS PHAT ${orderCode}`,
					returnUrl: this.payos.webAppUrl(`${HOST_WALLET_PATH}?penaltyPayment=return`),
					cancelUrl: this.payos.webAppUrl(`${HOST_WALLET_PATH}?penaltyPayment=cancel`),
				})
				.catch((error: unknown) => {
					this.logger.error("PayOS createPaymentLink failed for a weather penalty", error);
					throw new ServiceUnavailableException("Online payment is temporarily unavailable");
				});
			const rows = (await manager.query(
				`INSERT INTO "weather_penalty_payments"
				   ("penalty_id", "host_id", "order_code", "amount", "checkout_url", "created_at", "updated_at")
				 VALUES ($1, $2, $3, $4::numeric, $5, $6, $6)
				 RETURNING "id", "penalty_id", "host_id", "order_code"::text AS "order_code",
				           "amount"::text AS "amount", "status", "checkout_url"`,
				[penaltyId, hostId, orderCode, owed, link.checkoutUrl, now]
			)) as PenaltyPaymentRow[];
			return this.toCheckout(rows[0]);
		});
		if (replaced !== null) await this.cancelLink(replaced, "Penalty amount changed");
		return checkout;
	}

	/**
	 * Verified PayOS webhook. Returns `false` when the order code is not a weather penalty payment,
	 * so the caller hands it to the Booking payment flow.
	 */
	async handlePayOSWebhook(data: WebhookData, now = new Date()): Promise<boolean> {
		const orderCode = String(data.orderCode);
		return this.dataSource.transaction(async (manager) => {
			const rows = (await manager.query(
				`SELECT "id", "penalty_id", "host_id", "order_code"::text AS "order_code",
				        "amount"::text AS "amount", "status", "checkout_url"
				 FROM "weather_penalty_payments" WHERE "order_code" = $1::bigint FOR UPDATE`,
				[orderCode]
			)) as PenaltyPaymentRow[];
			const payment = rows[0];
			if (!payment) return false;
			if (payment.status === "succeeded" || data.code !== "00") return true;
			await manager.query(
				`UPDATE "weather_penalty_payments"
				 SET "status" = 'succeeded', "paid_at" = $2, "updated_at" = $2 WHERE "id" = $1`,
				[payment.id, now]
			);
			await this.penalties.recordOnlinePayment(manager, {
				hostId: payment.host_id,
				penaltyId: payment.penalty_id,
				amount: payment.amount,
				reference: `PayOS ${orderCode}`,
				now,
			});
			return true;
		});
	}

	/**
	 * Asks PayOS about the Host's links still waiting, because the webhook cannot reach a server
	 * that is not public (local runs). Paid links are recorded, cancelled or expired ones closed.
	 */
	async syncPendingForHost(hostId: string, now = new Date()): Promise<void> {
		if (!this.payos.isConfigured()) return;
		const pending = (await this.dataSource.query(
			`SELECT "id", "order_code"::text AS "order_code" FROM "weather_penalty_payments"
			 WHERE "host_id" = $1 AND "status" = 'pending'`,
			[hostId]
		)) as Array<{ id: string; order_code: string }>;
		for (const payment of pending) {
			const orderCode = Number(payment.order_code);
			try {
				const link = await this.payos.getPaymentLinkInformation(orderCode);
				if (link.status === "PAID") {
					const transaction = link.transactions?.[0];
					await this.handlePayOSWebhook(
						{
							orderCode,
							amount: link.amountPaid || link.amount,
							description: transaction?.description || `CTMS PHAT ${orderCode}`,
							accountNumber: transaction?.accountNumber || "",
							reference: transaction?.reference || String(orderCode),
							transactionDateTime: transaction?.transactionDateTime || link.createdAt,
							currency: "VND",
							paymentLinkId: link.id,
							code: "00",
							desc: "success",
						},
						now
					);
				} else if (link.status === "CANCELLED" || link.status === "EXPIRED") {
					await this.markCancelled(this.dataSource.manager, payment.id, now);
				}
			} catch (error) {
				this.logger.warn(
					`PayOS status check failed for penalty order ${orderCode}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
		}
	}

	private async findPending(
		manager: EntityManager,
		penaltyId: string
	): Promise<PenaltyPaymentRow | null> {
		const rows = (await manager.query(
			`SELECT "id", "penalty_id", "host_id", "order_code"::text AS "order_code",
			        "amount"::text AS "amount", "status", "checkout_url"
			 FROM "weather_penalty_payments" WHERE "penalty_id" = $1 AND "status" = 'pending'
			 FOR UPDATE`,
			[penaltyId]
		)) as PenaltyPaymentRow[];
		return rows[0] ?? null;
	}

	private async markCancelled(manager: EntityManager, id: string, now: Date): Promise<void> {
		await manager.query(
			`UPDATE "weather_penalty_payments" SET "status" = 'cancelled', "updated_at" = $2
			 WHERE "id" = $1 AND "status" = 'pending'`,
			[id, now]
		);
	}

	private async cancelLink(orderCode: number, reason: string): Promise<void> {
		try {
			await this.payos.cancelPaymentLink(orderCode, reason);
		} catch (error) {
			this.logger.warn(
				`Could not cancel PayOS penalty order ${orderCode}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	private toCheckout(row: PenaltyPaymentRow): WeatherPenaltyCheckout {
		return { checkoutUrl: row.checkout_url, amount: row.amount, orderCode: Number(row.order_code) };
	}
}
