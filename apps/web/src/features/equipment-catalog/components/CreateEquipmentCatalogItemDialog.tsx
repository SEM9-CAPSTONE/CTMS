import { PackagePlus } from "lucide-react";
import { Modal } from "../../../shared/components";
import { useCreateEquipmentCatalogItem } from "../hooks/useCreateEquipmentCatalogItem";
import type { EquipmentCatalogItem } from "../types";
import { CreateEquipmentCatalogItemForm } from "./CreateEquipmentCatalogItemForm";

export interface CreateEquipmentCatalogItemDialogProps {
	open: boolean;
	onClose: () => void;
	onCreated: (item: EquipmentCatalogItem) => void | Promise<void>;
}

export function CreateEquipmentCatalogItemDialog({
	open,
	onClose,
	onCreated,
}: CreateEquipmentCatalogItemDialogProps) {
	const creation = useCreateEquipmentCatalogItem();

	const close = () => {
		creation.reset();
		onClose();
	};

	const handleCreated = async (created: EquipmentCatalogItem | null) => {
		if (!created) return;
		creation.reset();
		await onCreated(created);
	};

	return (
		<Modal
			isOpen={open}
			onClose={close}
			title="Thêm thiết bị vào kho"
			description='Thiết bị mới sẽ ở trạng thái "Đang hoạt động".'
			icon={<PackagePlus className="size-5" />}
			isCloseDisabled={creation.isSubmitting}
		>
			<CreateEquipmentCatalogItemForm
				isSubmitting={creation.isSubmitting}
				error={creation.error}
				onSubmit={async (payload) => handleCreated(await creation.submit(payload))}
				onRetry={async () => handleCreated(await creation.retry())}
				onCancel={close}
			/>
		</Modal>
	);
}
