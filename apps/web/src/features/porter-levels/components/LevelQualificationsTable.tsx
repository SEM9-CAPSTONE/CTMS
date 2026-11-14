import { ClipboardCheck } from "lucide-react";
import { Button, DataTable, StatusBadge } from "../../../shared/components";
import { levelName } from "../constants";
import type { LevelQualification } from "../types";

export function LevelQualificationsTable({
	items,
	onReview,
}: {
	items: LevelQualification[];
	onReview: (id: string) => void;
}) {
	return (
		<DataTable
			ariaLabel="Cấp người hỗ trợ theo tuyến"
			rows={items}
			getRowKey={(item) => item.id}
			columns={[
				{
					key: "porter",
					header: "người hỗ trợ",
					render: (item) => (
						<span className="font-semibold">{item.porterName ?? "người hỗ trợ"}</span>
					),
				},
				{ key: "route", header: "Tuyến", render: (item) => item.routeName },
				{ key: "level", header: "Cấp hiện tại", render: (item) => levelName(item.proficiency) },
				{
					key: "status",
					header: "Trạng thái",
					render: (item) => (
						<StatusBadge tone={item.verifiedBy ? "success" : "neutral"}>
							{item.verifiedBy ? "Đã xác nhận" : "Tự khai"}
						</StatusBadge>
					),
				},
				{
					key: "actions",
					header: "Thao tác",
					align: "right",
					render: (item) => (
						<Button variant="outline" onClick={() => onReview(item.id)}>
							<ClipboardCheck className="size-4" />
							Xét cấp
						</Button>
					),
				},
			]}
		/>
	);
}
