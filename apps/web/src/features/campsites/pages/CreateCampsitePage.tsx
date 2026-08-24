import { ArrowLeft, CheckCircle2, FileText, TentTree } from "lucide-react";
import { CreateCampsiteForm } from "../components/CreateCampsiteForm";
import { useCreateCampsite } from "../hooks/useCreateCampsite";

export interface CreateCampsitePageProps {
	onBackHome?: () => void;
}

export function CreateCampsitePage({ onBackHome }: CreateCampsitePageProps) {
	const createState = useCreateCampsite();

	if (createState.createdCampsite) {
		const campsite = createState.createdCampsite;

		return (
			<div className="min-h-screen bg-[#f4f7f2] font-sans">
				<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
					<div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
						<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-50 text-green-600">
							<CheckCircle2 className="size-9" />
						</div>

						<h1 className="mt-5 text-2xl font-extrabold text-[#10221b]">Tạo campsite thành công</h1>

						<p className="mt-2 text-sm text-[#667a6d]">
							Campsite đã được gửi và đang chờ Admin duyệt.
						</p>

						<div className="mt-6 rounded-xl border border-[#e0ebe0] bg-[#f8faf7] p-5 text-left">
							<div className="flex items-start justify-between gap-4">
								<div>
									<p className="text-lg font-extrabold text-[#10221b]">{campsite.name}</p>
									<p className="mt-1 text-sm text-[#667a6d]">{campsite.province}</p>
								</div>

								<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase text-amber-700">
									{campsite.status === "pending_approval" ? "pending" : campsite.status}
								</span>
							</div>

							<div className="mt-4 flex items-center gap-2 text-xs text-[#788b7e]">
								<FileText className="size-4" />
								ID:
								<span data-testid="created-campsite-id" className="font-mono">
									{campsite.id}
								</span>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap justify-center gap-3">
							<button
								type="button"
								onClick={createState.reset}
								className="rounded-xl bg-[#164027] px-5 py-3 text-sm font-bold text-white"
							>
								Tạo campsite khác
							</button>

							{onBackHome && (
								<button
									type="button"
									onClick={onBackHome}
									className="rounded-xl border border-[#cbd9ce] bg-white px-5 py-3 text-sm font-bold text-[#164027]"
								>
									Về Host Dashboard
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans antialiased">
			<header className="border-b border-[#dfe8df] bg-white">
				<div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-5 sm:px-6">
					{onBackHome && (
						<button
							type="button"
							aria-label="Quay về Host Dashboard"
							onClick={onBackHome}
							className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe8df] text-[#164027] hover:bg-[#f4f7f2]"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}

					<div className="flex size-11 items-center justify-center rounded-xl bg-[#eaf4eb] text-[#164027]">
						<TentTree className="size-6" />
					</div>

					<div>
						<h1 className="text-xl font-extrabold text-[#10221b] sm:text-2xl">Tạo Campsite</h1>

						<p className="mt-0.5 text-sm text-[#667a6d]">
							Thông tin đang nhập sẽ được tự lưu nháp trên thiết bị này.
						</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
				<CreateCampsiteForm
					isSubmitting={createState.isSubmitting}
					error={createState.error}
					onSubmit={createState.submit}
					onRetry={createState.retry}
				/>
			</main>
		</div>
	);
}
