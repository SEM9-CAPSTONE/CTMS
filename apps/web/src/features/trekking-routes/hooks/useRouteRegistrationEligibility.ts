import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { RegistrationBlockedReason, RegistrationEligibilityResponse } from "../types";

export interface RegistrationEligibilityError {
	status?: number;
	message: string;
	eligibilityData?: RegistrationEligibilityResponse | null;
}

export function mapRegistrationEligibilityError(
	error: unknown,
	fallbackMessage: string
): RegistrationEligibilityError {
	const isHttpErr =
		error instanceof HttpError ||
		(typeof error === "object" &&
			error !== null &&
			("status" in error || (error as Error).name === "HttpError"));

	if (!isHttpErr) {
		return { message: fallbackMessage };
	}

	const httpErr = error as HttpError;
	const body = (httpErr.errorData ?? (httpErr as unknown as { data?: unknown }).data) as
		| Record<string, unknown>
		| undefined;

	if (httpErr.status === 409 && body) {
		const eligibilityData: RegistrationEligibilityResponse = {
			allowed: false,
			routeId: (body.routeId as string) || "",
			riskLevel: (body.riskLevel as "red" | "yellow" | "green") || "red",
			assessmentTime: (body.assessmentTime as string) || new Date().toISOString(),
			compositeScore: (body.compositeScore as number) || 0,
			reasons: (body.reasons as RegistrationBlockedReason[]) || [],
		};

		return {
			status: 409,
			message:
				(body.message as string) || "Đăng ký chuyến đi mới bị chặn do rủi ro thời tiết MỨC ĐỎ.",
			eligibilityData,
		};
	}

	const messages: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Tài khoản của bạn đang bị hạn chế hoặc không có quyền đăng ký.",
		404: "Không tìm thấy tuyến đường trekking.",
		409: "Chưa có đánh giá rủi ro thời tiết hoặc rủi ro mức ĐỎ làm tạm dừng nhận đăng ký.",
	};

	return {
		status: httpErr.status,
		message: messages[httpErr.status] ?? fallbackMessage,
	};
}

export function useRouteRegistrationEligibility(routeId?: string) {
	const [eligibility, setEligibility] = useState<RegistrationEligibilityResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const requestSequence = useRef(0);

	const checkEligibility =
		useCallback(async (): Promise<RegistrationEligibilityResponse | null> => {
			const sequence = ++requestSequence.current;

			if (!routeId) {
				setEligibility(null);
				setError("");
				setIsLoading(false);
				return null;
			}

			setError("");
			setIsLoading(true);

			try {
				const result = await trekkingRoutesService.checkRegistrationEligibility(routeId);
				if (sequence === requestSequence.current) {
					setEligibility(result);
				}
				return result;
			} catch (requestError) {
				if (sequence === requestSequence.current) {
					const mappedErr = mapRegistrationEligibilityError(
						requestError,
						"Không thể kiểm tra điều kiện đăng ký. Vui lòng thử lại."
					);
					setError(mappedErr.message);

					if (mappedErr.eligibilityData) {
						setEligibility(mappedErr.eligibilityData);
					}
				}
				return null;
			} finally {
				if (sequence === requestSequence.current) {
					setIsLoading(false);
				}
			}
		}, [routeId]);

	useEffect(() => {
		void checkEligibility();
		return () => {
			requestSequence.current += 1;
		};
	}, [checkEligibility]);

	const isBlocked = eligibility?.allowed === false || eligibility?.riskLevel === "red";
	const blockedReasons: RegistrationBlockedReason[] = eligibility?.reasons ?? [];
	const assessmentTime = eligibility?.assessmentTime ?? null;

	return {
		eligibility,
		isLoading,
		error,
		isBlocked,
		blockedReasons,
		assessmentTime,
		checkEligibility,
		reload: checkEligibility,
	};
}
