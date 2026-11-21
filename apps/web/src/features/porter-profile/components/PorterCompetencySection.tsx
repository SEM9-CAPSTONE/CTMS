import { GlobalLevelRequestPanel } from "../../porter-levels/components/GlobalLevelRequestPanel";

export function PorterCompetencySection() {
	return (
		<section
			data-testid="porter-competency-section"
			className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs"
		>
			<GlobalLevelRequestPanel />
		</section>
	);
}
