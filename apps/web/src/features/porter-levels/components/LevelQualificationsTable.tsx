import { Button } from "../../../shared/components";
import { levelName } from "../constants";
import type { LevelQualification } from "../types";

export function LevelQualificationsTable({
	items,
	onReview,
}: { items: LevelQualification[]; onReview: (id: string) => void }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead>
					<tr>
						<th className="p-3">Porter</th>
						<th>Tuyến</th>
						<th>Cấp hiện tại</th>
						<th>Trạng thái</th>
						<th>
							<span className="sr-only">Thao tác</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id} className="border-t border-[#dfe8df]">
							<td className="p-3">{item.porterName ?? item.porterId}</td>
							<td>{item.routeName}</td>
							<td>{levelName(item.proficiency)}</td>
							<td>{item.verifiedBy ? "Đã duyệt" : "Tự khai"}</td>
							<td className="p-3 text-right">
								<Button onClick={() => onReview(item.id)}>Xét cấp</Button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
