import { Button, Pagination } from "../../../shared/components";
import { REQUEST_STATUS_LABELS, levelName } from "../constants";
import type { RequestList } from "../request-types";
export function LevelRequestList({
	data,
	admin,
	page,
	onPage,
	onSelect,
}: {
	data: RequestList;
	admin: boolean;
	page: number;
	onPage: (page: number) => void;
	onSelect: (id: string) => void;
}) {
	if (!data.items.length)
		return (
			<div className="rounded-2xl bg-[#f4f7f2] px-5 py-8 text-center">
				<p className="font-semibold">Chưa có yêu cầu phù hợp</p>
				<p className="mt-1 text-sm text-[#627769]">
					Yêu cầu sẽ xuất hiện tại đây sau khi Porter gửi. Bạn có thể đổi bộ lọc để xem các trạng
					thái khác.
				</p>
			</div>
		);
	return (
		<div className="space-y-4">
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr>
							{admin && <th className="p-2">Porter</th>}
							<th className="p-2">Tuyến</th>
							<th className="p-2">Cấp đề xuất</th>
							<th className="p-2">Trạng thái</th>
							<th className="p-2">Ngày gửi</th>
							<th>
								<span className="sr-only">Thao tác</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{data.items.map((item) => (
							<tr key={item.id} className="border-t border-[#dfe8df]">
								{admin && <td className="p-2">{item.porterName ?? item.porterId}</td>}
								<td className="p-2">{item.routeName}</td>
								<td className="p-2">
									{levelName(item.currentLevel)} → {levelName(item.targetLevel)}
								</td>
								<td className="p-2">{REQUEST_STATUS_LABELS[item.status]}</td>
								<td className="p-2">{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
								<td className="p-2">
									<Button variant="outline" onClick={() => onSelect(item.id)}>
										Xem yêu cầu
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<Pagination
				currentPage={page}
				totalPages={Math.max(1, Math.ceil(data.total / 20))}
				totalItems={data.total}
				itemsPerPage={20}
				onPageChange={onPage}
			/>
		</div>
	);
}
