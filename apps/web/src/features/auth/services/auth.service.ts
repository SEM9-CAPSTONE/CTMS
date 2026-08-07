import { API_ENDPOINTS, HttpError, httpClient } from "../../../core/api";
import type {
	LoginFormData,
	RegisterApiPayload,
	RegisterApiResponse,
	SendOtpApiPayload,
	SendOtpApiResponse,
	VerifyOtpApiPayload,
	VerifyOtpApiResponse,
} from "../types";

/**
 * Manual-test-friendly logging (Phase 4, CTMS-02-T02): logs the request and
 * the resulting HTTP status only. Never logs the OTP code itself — `payload`
 * must never be passed through as-is when it may contain `code`.
 */
function logAuthCall(label: string, meta: Record<string, unknown>) {
	console.log(`[auth] ${label}`, meta);
}

export const authService = {
	login: async (
		data: LoginFormData
	): Promise<{ success: boolean; user: { name: string; email: string } }> => {
		// Service API call handler
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					success: true,
					user: { name: "Người dùng CTMS", email: data.email },
				});
			}, 300);
		});
	},

	loginWithGoogle: async (): Promise<{ success: boolean }> => {
		return Promise.resolve({ success: true });
	},

	register: async (payload: RegisterApiPayload): Promise<RegisterApiResponse> => {
		return httpClient.post<RegisterApiResponse>(API_ENDPOINTS.AUTH.REGISTER, payload);
	},

	verifyOtp: async (payload: VerifyOtpApiPayload): Promise<VerifyOtpApiResponse> => {
		// Log only userId, never `payload.code`.
		logAuthCall("POST /auth/verify request", { userId: payload.userId });
		try {
			const result = await httpClient.post<VerifyOtpApiResponse>(
				API_ENDPOINTS.AUTH.VERIFY,
				payload
			);
			logAuthCall("POST /auth/verify response", { status: 200 });
			return result;
		} catch (error) {
			logAuthCall("POST /auth/verify response", {
				status: error instanceof HttpError ? error.status : "network-error",
			});
			throw error;
		}
	},

	/** First OTP send — distinct route from resendOtp for REST clarity, same
	 * body shape (see services/api's SendOtpDto docstring for why). */
	sendOtp: async (payload: SendOtpApiPayload): Promise<SendOtpApiResponse> => {
		logAuthCall("POST /auth/send-otp request", {
			userId: payload.userId,
			channel: payload.channel,
		});
		try {
			const result = await httpClient.post<SendOtpApiResponse>(
				API_ENDPOINTS.AUTH.SEND_OTP,
				payload
			);
			logAuthCall("POST /auth/send-otp response", { status: 200 });
			return result;
		} catch (error) {
			logAuthCall("POST /auth/send-otp response", {
				status: error instanceof HttpError ? error.status : "network-error",
			});
			throw error;
		}
	},

	resendOtp: async (payload: SendOtpApiPayload): Promise<SendOtpApiResponse> => {
		logAuthCall("POST /auth/resend request", { userId: payload.userId, channel: payload.channel });
		try {
			const result = await httpClient.post<SendOtpApiResponse>(API_ENDPOINTS.AUTH.RESEND, payload);
			logAuthCall("POST /auth/resend response", { status: 200 });
			return result;
		} catch (error) {
			logAuthCall("POST /auth/resend response", {
				status: error instanceof HttpError ? error.status : "network-error",
			});
			throw error;
		}
	},
};
