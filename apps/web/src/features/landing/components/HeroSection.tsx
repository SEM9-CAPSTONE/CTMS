import { ArrowRight, Sparkles } from "lucide-react";
import type React from "react";
import { HERO_BADGES } from "../constants";

export const HeroSection: React.FC = () => {
	return (
		<section className="mb-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
			<div>
				<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#276143]/15 bg-[#276143]/8 px-4 py-2 text-xs font-bold text-[#276143]">
					<Sparkles size={15} />
					<span>Sẵn sàng cho mọi hành trình cắm trại và trekking</span>
				</div>
				<h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight text-[#10221b] sm:text-4xl md:text-5xl">
					Hệ thống quản lý và vận hành thông minh cho người dựng lều, Host và Trekker.
				</h1>
				<p className="mb-7 max-w-[600px] text-base leading-relaxed text-[#425048] sm:text-lg">
					Tích hợp AI, bản đồ ngoại tuyến và cứu hộ thông minh. Tối ưu hoá lộ trình, giám sát thời
					tiết, điều phối đội nhóm và kết nối liên tục với CTMS.
				</p>

				<div className="mb-8 flex flex-wrap gap-3.5">
					<button
						type="button"
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1c442f] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#143323] hover:shadow-md"
					>
						Khám phá ngay <ArrowRight size={18} />
					</button>
					<button
						type="button"
						className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#dfe8df] bg-white px-6 py-3.5 text-sm font-semibold text-[#10221b] transition hover:-translate-y-0.5 hover:bg-[#f7faf6]"
					>
						Tìm tour thêm
					</button>
				</div>

				<div className="grid max-w-[460px] grid-cols-2 gap-3">
					{HERO_BADGES.map((badge) => {
						const Icon = badge.icon;
						return (
							<div
								key={badge.label}
								className="flex items-center gap-2.5 rounded-xl bg-[#276143]/6 px-4 py-3 text-sm font-bold text-[#276143]"
							>
								<Icon size={16} />
								<span>{badge.label}</span>
							</div>
						);
					})}
				</div>
			</div>

			<div className="relative">
				<div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[#1c442f]/10">
					<div className="absolute top-5 left-5 z-10 flex items-center gap-2 rounded-full bg-white/94 px-4 py-2 text-xs font-medium text-[#10221b] shadow-md backdrop-blur-md">
						<span className="h-2 w-2 rounded-full bg-[#2e7d32]" />
						Trạng thái: <strong className="font-bold">Còn 12 chỗ trống</strong>
					</div>
					<img
						className="h-[380px] w-full object-cover"
						src="/figma_assets/hero_image.png"
						alt="Sơ đồ khu cắm trại từ Figma"
					/>
					<div className="flex items-center justify-between bg-white p-6">
						<div>
							<strong className="block text-base font-bold text-[#10221b]">
								Trại nghỉ Bầu Ngư
							</strong>
							<p className="mt-0.5 text-xs text-[#425048]">Chặng 3 | 12 phút trước</p>
						</div>
						<div className="rounded-full bg-[#e8f5e9] px-3.5 py-1.5 text-xs font-bold text-[#2e7d32]">
							Trực tuyến
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
