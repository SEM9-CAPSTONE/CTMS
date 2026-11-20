import { RoutePath } from "../../../routes/routes.config";
import { Button } from "../../../shared/components/Button";
import { SettingsTabEnum } from "../../camper-profile/enums/settings-tab.enum";

export function HealthConsentRequired({ onRetry }: { onRetry?: () => void }) {
	return (
		<section className="space-y-4 py-6" aria-label="Cần cho phép chia sẻ hồ sơ sức khỏe">
			<h3 className="text-base font-bold text-[#10221b]">Cần cho phép chia sẻ hồ sơ sức khỏe</h3>
			<p className="text-sm text-[#667a6d]">
				Vào Hồ sơ → Sức khỏe và thể lực, cập nhật thông tin và bật chia sẻ để hệ thống có thể phân
				tích và gợi ý chuyến đi.
			</p>
			<div className="flex flex-wrap items-center gap-3">
				<a
					className="text-sm font-semibold text-[#164027] underline"
					href={`${RoutePath.CAMPER_PROFILE}?tab=${SettingsTabEnum.HEALTH_FITNESS}`}
				>
					Mở hồ sơ sức khỏe
				</a>
				{onRetry && (
					<Button variant="outline" onClick={onRetry}>
						Kiểm tra lại quyền chia sẻ
					</Button>
				)}
			</div>
		</section>
	);
}
