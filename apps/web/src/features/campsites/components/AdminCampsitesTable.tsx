import { FileCheck } from "lucide-react";
import { Button } from "../../../shared/components";
import type { CreatedCampsite } from "../types";

export interface AdminCampsitesTableProps {
	campsites: CreatedCampsite[];
	onReview: (campsite: CreatedCampsite) => void;
}

function formatCreatedAt(value: string): string {
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

export function AdminCampsitesTable({ campsites, onReview }: AdminCampsitesTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[900px] text-left text-sm">
				<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-4 py-3">Tên khu cắm trại</th>
						<th className="px-4 py-3">Tỉnh thành</th>
						<th className="px-4 py-3">Tọa độ</th>
						<th className="px-4 py-3">Ngày tạo</th>
						<th className="px-4 py-3 text-center">Trạng thái</th>
						<th className="px-4 py-3 text-right">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{campsites.map((campsite) => {
						let statusLabel = "Chờ duyệt";
						let statusBadgeTone = "bg-amber-50 text-amber-700 border border-amber-200/50";

						if (campsite.status === "active") {
							statusLabel = "Đã duyệt";
							statusBadgeTone = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
						} else if (campsite.status === "draft") {
							statusLabel = "Đã từ chối";
							statusBadgeTone = "bg-red-50 text-red-700 border border-red-200/50";
						}

						const isPending = campsite.status === "pending_approval";

						return (
							<tr key={campsite.id} className="hover:bg-[#f8faf7]">
								<td className="px-4 py-4">
									<p className="font-bold text-[#10221b]">{campsite.name}</p>
								</td>
								<td className="px-4 py-4 text-[#425048]">{campsite.province}</td>
								<td className="px-4 py-4 font-mono text-xs text-[#55685a]">
									{campsite.latitude.toFixed(6)}, {campsite.longitude.toFixed(6)}
								</td>
								<td className="px-4 py-4 text-xs font-semibold text-[#667a6d]">
									{formatCreatedAt(campsite.createdAt)}
								</td>
								<td className="px-4 py-4 text-center">
									<span
										className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${statusBadgeTone}`}
									>
										{statusLabel}
									</span>
								</td>
								<td className="px-4 py-4">
									<div className="flex justify-end gap-2">
										<Button
											type="button"
											variant={isPending ? "primary" : "outline"}
											size="sm"
											onClick={() => onReview(campsite)}
											disabled={!isPending}
											className="gap-1.5 text-xs"
											aria-label={`Duyệt ${campsite.name}`}
										>
											<FileCheck className="size-4" />
											<span>{isPending ? "Xem xét & Duyệt" : "Đã xử lý"}</span>
										</Button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
