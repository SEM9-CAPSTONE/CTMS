import { Star } from "lucide-react";
import { type ReviewReputation, reputationText } from "./reputation";

export function ReputationSummary({ value }: { value?: ReviewReputation }) {
	if (value === undefined) return null;
	const text = reputationText(value);
	return (
		<p
			role="img"
			aria-label={text.accessible}
			className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold text-[#42594b]"
		>
			<Star aria-hidden="true" className="size-4 shrink-0 text-amber-700" />
			<span aria-hidden="true">{text.visible}</span>
		</p>
	);
}
