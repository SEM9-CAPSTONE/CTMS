import { Landmark } from "lucide-react";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { PlatformBankAccountPanel } from "../components/PlatformBankAccountPanel";

/** Admin › Tài chính › Tài khoản nhận tiền phạt. */
export function AdminPlatformBankAccountPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	return (
		<AdminLayout activeItem="platform-bank-account" onLogout={onLogout}>
			<div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
						<Landmark className="size-7 text-[#164027]" /> Tài khoản nhận tiền phạt
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Cấu hình tài khoản ngân hàng của CTMS để Host chuyển khoản nộp tiền phạt thời tiết. Sau
						khi Host chuyển, bạn đối chiếu sao kê và xác nhận trong Quản lý thời tiết › Phạt Host.
					</p>
				</div>
				<PlatformBankAccountPanel />
			</div>
		</AdminLayout>
	);
}
