import { Loader2, Send } from "lucide-react";
import { routeEditorMessages } from "../route-editor-messages";
import { ROUTE_SAVE_INTENTS } from "../types";

interface Props {
	isEditing: boolean;
	isSubmitting: boolean;
	isSendingForApproval: boolean;
	canSubmitForApproval: boolean;
}

export function RouteFormActions({
	isEditing,
	isSubmitting,
	isSendingForApproval,
	canSubmitForApproval,
}: Props) {
	const messages = routeEditorMessages.vi;
	let saveLabel: string = canSubmitForApproval ? messages.saveDraft : messages.save;
	if (isEditing) saveLabel = messages.saveChanges;
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
			<button
				type="submit"
				name="routeAction"
				value={ROUTE_SAVE_INTENTS.SAVE}
				disabled={isSubmitting}
				className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold disabled:opacity-60 ${
					canSubmitForApproval
						? "border border-[#cbd9ce] bg-white text-[#164027]"
						: "w-full bg-[#164027] text-white"
				}`}
			>
				{isSubmitting && !isSendingForApproval && <Loader2 className="size-4 animate-spin" />}
				{isSubmitting && !isSendingForApproval ? messages.saving : saveLabel}
			</button>
			{canSubmitForApproval && (
				<button
					type="submit"
					name="routeAction"
					value={ROUTE_SAVE_INTENTS.SUBMIT}
					disabled={isSubmitting}
					className="flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-60"
				>
					{isSendingForApproval ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
					)}
					{isSendingForApproval ? messages.submitting : messages.submit}
				</button>
			)}
		</div>
	);
}
