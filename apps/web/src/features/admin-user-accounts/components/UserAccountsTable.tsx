import { Eye, Lock, Unlock } from "lucide-react";
import type { AccountAction, UserAccountSummary } from "../types";
import { AccountStatusBadge } from "./AccountStatusBadge";

export interface UserAccountsTableProps {
	users: UserAccountSummary[];
	currentUserId: string | null;
	onView: (user: UserAccountSummary) => void;
	onAction: (user: UserAccountSummary, action: AccountAction) => void;
}

export function UserAccountsTable({
	users,
	currentUserId,
	onView,
	onAction,
}: UserAccountsTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[900px] text-left text-sm">
				<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
					<tr>
						<th className="px-4 py-3">Người dùng</th>
						<th className="px-4 py-3">Liên hệ</th>
						<th className="px-4 py-3">Vai trò</th>
						<th className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
						<th className="px-4 py-3 whitespace-nowrap">Ngày tạo</th>
						<th className="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-[#e8efe7]">
					{users.map((user) => {
						const displayName = user.fullName || user.email || user.phone || user.id;
						const isCurrentUser = user.id === currentUserId;
						return (
							<tr key={user.id} className="hover:bg-[#f8faf7]">
								<td className="px-4 py-4">
									<p className="font-bold text-[#10221b]">{displayName}</p>
								</td>
								<td className="px-4 py-4 text-[#425048]">
									<p>{user.email || "—"}</p>
									<p className="mt-1 text-xs">{user.phone || "—"}</p>
								</td>
								<td className="px-4 py-4 font-semibold capitalize text-[#425048]">{user.role}</td>
								<td className="px-4 py-4 whitespace-nowrap">
									<AccountStatusBadge status={user.status} />
								</td>
								<td className="px-4 py-4 text-[#425048]">
									{new Date(user.createdAt).toLocaleDateString("vi-VN")}
								</td>
								<td className="px-4 py-4">
									<div className="flex justify-end gap-2">
										<button
											type="button"
											onClick={() => onView(user)}
											aria-label={`Xem ${displayName}`}
											className="rounded-lg border border-[#dfe8df] p-2 text-[#164027] hover:bg-[#eef7f0]"
										>
											<Eye className="size-4" />
										</button>
										{user.status === "active" && (
											<button
												type="button"
												disabled={isCurrentUser}
												onClick={() => onAction(user, "lock")}
												aria-label={`Khóa ${displayName}`}
												title={isCurrentUser ? "Không thể khóa tài khoản của chính bạn" : undefined}
												className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
											>
												<Lock className="size-4" />
											</button>
										)}
										{user.status === "suspended" && (
											<button
												type="button"
												onClick={() => onAction(user, "unlock")}
												aria-label={`Mở khóa ${displayName}`}
												className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"
											>
												<Unlock className="size-4" />
											</button>
										)}
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
