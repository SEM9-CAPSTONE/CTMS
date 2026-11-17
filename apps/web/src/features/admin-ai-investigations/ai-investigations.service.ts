import { API_ENDPOINTS, HttpError, httpClient } from "../../core/api";
import type {
	InvestigationCommand,
	InvestigationDetail,
	InvestigationFilters,
	InvestigationList,
} from "./ai-investigations.types";

const { LIST, CASE } = API_ENDPOINTS.AI_INVESTIGATIONS;

export const aiInvestigationsService = {
	list: (filters: InvestigationFilters, signal?: AbortSignal) =>
		httpClient.get<InvestigationList>(
			LIST,
			{ ...filters, limit: 20 },
			{ signal, cache: "no-store" }
		),
	detail: (id: string, signal?: AbortSignal) =>
		httpClient.get<InvestigationDetail>(CASE(id), undefined, { signal, cache: "no-store" }),
	update: (id: string, payload: InvestigationCommand) => httpClient.patch(CASE(id), payload),
};

export function investigationError(error: unknown) {
	const status = error instanceof HttpError ? error.status : undefined;
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Bạn không có quyền truy cập hồ sơ điều tra.",
		404: "Không tìm thấy hồ sơ hoặc nhóm hồ sơ.",
		409: "Hồ sơ vừa thay đổi. Vui lòng xem lại trạng thái mới trước khi thao tác.",
		422: "Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.",
	};
	return {
		status,
		message:
			(status && messages[status]) || "Không thể tải hoặc cập nhật dữ liệu. Vui lòng thử lại.",
	};
}
