import { ArrowLeft } from "lucide-react";
import { PackingListPanel } from "../components/PackingListPanel";

export interface PackingListPageProps {
	bookingId: string;
	onBack?: () => void;
}

export function PackingListPage({ bookingId, onBack }: PackingListPageProps) {
	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			<header className="border-b border-[#dfe8df] bg-white sticky top-0 z-20 backdrop-blur-sm bg-white/95">
				<div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
					{onBack && (
						<button
							type="button"
							aria-label="Quay lại"
							onClick={onBack}
							className="rounded-2xl border border-[#dfe8df] p-2.5 text-[#55685a] transition hover:bg-[#f6f9f6] hover:text-[#164027]"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}
					<div>
						<h1 className="text-lg font-extrabold text-[#10221b] sm:text-xl">
							Packing list cho chuyến đi
						</h1>
						<p className="text-xs font-semibold text-[#667a6d]">
							Danh sách đồ dùng cá nhân hóa theo booking của bạn
						</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
				<PackingListPanel bookingId={bookingId} />
			</main>
		</div>
	);
}
