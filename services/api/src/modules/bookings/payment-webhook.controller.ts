import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Logger,
	Post,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { PayOSWebhookDto } from "./dto/payos-webhook.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { PaymentsService } from "./payments.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { PayOSService } from "./payos.service";

@ApiTags("Payments")
@Controller("bookings/payment-webhook")
export class PaymentWebhookController {
	private readonly logger = new Logger(PaymentWebhookController.name);

	constructor(
		private readonly payosService: PayOSService,
		private readonly paymentsService: PaymentsService
	) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Handle real-time payment webhook from PayOS" })
	@ApiResponse({ status: 200, description: "Webhook verified and processed successfully" })
	@ApiResponse({ status: 400, description: "Invalid webhook signature or data" })
	async handleWebhook(@Body() dto: PayOSWebhookDto): Promise<{ success: boolean }> {
		if (!this.payosService.isConfigured()) {
			this.logger.warn("Received PayOS webhook but PayOS is not configured.");
			return { success: true };
		}

		try {
			const verifiedData = await this.payosService.verifyWebhook(dto);
			this.logger.log(`PayOS webhook verified for orderCode: ${verifiedData.orderCode}`);
			await this.paymentsService.handlePayOSWebhook(verifiedData);
			return { success: true };
		} catch (error) {
			this.logger.error(
				`Webhook verification failed: ${error instanceof Error ? error.message : String(error)}`
			);
			throw new BadRequestException("Invalid webhook signature or data");
		}
	}
}
