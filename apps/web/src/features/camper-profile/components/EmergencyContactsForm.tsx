import { Plus, Trash2 } from "lucide-react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import type { CamperProfileFormValues } from "../schema/profile.schema";

interface EmergencyContactsFormProps {
	form: UseFormReturn<CamperProfileFormValues>;
	isSaving: boolean;
	isDisabled?: boolean;
}

export function EmergencyContactsForm({
	form,
	isSaving,
	isDisabled = false,
}: EmergencyContactsFormProps) {
	const {
		control,
		register,
		formState: { errors },
	} = form;
	const { fields, append, remove } = useFieldArray({
		control,
		name: "emergencyContacts",
	});

	const canAddContact = fields.length < 2 && !isSaving && !isDisabled;

	return (
		<div className="flex flex-col gap-5 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="flex flex-col gap-3 border-b border-[#f0f4f1] pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="text-base font-extrabold text-[#164027]">Liên hệ khẩn cấp</h3>
					<p className="text-xs font-medium text-[#627769]">
						Lưu tối đa 2 người thân để đội vận hành liên hệ khi có tình huống khẩn cấp.
					</p>
				</div>
				<button
					type="button"
					onClick={() => append({ name: "", relationship: "", phone: "", email: "" })}
					disabled={!canAddContact}
					className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 text-xs font-bold text-white transition hover:bg-[#276143] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Plus size={15} />
					<span>Thêm liên hệ</span>
				</button>
			</div>

			{fields.length === 0 && (
				<div className="rounded-xl border border-dashed border-[#cfdccf] bg-[#f9fbf9] p-5 text-center text-xs font-semibold text-[#627769]">
					Chưa có liên hệ khẩn cấp. Hãy thêm ít nhất một người thân để hoàn thiện hồ sơ an toàn.
				</div>
			)}

			{errors.emergencyContacts?.root?.message && (
				<p className="text-xs font-semibold text-red-600">
					{errors.emergencyContacts.root.message}
				</p>
			)}

			<div className="flex flex-col gap-4">
				{fields.map((field, index) => {
					const contactErrors = errors.emergencyContacts?.[index];

					return (
						<div
							key={field.id}
							className="grid grid-cols-1 gap-4 rounded-xl border border-[#e5eee5] bg-[#fbfdfb] p-4 sm:grid-cols-2"
						>
							<div className="flex items-start justify-between gap-3 sm:col-span-2">
								<p className="text-xs font-extrabold uppercase text-[#164027]">
									Liên hệ #{index + 1}
								</p>
								<button
									type="button"
									onClick={() => remove(index)}
									disabled={isSaving || isDisabled}
									aria-label={`Xóa liên hệ ${index + 1}`}
									className="inline-flex size-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
								>
									<Trash2 size={14} />
								</button>
							</div>

							<div className="flex flex-col gap-1.5">
								<label htmlFor={`emergencyContacts.${index}.name`} className="text-xs font-bold">
									Họ tên <span className="text-red-500">*</span>
								</label>
								<input
									id={`emergencyContacts.${index}.name`}
									type="text"
									disabled={isSaving || isDisabled}
									{...register(`emergencyContacts.${index}.name`)}
									className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-slate-50"
								/>
								{contactErrors?.name && (
									<span className="text-[11px] font-semibold text-red-500">
										{contactErrors.name.message}
									</span>
								)}
							</div>

							<div className="flex flex-col gap-1.5">
								<label
									htmlFor={`emergencyContacts.${index}.relationship`}
									className="text-xs font-bold"
								>
									Mối quan hệ <span className="text-red-500">*</span>
								</label>
								<input
									id={`emergencyContacts.${index}.relationship`}
									type="text"
									disabled={isSaving || isDisabled}
									{...register(`emergencyContacts.${index}.relationship`)}
									className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-slate-50"
								/>
								{contactErrors?.relationship && (
									<span className="text-[11px] font-semibold text-red-500">
										{contactErrors.relationship.message}
									</span>
								)}
							</div>

							<div className="flex flex-col gap-1.5">
								<label htmlFor={`emergencyContacts.${index}.phone`} className="text-xs font-bold">
									Số điện thoại <span className="text-red-500">*</span>
								</label>
								<input
									id={`emergencyContacts.${index}.phone`}
									type="tel"
									disabled={isSaving || isDisabled}
									{...register(`emergencyContacts.${index}.phone`)}
									className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-slate-50"
								/>
								{contactErrors?.phone && (
									<span className="text-[11px] font-semibold text-red-500">
										{contactErrors.phone.message}
									</span>
								)}
							</div>

							<div className="flex flex-col gap-1.5">
								<label htmlFor={`emergencyContacts.${index}.email`} className="text-xs font-bold">
									Email
								</label>
								<input
									id={`emergencyContacts.${index}.email`}
									type="email"
									disabled={isSaving || isDisabled}
									{...register(`emergencyContacts.${index}.email`)}
									className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-slate-50"
								/>
								{contactErrors?.email && (
									<span className="text-[11px] font-semibold text-red-500">
										{contactErrors.email.message}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
