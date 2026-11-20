import { ShieldCheck } from "lucide-react";
import { PorterLevelRequestsPanel } from "../../porter-levels/components/PorterLevelRequestsPanel";

export function PorterCompetencySection() {
	return (
		<section
			data-testid="porter-competency-section"
			className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs"
		>
			<div className="border-b border-[#dfe8df] pb-4">
				<div className="flex items-center gap-2">
					<ShieldCheck className="size-5 text-[#164027]" />
					<h2 className="text-base font-bold text-[#10221b]">Yêu cầu nâng cấp cấp độ</h2>
				</div>
				<p className="mt-1 text-xs text-[#627769]">
					Theo dõi trạng thái xét duyệt và gửi yêu cầu nâng cấp cấp độ tới Quản trị viên.
				</p>
			</div>

			<div className="mt-4">
				<PorterLevelRequestsPanel />
			</div>
		</section>
	);
}
