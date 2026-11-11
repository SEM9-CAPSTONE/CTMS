import { CheckCircle2, MapPin } from "lucide-react";
import type React from "react";
import { SAFETY_CHECKLIST } from "../constants";

export const SafetySection: React.FC = () => {
	return (
		<section className="mb-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
			<div>
				<div className="relative h-[380px] overflow-hidden rounded-3xl bg-[#1c442f] shadow-xl">
					<img
						src="/figma_assets/safety_map.png"
						alt="Bản đồ địa hình an toàn từ Figma"
						className="h-full w-full object-cover"
					/>
					<div className="absolute top-7 left-7 z-10 flex items-center gap-2 rounded-full bg-white/95 px-4.5 py-2.5 text-xs font-extrabold text-[#d32f2f] shadow-lg backdrop-blur-md">
						<MapPin size={24} />
						<span>Vị trí hiện tại</span>
					</div>
					<div className="absolute right-7 bottom-7 z-10 rounded-full bg-[#d32f2f] px-4.5 py-2 text-xs font-bold text-white shadow-md">
						Tự động kích hoạt SOS: Sẵn sàng
					</div>
				</div>
			</div>
			<div>
				<span className="mb-3 block text-xs font-extrabold uppercase tracking-widest text-[#276143]">
					AN TOÀN LÀ TRÊN HẾT
				</span>
				<h2 className="mb-4 text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
					Hệ thống hỗ trợ an toàn toàn diện cho người đi trek & host
				</h2>
				<div className="my-7 grid gap-3.5">
					{SAFETY_CHECKLIST.map((item) => (
						<div
							className="flex items-center gap-3 text-base font-semibold text-[#10221b]"
							key={item}
						>
							<CheckCircle2 size={20} className="shrink-0 text-[#1c442f]" />
							<span>{item}</span>
						</div>
					))}
				</div>
				<button
					type="button"
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1c442f] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143323]"
				>
					Khám phá tính năng an toàn
				</button>
			</div>
		</section>
	);
};
