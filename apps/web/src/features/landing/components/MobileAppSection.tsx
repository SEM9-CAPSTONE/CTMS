import type React from "react";

export const MobileAppSection: React.FC = () => {
	return (
		<section className="mb-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
			<div className="flex justify-center">
				<div className="w-full max-w-[460px] overflow-hidden rounded-[48px] border-[10px] border-[#283a2e] bg-white shadow-2xl shadow-black/25 sm:max-w-[500px] lg:max-w-[540px]">
					<img
						src="/figma_assets/mobile_app.png"
						alt="Giao diện ứng dụng di động CTMS từ Figma"
						className="block h-auto w-full object-cover transition-transform duration-500 hover:scale-105"
					/>
				</div>
			</div>
			<div>
				<span className="mb-2 block text-xs font-extrabold uppercase tracking-widest text-[#276143]">
					ỨNG DỤNG DI ĐỘNG
				</span>
				<h2 className="mb-3.5 text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
					Mang CTMS theo bạn trong mọi chuyến đi
				</h2>
				<p className="mb-5 text-base text-[#425048]">
					Ứng dụng di động giúp bạn theo dõi lộ trình, kiểm tra an toàn và nhận hướng dẫn khẩn cấp
					ngay cả khi mất sóng.
				</p>
				<div className="my-5 flex flex-wrap gap-2.5">
					<div className="rounded-full bg-[#eef7f0] px-4 py-2 text-sm font-bold text-[#276143]">
						📱 Dữ liệu Ngoại tuyến
					</div>
					<div className="rounded-full bg-[#eef7f0] px-4 py-2 text-sm font-bold text-[#276143]">
						🗺️ Lịch trình hành trình
					</div>
					<div className="rounded-full bg-[#eef7f0] px-4 py-2 text-sm font-bold text-[#276143]">
						⚠️ Cảnh báo vị trí
					</div>
					<div className="rounded-full bg-[#eef7f0] px-4 py-2 text-sm font-bold text-[#276143]">
						📊 Nhật ký hành trình
					</div>
				</div>
				<div className="flex gap-3.5">
					<button
						type="button"
						className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#dfe8df] bg-white px-6 py-3.5 text-sm font-semibold text-[#10221b] transition hover:bg-[#f7faf6]"
					>
						Tải trên Google Play
					</button>
					<button
						type="button"
						className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#dfe8df] bg-white px-6 py-3.5 text-sm font-semibold text-[#10221b] transition hover:bg-[#f7faf6]"
					>
						Tải trên App Store
					</button>
				</div>
			</div>
		</section>
	);
};
