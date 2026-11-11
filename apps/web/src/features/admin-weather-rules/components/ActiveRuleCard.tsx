import { CheckCircle2, CloudRain, Eye, ShieldAlert, Thermometer, Wind, Zap } from "lucide-react";
import type { WeatherRiskRuleItem } from "../types";

interface ActiveRuleCardProps {
	activeRule: WeatherRiskRuleItem | null;
}

export function ActiveRuleCard({ activeRule }: ActiveRuleCardProps) {
	if (!activeRule) {
		return (
			<div
				data-testid="no-active-rule-card"
				className="rounded-2xl border border-[#e0ebe0] bg-[#f8faf8] p-6 text-[#10221b] shadow-sm"
			>
				<div className="flex items-center gap-3">
					<ShieldAlert className="size-6 text-[#164027] shrink-0" />
					<div>
						<h3 className="font-extrabold text-base text-[#10221b]">
							Chưa kích hoạt bộ quy tắc rủi ro nào
						</h3>
						<p className="text-sm text-[#54655a] font-medium">
							Hệ thống chưa có bộ quy tắc rủi ro thời tiết nào đang ở trạng thái hoạt động. Hãy chọn
							một phiên bản để kích hoạt.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			data-testid="active-rule-card"
			className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm space-y-5"
		>
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8efe8] pb-4">
				<div className="flex items-center gap-2">
					<h3 className="font-extrabold text-[#10221b] text-lg">
						Bộ quy tắc thời tiết hiện tại (Phiên bản {activeRule.version})
					</h3>
					<span className="inline-flex items-center gap-1 rounded-full bg-[#164027] px-3 py-0.5 text-xs font-bold text-white">
						<CheckCircle2 className="size-3.5" />
						ĐANG ÁP DỤNG
					</span>
				</div>

				<div className="flex items-center gap-2.5 bg-[#f8faf8] px-4 py-2 rounded-xl border border-[#e0ebe0] text-xs font-semibold text-[#10221b]">
					<span className="text-[#54655a]">Thang điểm đánh giá:</span>
					<span>Mức Xanh (≤ {activeRule.greenMaxScore})</span>
					<span className="text-[#9aaba0]">•</span>
					<span>Mức Vàng (≤ {activeRule.yellowMaxScore})</span>
					<span className="text-[#9aaba0]">•</span>
					<span>Mức Đỏ (&gt; {activeRule.yellowMaxScore})</span>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
				{/* Rainfall */}
				<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
					<div className="flex items-center justify-between text-xs font-bold text-[#10221b]">
						<span className="flex items-center gap-1.5 text-[#164027]">
							<CloudRain className="size-4" /> Lượng mưa
						</span>
						<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#164027] border border-[#d2e8d8]">
							{(activeRule.rainfallWeight * 100).toFixed(0)}%
						</span>
					</div>
					<div className="text-xs space-y-1 font-medium text-[#54655a]">
						<div className="flex justify-between">
							<span>Mức Vàng:</span>
							<span className="font-bold text-[#10221b]">
								≥ {activeRule.rainfallYellowThreshold} mm
							</span>
						</div>
						<div className="flex justify-between">
							<span>Mức Đỏ:</span>
							<span className="font-bold text-[#10221b]">
								≥ {activeRule.rainfallRedThreshold} mm
							</span>
						</div>
					</div>
				</div>

				{/* Wind */}
				<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
					<div className="flex items-center justify-between text-xs font-bold text-[#10221b]">
						<span className="flex items-center gap-1.5 text-[#164027]">
							<Wind className="size-4" /> Tốc độ gió
						</span>
						<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#164027] border border-[#d2e8d8]">
							{(activeRule.windWeight * 100).toFixed(0)}%
						</span>
					</div>
					<div className="text-xs space-y-1 font-medium text-[#54655a]">
						<div className="flex justify-between">
							<span>Mức Vàng:</span>
							<span className="font-bold text-[#10221b]">
								≥ {activeRule.windYellowThreshold} km/h
							</span>
						</div>
						<div className="flex justify-between">
							<span>Mức Đỏ:</span>
							<span className="font-bold text-[#10221b]">≥ {activeRule.windRedThreshold} km/h</span>
						</div>
					</div>
				</div>

				{/* Temperature */}
				<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
					<div className="flex items-center justify-between text-xs font-bold text-[#10221b]">
						<span className="flex items-center gap-1.5 text-[#164027]">
							<Thermometer className="size-4" /> Nhiệt độ
						</span>
						<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#164027] border border-[#d2e8d8]">
							{(activeRule.temperatureWeight * 100).toFixed(0)}%
						</span>
					</div>
					<div className="text-xs space-y-1 font-medium text-[#54655a]">
						<div className="flex justify-between">
							<span>Mức Vàng:</span>
							<span className="font-bold text-[#10221b]">
								{activeRule.tempLowYellow}°C - {activeRule.tempHighYellow}°C
							</span>
						</div>
						<div className="flex justify-between">
							<span>Mức Đỏ:</span>
							<span className="font-bold text-[#10221b]">
								&lt;{activeRule.tempLowRed}°C / &gt;{activeRule.tempHighRed}°C
							</span>
						</div>
					</div>
				</div>

				{/* Visibility */}
				<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
					<div className="flex items-center justify-between text-xs font-bold text-[#10221b]">
						<span className="flex items-center gap-1.5 text-[#164027]">
							<Eye className="size-4" /> Tầm nhìn xa
						</span>
						<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#164027] border border-[#d2e8d8]">
							{(activeRule.visibilityWeight * 100).toFixed(0)}%
						</span>
					</div>
					<div className="text-xs space-y-1 font-medium text-[#54655a]">
						<div className="flex justify-between">
							<span>Mức Vàng:</span>
							<span className="font-bold text-[#10221b]">
								≤ {activeRule.visibilityYellowThreshold} m
							</span>
						</div>
						<div className="flex justify-between">
							<span>Mức Đỏ:</span>
							<span className="font-bold text-[#10221b]">
								≤ {activeRule.visibilityRedThreshold} m
							</span>
						</div>
					</div>
				</div>

				{/* Thunderstorm */}
				<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
					<div className="flex items-center justify-between text-xs font-bold text-[#10221b]">
						<span className="flex items-center gap-1.5 text-[#164027]">
							<Zap className="size-4" /> Dông sét
						</span>
						<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#164027] border border-[#d2e8d8]">
							{(activeRule.thunderstormWeight * 100).toFixed(0)}%
						</span>
					</div>
					<div className="text-xs space-y-1 font-medium text-[#54655a]">
						<div className="flex justify-between">
							<span>Mức Vàng:</span>
							<span className="font-bold text-[#10221b]">
								{activeRule.thunderstormYellow ? "Bật" : "Tắt"}
							</span>
						</div>
						<div className="flex justify-between">
							<span>Mức Đỏ:</span>
							<span className="font-bold text-[#10221b]">
								{activeRule.thunderstormRed ? "Bật" : "Tắt"}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
