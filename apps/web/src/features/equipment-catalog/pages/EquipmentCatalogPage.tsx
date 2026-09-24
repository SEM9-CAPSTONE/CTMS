import { ArrowLeft, Loader2, PackagePlus, RefreshCw, Warehouse } from "lucide-react";
import { useState } from "react";
import { EditEquipmentCatalogItemDialog } from "../components/EditEquipmentCatalogItemDialog";
import { EquipmentCatalogList } from "../components/EquipmentCatalogList";
import { useEquipmentCatalog } from "../hooks/useEquipmentCatalog";
import { useUpdateEquipmentCatalogItem } from "../hooks/useUpdateEquipmentCatalogItem";
import type { EquipmentCatalogItem } from "../types";

export interface EquipmentCatalogPageProps {
	onBackHome?: () => void;
	onCreateItem?: () => void;
}

export function EquipmentCatalogPage({ onBackHome, onCreateItem }: EquipmentCatalogPageProps) {
	const catalog = useEquipmentCatalog();
	const update = useUpdateEquipmentCatalogItem();
	const [editingItem, setEditingItem] = useState<EquipmentCatalogItem | null>(null);

	const closeDialog = () => {
		setEditingItem(null);
		update.reset();
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6">
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
						<Warehouse className="size-6" />
					</div>

					<div className="flex-1">
						<h1 className="text-xl font-extrabold sm:text-2xl">Kho thiết bị của Host</h1>
						<p className="text-sm text-[#667a6d]">
							Quản lý thiết bị cho thuê: số lượng, giá thuê theo ngày và trạng thái.
						</p>
					</div>

					{onCreateItem && (
						<button
							type="button"
							onClick={onCreateItem}
							className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#123520]"
						>
							<PackagePlus className="size-4" />
							Thêm thiết bị
						</button>
					)}
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
				{catalog.isLoading && (
					<div
						data-testid="equipment-catalog-loading"
						className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold"
					>
						<Loader2 className="size-4 animate-spin" />
						Đang tải kho thiết bị...
					</div>
				)}

				{catalog.error && !catalog.isLoading && (
					<div
						role="alert"
						className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"
					>
						{catalog.error}
						<button
							type="button"
							onClick={() => void catalog.retry()}
							className="mt-4 block rounded-lg border px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Tải lại
						</button>
					</div>
				)}

				{!catalog.isLoading && !catalog.error && catalog.items.length === 0 && (
					<div
						data-testid="equipment-catalog-empty"
						className="mt-6 rounded-2xl border border-dashed bg-white p-8 text-center"
					>
						<Warehouse className="mx-auto size-10 text-[#8fa096]" />
						<p className="mt-3 font-extrabold">Bạn chưa có thiết bị nào trong kho</p>
					</div>
				)}

				{!catalog.isLoading && !catalog.error && catalog.items.length > 0 && (
					<div className="mt-6">
						<EquipmentCatalogList items={catalog.items} onEdit={setEditingItem} />
					</div>
				)}
			</main>

			<EditEquipmentCatalogItemDialog
				open={editingItem !== null}
				item={editingItem}
				isSubmitting={update.isSubmitting}
				errorMessage={update.error?.message ?? null}
				onClose={closeDialog}
				onConfirm={async (payload) => {
					if (!editingItem) return;
					const updated = await update.submit(editingItem.id, payload);
					if (updated) {
						closeDialog();
						await catalog.retry();
					}
				}}
			/>
		</div>
	);
}
