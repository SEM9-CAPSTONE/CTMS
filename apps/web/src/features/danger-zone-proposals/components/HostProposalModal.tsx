import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button, Modal } from "../../../shared/components";
import { SelectField } from "../../../shared/components/SelectField";
import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import type { CreatedTrekkingRoute, GeoJsonPoint } from "../../trekking-routes/types";
import {
	HAZARD_TYPE_OPTIONS,
	PROPOSAL_DEFAULT_RADIUS_METERS,
	SEVERITY_OPTIONS,
} from "../constants";
import { useCreateDangerZoneProposal } from "../hooks/useCreateDangerZoneProposal";
import {
	type HostProposalFormData,
	type HostProposalFormInput,
	hostProposalSchema,
} from "../schema/proposal.schema";

interface Props {
	route: CreatedTrekkingRoute;
	onClose: () => void;
	onCreated: () => void;
}

const NO_CHECKPOINTS: [] = [];
const fieldClass =
	"w-full rounded-xl border border-[#dfe8df] bg-white p-3 text-sm text-[#10221b] transition-colors duration-150 focus:border-[#164027] focus:outline-none disabled:opacity-60";
const labelClass = "text-xs font-medium tracking-wide text-[#667a6d]";

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-xs text-rose-700">
			{message}
		</p>
	);
}

export function HostProposalModal({ route, onClose, onCreated }: Props) {
	const create = useCreateDangerZoneProposal(route.id, () => {
		onCreated();
		onClose();
	});
	const {
		register,
		control,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<HostProposalFormInput, unknown, HostProposalFormData>({
		resolver: zodResolver(hostProposalSchema),
		defaultValues: {
			hazardType: "SLIPPERY_OR_LANDSLIDE",
			severity: "medium",
			description: "",
			radiusMeters: PROPOSAL_DEFAULT_RADIUS_METERS,
			location: undefined,
		},
	});
	const location = watch("location") as GeoJsonPoint | undefined;
	const radius = Number(watch("radiusMeters")) || 0;

	const submit = handleSubmit(async (values) => {
		if (!values.location) return;
		await create.submit({
			hazardType: values.hazardType,
			severity: values.severity,
			description: values.description,
			radiusMeters: values.radiusMeters,
			geometry: values.location,
		});
	});

	return (
		<Modal
			isOpen
			onClose={onClose}
			title="Đề xuất điểm nguy hiểm"
			size="xl"
			isCloseDisabled={create.submitting}
		>
			<form className="space-y-4" onSubmit={submit}>
				<div className="space-y-1.5">
					<p className={labelClass}>Vị trí</p>
					<RouteCheckpointMap
						geometry={route.geometry}
						checkpoints={NO_CHECKPOINTS}
						mode="hazard-point"
						selectedLocation={location}
						radiusMeters={radius}
						proposedHazard={location}
						proposedHazardRadiusMeters={radius}
						disabled={create.submitting}
						onSelectLocation={(point) => setValue("location", point, { shouldValidate: true })}
					/>
					<FieldError message={errors.location?.message} />
				</div>
				<div className="grid gap-3 sm:grid-cols-3">
					<Controller
						control={control}
						name="hazardType"
						render={({ field }) => (
							<div className="space-y-1.5">
								<span aria-hidden="true" className={labelClass}>
									Loại nguy hiểm
								</span>
								<SelectField
									label="Loại nguy hiểm"
									value={field.value}
									options={HAZARD_TYPE_OPTIONS}
									onChange={(value) => field.onChange(value)}
									disabled={create.submitting}
								/>
							</div>
						)}
					/>
					<Controller
						control={control}
						name="severity"
						render={({ field }) => (
							<div className="space-y-1.5">
								<span aria-hidden="true" className={labelClass}>
									Mức độ
								</span>
								<SelectField
									label="Mức độ"
									value={field.value}
									options={SEVERITY_OPTIONS}
									onChange={(value) => field.onChange(value)}
									disabled={create.submitting}
								/>
							</div>
						)}
					/>
					<div className="space-y-1.5">
						<label htmlFor="host-proposal-radius" className={labelClass}>
							Bán kính (m)
						</label>
						<input
							id="host-proposal-radius"
							type="number"
							min={1}
							{...register("radiusMeters")}
							className={fieldClass}
							disabled={create.submitting}
						/>
						<FieldError message={errors.radiusMeters?.message} />
					</div>
				</div>
				<div className="space-y-1.5">
					<label htmlFor="host-proposal-description" className={labelClass}>
						Mô tả
					</label>
					<textarea
						id="host-proposal-description"
						rows={3}
						maxLength={1000}
						{...register("description")}
						className={fieldClass}
						disabled={create.submitting}
					/>
					<FieldError message={errors.description?.message} />
				</div>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" disabled={create.submitting} onClick={onClose}>
						Hủy
					</Button>
					<Button type="submit" disabled={create.submitting}>
						Gửi đề xuất
					</Button>
				</div>
			</form>
		</Modal>
	);
}
