import { AlertCircle, AlertTriangle, FileText, UploadCloud } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { Modal } from "../../../shared/components";
import { CERTIFICATE_TYPE_LABELS } from "../constants";
import type {
	CreatePorterCertificateInput,
	PorterCertificateItem,
	PorterCertificateType,
	UpdatePorterCertificateInput,
} from "../types";

export interface CertificateDialogProps {
	isOpen: boolean;
	onClose: () => void;
	certificateToEdit?: PorterCertificateItem | null;
	onSubmit: (
		input: CreatePorterCertificateInput | UpdatePorterCertificateInput
	) => Promise<unknown>;
	isSubmitting: boolean;
}

export function CertificateDialog({
	isOpen,
	onClose,
	certificateToEdit,
	onSubmit,
	isSubmitting,
}: CertificateDialogProps) {
	const isEdit = Boolean(certificateToEdit);

	const [certificateType, setCertificateType] = useState<PorterCertificateType>("wfa");
	const [name, setName] = useState("");
	const [certificateNumber, setCertificateNumber] = useState("");
	const [issuedBy, setIssuedBy] = useState("");
	const [issueDate, setIssueDate] = useState("");
	const [expiryDate, setExpiryDate] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	// Today's date YYYY-MM-DD for min expiry constraint
	const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

	useEffect(() => {
		if (certificateToEdit) {
			const resolvedType = (certificateToEdit.type ||
				certificateToEdit.certificateType ||
				"wfa") as PorterCertificateType;
			setCertificateType(resolvedType);
			setName(certificateToEdit.name || "");
			setCertificateNumber(certificateToEdit.certificateNumber || "");
			setIssuedBy(certificateToEdit.issuedBy || "");
			const rawIssueDate = certificateToEdit.issuedDate || certificateToEdit.issueDate;
			setIssueDate(rawIssueDate ? new Date(rawIssueDate).toISOString().split("T")[0] : "");
			setExpiryDate(
				certificateToEdit.expiryDate
					? new Date(certificateToEdit.expiryDate).toISOString().split("T")[0]
					: ""
			);
			setPreviewUrl(certificateToEdit.fileUrl || null);
			setFile(null);
		} else {
			setCertificateType("wfa");
			setName("");
			setCertificateNumber("");
			setIssuedBy("");
			setIssueDate("");
			setExpiryDate("");
			setFile(null);
			setPreviewUrl(null);
		}
		setFormError(null);
	}, [certificateToEdit]);

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (!selectedFile) return;

		// Validation: 5MB
		if (selectedFile.size > 5 * 1024 * 1024) {
			setFormError("Kích thước tệp vượt quá 5MB. Vui lòng chọn tệp nhỏ hơn.");
			return;
		}

		// Validation format
		const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
		if (!allowed.includes(selectedFile.type)) {
			setFormError("Định dạng tệp không hợp lệ. Chỉ chấp nhận JPG, PNG, WebP hoặc PDF.");
			return;
		}

		setFormError(null);
		setFile(selectedFile);
		if (selectedFile.type.startsWith("image/")) {
			setPreviewUrl(URL.createObjectURL(selectedFile));
		} else {
			setPreviewUrl(null);
		}
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setFormError(null);

		if (!name.trim()) {
			setFormError("Vui lòng nhập tên chứng chỉ.");
			return;
		}
		if (!issuedBy.trim()) {
			setFormError("Vui lòng nhập đơn vị cấp chứng chỉ.");
			return;
		}
		if (!expiryDate) {
			setFormError("Vui lòng chọn ngày hết hạn.");
			return;
		}

		if (!isEdit && expiryDate < tomorrowStr) {
			setFormError("Ngày hết hạn phải từ ngày mai trở đi.");
			return;
		}

		if (!isEdit && !file) {
			setFormError("Vui lòng tải lên ảnh chụp hoặc tệp chứng chỉ.");
			return;
		}

		try {
			await onSubmit({
				type: certificateType,
				certificateType,
				name: name.trim(),
				certificateNumber: certificateNumber.trim() || undefined,
				issuedBy: issuedBy.trim(),
				issuedDate: issueDate || undefined,
				issueDate: issueDate || undefined,
				expiryDate,
				file: file || undefined,
			});
			onClose();
		} catch (err: unknown) {
			setFormError((err as Error).message || "Có lỗi xảy ra khi lưu chứng chỉ.");
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isEdit ? "Cập nhật chứng chỉ" : "Thêm chứng chỉ chuyên môn"}
			size="lg"
			isCloseDisabled={isSubmitting}
		>
			<form onSubmit={handleSubmit} className="space-y-4 text-sm">
				{/* Rejection Notice if editing rejected cert */}
				{certificateToEdit?.status === "rejected" && certificateToEdit.rejectionReason && (
					<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
						<div className="flex items-center gap-1.5 font-bold mb-1">
							<AlertCircle className="size-4 shrink-0 text-red-600" />
							<span>Lý do từ chối trước đó:</span>
						</div>
						<p className="ml-5 leading-relaxed">{certificateToEdit.rejectionReason}</p>
					</div>
				)}

				{/* Warning if editing verified cert */}
				{certificateToEdit?.status === "verified" && (
					<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
						<AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
						<span>
							<strong>Lưu ý:</strong> Chỉnh sửa sẽ chuyển chứng chỉ về trạng thái{" "}
							<strong>Chờ duyệt</strong> để Quản trị viên thẩm định lại.
						</span>
					</div>
				)}

				{formError && (
					<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
						{formError}
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label htmlFor="cert-type" className="block text-xs font-semibold text-[#4a5e51] mb-1">
							Loại chứng chỉ <span className="text-red-500">*</span>
						</label>
						<select
							id="cert-type"
							value={certificateType}
							onChange={(e) => setCertificateType(e.target.value as PorterCertificateType)}
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm focus:border-[#164027] focus:outline-hidden"
						>
							{Object.entries(CERTIFICATE_TYPE_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label htmlFor="cert-name" className="block text-xs font-semibold text-[#4a5e51] mb-1">
							Tên chứng chỉ <span className="text-red-500">*</span>
						</label>
						<input
							id="cert-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="VD: Sơ cấp cứu hoang dã WFA"
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm focus:border-[#164027] focus:outline-hidden"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label
							htmlFor="cert-number"
							className="block text-xs font-semibold text-[#4a5e51] mb-1"
						>
							Số hiệu chứng chỉ
						</label>
						<input
							id="cert-number"
							type="text"
							value={certificateNumber}
							onChange={(e) => setCertificateNumber(e.target.value)}
							placeholder="VD: WFA-2025-089"
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm focus:border-[#164027] focus:outline-hidden"
						/>
					</div>

					<div>
						<label
							htmlFor="cert-issuer"
							className="block text-xs font-semibold text-[#4a5e51] mb-1"
						>
							Đơn vị cấp <span className="text-red-500">*</span>
						</label>
						<input
							id="cert-issuer"
							type="text"
							value={issuedBy}
							onChange={(e) => setIssuedBy(e.target.value)}
							placeholder="VD: Hội Chữ thập đỏ Việt Nam"
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm focus:border-[#164027] focus:outline-hidden"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label
							htmlFor="cert-issue-date"
							className="block text-xs font-semibold text-[#4a5e51] mb-1"
						>
							Ngày cấp
						</label>
						<input
							id="cert-issue-date"
							type="date"
							value={issueDate}
							onChange={(e) => setIssueDate(e.target.value)}
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm focus:border-[#164027] focus:outline-hidden"
						/>
					</div>

					<div>
						<label
							htmlFor="cert-expiry-date"
							className="block text-xs font-semibold text-[#4a5e51] mb-1"
						>
							Ngày hết hạn <span className="text-red-500">*</span>
						</label>
						<input
							id="cert-expiry-date"
							type="date"
							value={expiryDate}
							min={!isEdit ? tomorrowStr : undefined}
							onChange={(e) => setExpiryDate(e.target.value)}
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm focus:border-[#164027] focus:outline-hidden"
						/>
					</div>
				</div>

				{/* File upload section */}
				<div>
					<label
						htmlFor="cert-file-input"
						className="block text-xs font-semibold text-[#4a5e51] mb-1"
					>
						Tệp hoặc ảnh chứng chỉ {!isEdit && <span className="text-red-500">*</span>}
						<span className="text-xs font-normal text-muted-foreground ml-1">
							(JPG, PNG, WebP, PDF tối đa 5MB)
						</span>
					</label>
					<div className="mt-1 flex justify-center rounded-xl border-2 border-dashed border-[#dfe8df] px-4 py-5 hover:border-[#164027] transition-colors">
						<div className="text-center">
							<UploadCloud className="mx-auto size-8 text-[#627769]" />
							<div className="mt-2 flex text-xs text-[#4a5e51] justify-center">
								<label
									htmlFor="cert-file-input"
									className="cursor-pointer font-bold text-[#164027] hover:underline"
								>
									<span>{file ? file.name : "Chọn tệp từ thiết bị"}</span>
									<input
										id="cert-file-input"
										type="file"
										accept="image/jpeg,image/png,image/webp,application/pdf"
										onChange={handleFileChange}
										className="sr-only"
									/>
								</label>
							</div>
							{file && (
								<p className="text-xs text-muted-foreground mt-1">
									{(file.size / 1024 / 1024).toFixed(2)} MB
								</p>
							)}
						</div>
					</div>

					{previewUrl && (
						<div className="mt-2 flex items-center gap-3 rounded-lg border border-[#dfe8df] p-2 bg-[#f8faf7]">
							<FileText className="size-5 text-[#164027]" />
							<span className="text-xs text-[#164027] truncate font-medium">
								{previewUrl.startsWith("blob:") ? "Xem trước ảnh mới" : "Tệp chứng chỉ hiện tại"}
							</span>
							<a
								href={previewUrl}
								target="_blank"
								rel="noreferrer"
								className="text-xs font-bold text-[#164027] hover:underline ml-auto"
							>
								Mở xem
							</a>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-3 pt-3 border-t border-[#dfe8df]">
					<button
						type="button"
						onClick={onClose}
						disabled={isSubmitting}
						className="rounded-xl border border-[#dfe8df] px-4 py-2 text-xs font-bold text-[#4a5e51] hover:bg-[#f4f7f2] transition"
					>
						Hủy bỏ
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white hover:bg-[#10221b] disabled:opacity-50 transition"
					>
						{isSubmitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tải lên chứng chỉ"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
