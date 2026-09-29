import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { ConfigService } from "@nestjs/config";
import { PayOS } from "@payos/node";
import type { CreatePaymentLinkResponse, Webhook, WebhookData } from "@payos/node";

@Injectable()
export class PayOSService {
	private readonly logger = new Logger(PayOSService.name);
	private readonly client: PayOS | null = null;
	private readonly returnUrl: string;
	private readonly cancelUrl: string;

	constructor(private readonly configService: ConfigService) {
		const clientId =
			this.configService.get<string>("PAYOS_CLIENT_ID") || process.env.PAYOS_CLIENT_ID;
		const apiKey = this.configService.get<string>("PAYOS_API_KEY") || process.env.PAYOS_API_KEY;
		const checksumKey =
			this.configService.get<string>("PAYOS_CHECKSUM_KEY") || process.env.PAYOS_CHECKSUM_KEY;

		this.returnUrl =
			this.configService.get<string>("PAYOS_RETURN_URL") ||
			process.env.PAYOS_RETURN_URL ||
			"http://localhost:5173/trips";
		this.cancelUrl =
			this.configService.get<string>("PAYOS_CANCEL_URL") ||
			process.env.PAYOS_CANCEL_URL ||
			"http://localhost:5173/trips";

		if (clientId && apiKey && checksumKey) {
			this.client = new PayOS({ clientId, apiKey, checksumKey });
			this.logger.log("PayOS client initialized successfully.");
		} else {
			this.logger.warn("PayOS credentials not configured; running in fallback mode.");
		}
	}

	isConfigured(): boolean {
		return this.client !== null;
	}

	async createPaymentLink(params: {
		orderCode: number;
		amount: number;
		description: string;
		returnUrl?: string;
		cancelUrl?: string;
	}): Promise<CreatePaymentLinkResponse> {
		if (!this.client) {
			throw new Error("PayOS client is not configured.");
		}
		return this.client.paymentRequests.create({
			orderCode: params.orderCode,
			amount: params.amount,
			description: params.description,
			returnUrl: params.returnUrl || this.returnUrl,
			cancelUrl: params.cancelUrl || this.cancelUrl,
		});
	}

	async verifyWebhook(body: Webhook): Promise<WebhookData> {
		if (!this.client) {
			throw new Error("PayOS client is not configured.");
		}
		return this.client.webhooks.verify(body);
	}
}
