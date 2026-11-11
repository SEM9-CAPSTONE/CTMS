import { Button } from "../../../shared/components";
import { REQUEST_ACTION_LABELS, levelName, levelReviewError } from "../constants";
import { useLevelNotifications } from "../hooks/useLevelRequests";
export function PorterLevelNotifications({ onSelect }: { onSelect: (id: string) => void }) {
	const { query, read } = useLevelNotifications();
	return (
		<details className="rounded-xl border border-[#dfe8df] p-3">
			<summary className="cursor-pointer font-semibold">
				Thông báo xét cấp ({query.data?.filter((item) => !item.readAt).length ?? 0} chưa đọc)
			</summary>
			{query.isPending && <p>Đang tải thông báo…</p>}
			{query.isError && <p role="alert">{levelReviewError(query.error)}</p>}
			{query.data?.length === 0 && <p className="mt-3 text-sm">Chưa có thông báo xét cấp.</p>}
			<ul className="mt-3 space-y-3">
				{query.data?.map((item) => (
					<li key={item.id} className="space-y-1 border-t border-[#dfe8df] pt-3 text-sm">
						<p className="font-semibold">
							{REQUEST_ACTION_LABELS[item.payload.kind as keyof typeof REQUEST_ACTION_LABELS] ??
								item.payload.kind}{" "}
							· {levelName(item.payload.level)}
						</p>
						<p>Tuyến: {item.payload.routeName ?? item.payload.routeId}</p>
						<p>{item.payload.reason}</p>
						<p className="text-xs">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
						<div className="flex gap-2">
							{item.payload.requestId && (
								<Button
									variant="outline"
									onClick={() => {
										onSelect(item.payload.requestId as string);
										if (!item.readAt) read.mutate(item.id);
									}}
								>
									Xem yêu cầu
								</Button>
							)}
							{!item.readAt && (
								<Button
									variant="ghost"
									disabled={read.isPending}
									onClick={() => read.mutate(item.id)}
								>
									Đánh dấu đã đọc
								</Button>
							)}
						</div>
					</li>
				))}
			</ul>
			{read.isError && <p role="alert">{levelReviewError(read.error)}</p>}
		</details>
	);
}
