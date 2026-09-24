import { ArrowLeft, CheckCircle2, PackagePlus } from "lucide-react";
import { CreateEquipmentCatalogItemForm } from "../components/CreateEquipmentCatalogItemForm";
import { useCreateEquipmentCatalogItem } from "../hooks/useCreateEquipmentCatalogItem";

export interface CreateEquipmentCatalogItemPageProps {
	onBackHome?: () => void;
}

export function CreateEquipmentCatalogItemPage({
	onBackHome,
}: CreateEquipmentCatalogItemPageProps) {
	const creation = useCreateEquipmentCatalogItem();

	if (creation.createdItem) {
		const item = creation.createdItem;
		return (
			<main className="min-h-screen bg-[#f4f7f2] p-5 sm:p-10">
				<section className="mx-auto max-w-2xl rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
					<CheckCircle2 className="mx-auto size-14 text-green-600" />
					<h1 className="mt-4 text-2xl font-extrabold">Thêm thiết bị thành công</h1>
					<div className="mt-5 grid gap-3 rounded-xl bg-[#f8faf7] p-5 text-left sm:grid-cols-2">
						<p>
							<b>Tên thiết bị:</b> {item.name}
						</p>
						<p>
							<b>Trạng thái:</b> <span data-testid="server-item-status">{item.status}</span>
						</p>
						<p>
							<b>Số lượng:</b> <span data-testid="server-item-quantity">{item.quantityTotal}</span>
						</p>
						<p className="sm:col-span-2">
							<b>ID:</b>{" "}
							<span data-testid="created-item-id" className="font-mono">
								{item.id}
							</span>
						</p>
					</div>
					<div className="mt-6 flex justify-center gap-3">
						<button
							type="button"
							onClick={creation.reset}
							className="rounded-xl bg-[#164027] px-4 py-3 font-bold text-white"
						>
							Thêm thiết bị khác
						</button>
						{onBackHome && (
							<button
								type="button"
								onClick={onBackHome}
								className="rounded-xl border px-4 py-3 font-bold"
							>
								Về Host Dashboard
							</button>
						)}
					</div>
				</section>
			</main>
		);
	}

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-5 sm:px-6">
					{onBackHome && (
						<button
							type="button"
							aria-label="Quay về Host Dashboard"
							onClick={onBackHome}
							className="rounded-xl border p-2.5"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}
					<div className="rounded-xl bg-emerald-50 p-3 text-[#164027]">
						<PackagePlus className="size-6" />
					</div>
					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">Thêm thiết bị vào kho</h1>
						<p className="text-sm text-[#667a6d]">
							Thiết bị mới sẽ ở trạng thái "Đang hoạt động" và sẵn sàng cho các bước sau.
						</p>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
				<CreateEquipmentCatalogItemForm
					isSubmitting={creation.isSubmitting}
					error={creation.error}
					onSubmit={creation.submit}
					onRetry={creation.retry}
				/>
			</main>
		</div>
	);
}
