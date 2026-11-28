import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { ConfigService } from "@nestjs/config";
import { type Transporter, createTransport } from "nodemailer";

export interface SendBookingInvitationEmailInput {
	to: string;
	inviterName: string;
	tripTitle: string;
	tripStartsAt: Date;
	inviteUrl: string;
	hasAccount: boolean;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

@Injectable()
export class BookingMemberInvitationEmailService {
	private readonly logger = new Logger(BookingMemberInvitationEmailService.name);
	private transporter: Transporter | null = null;

	constructor(private readonly configService: ConfigService) {}

	buildInviteUrl(token: string): string | null {
		const rawBaseUrl =
			this.configService.get<string>("WEB_APP_URL") ??
			this.configService.get<string>("FRONTEND_URL") ??
			this.configService.get<string>("CORS_ORIGIN")?.split(",")[0];
		const baseUrl = rawBaseUrl?.trim().replace(/\/+$/, "");
		if (!baseUrl) return null;
		return `${baseUrl}/invitations/${token}`;
	}

	private getTransporter(): Transporter | null {
		const host = this.configService.get<string>("SMTP_HOST")?.trim();
		if (!host) return null;
		if (!this.transporter) {
			this.transporter = createTransport({
				host,
				port: Number(this.configService.get<string>("SMTP_PORT") ?? "587"),
				secure: this.configService.get<string>("SMTP_SECURE") === "true",
				auth: {
					user: this.configService.get<string>("SMTP_USER"),
					pass: this.configService.get<string>("SMTP_PASSWORD"),
				},
			});
		}
		return this.transporter;
	}

	async trySendInvitation(input: SendBookingInvitationEmailInput): Promise<boolean> {
		const transporter = this.getTransporter();
		const fromEmail = this.configService.get<string>("SMTP_FROM_EMAIL")?.trim();
		if (!transporter || !fromEmail) {
			return false;
		}

		const safeInviter = escapeHtml(input.inviterName);
		const safeTripTitle = escapeHtml(input.tripTitle);
		const safeUrl = escapeHtml(input.inviteUrl);
		const startsAtLabel = input.tripStartsAt.toLocaleString("vi-VN", {
			timeZone: "Asia/Ho_Chi_Minh",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
		const accountHint = input.hasAccount
			? "Bạn hãy mở liên kết bên dưới và đăng nhập tài khoản DiTrek để xác nhận tham gia."
			: "Để đảm bảo an toàn chuyến đi (điểm danh, tải bản đồ ngoại tuyến, theo dõi GPS và cảnh báo lệch tuyến), bạn hãy mở liên kết bên dưới để đăng ký tài khoản DiTrek bằng đúng email này rồi chấp nhận lời mời.";

		try {
			await transporter.sendMail({
				to: input.to,
				from: fromEmail,
				subject: `[DiTrek] ${input.inviterName} mời bạn tham gia chuyến đi ${input.tripTitle}`,
				html: `
					<div style="font-family: Arial, sans-serif; color: #10221b; line-height: 1.6; max-width: 560px;">
						<h2 style="color: #164027; margin-bottom: 8px;">Lời mời tham gia chuyến đi trên DiTrek</h2>
						<p><strong>${safeInviter}</strong> đã mời bạn tham gia chuyến đi <strong>${safeTripTitle}</strong> (khởi hành lúc ${escapeHtml(startsAtLabel)}).</p>
						<p>${accountHint}</p>
						<p style="margin: 20px 0;">
							<a href="${safeUrl}" style="background-color: #164027; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
								Xem và xác nhận lời mời
							</a>
						</p>
						<p style="font-size: 12px; color: #52665b;">Hoặc sao chép liên kết: ${safeUrl}</p>
					</div>
				`,
			});
			this.logger.log(`Booking invitation email sent to ${input.to}`);
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown SMTP error";
			this.logger.warn(`Booking invitation email skipped/failed for ${input.to}: ${message}`);
			return false;
		}
	}
}
