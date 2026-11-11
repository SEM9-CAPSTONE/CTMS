import { type PorterTripPhase, porterTripPhaseLabels } from "../utils/porter-assignment";

const phaseClasses: Record<PorterTripPhase, string> = {
	upcoming: "bg-sky-50 text-sky-800 ring-sky-200",
	ongoing: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	finished: "bg-[#f1f4f1] text-[#55685a] ring-[#dfe8df]",
};

export function PorterTripPhaseBadge({ phase }: { phase: PorterTripPhase }) {
	return (
		<span
			className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${phaseClasses[phase]}`}
		>
			{porterTripPhaseLabels[phase]}
		</span>
	);
}
