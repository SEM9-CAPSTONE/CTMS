import { Button } from "../../shared/components/Button";
import { isReputationAccessError } from "./useAuthorizedRead";

export function ReputationRefreshNotice({
	error,
	hasData,
	onRetry,
}: {
	error: unknown;
	hasData: boolean;
	onRetry: () => void;
}) {
	if (!error) return null;
	const denied = isReputationAccessError(error);
	return (
		<output className="my-3 flex flex-wrap items-center gap-3 text-sm text-amber-900">
			<span>
				{denied
					? "Nội dung không còn khả dụng hoặc bạn không còn quyền xem."
					: hasData
						? "Chưa cập nhật"
						: "Chưa tải được dữ liệu."}
			</span>
			{!denied && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					Thử lại
				</Button>
			)}
		</output>
	);
}
