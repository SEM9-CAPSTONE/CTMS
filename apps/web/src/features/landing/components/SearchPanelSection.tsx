import { Calendar, ChevronRight, Compass, MapPin, Search, Users } from "lucide-react";
import type React from "react";

export const SearchPanelSection: React.FC = () => {
	return (
		<section className="mb-12 rounded-3xl border border-[#dfe8df] bg-white p-8 shadow-xl shadow-[#1c442f]/5">
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#276143]">
						Điểm đến nổi bật
					</p>
					<h2 className="text-2xl font-extrabold tracking-tight text-[#10221b]">
						Những cung đường và bãi cắm được yêu thích nhất tháng này
					</h2>
				</div>
				<a
					href="/campsites"
					onClick={(e) => {
						e.preventDefault();
						window.history.pushState({}, "", "/campsites");
						window.dispatchEvent(new PopStateEvent("popstate"));
					}}
					className="inline-flex items-center gap-1 text-sm font-bold text-[#276143] hover:underline"
				>
					Xem tất cả <ChevronRight size={16} className="inline ml-1" />
				</a>
			</div>

			<div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto]">
				<div className="flex flex-col gap-2">
					<label className="text-xs font-bold text-[#425048]">Địa điểm</label>
					<div className="flex h-13 items-center gap-2.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-4">
						<MapPin size={18} className="shrink-0 text-[#276143]" />
						<input
							type="text"
							defaultValue="Đà Nẵng, Việt Nam"
							placeholder="Nhập địa điểm..."
							className="w-full bg-transparent text-sm text-[#10221b] outline-none"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<label className="text-xs font-bold text-[#425048]">Ngày đi</label>
					<div className="flex h-13 items-center gap-2.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-4">
						<Calendar size={18} className="shrink-0 text-[#276143]" />
						<input
							type="text"
							defaultValue="dd/mm/yyyy"
							className="w-full bg-transparent text-sm text-[#10221b] outline-none"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<label className="text-xs font-bold text-[#425048]">Số người</label>
					<div className="flex h-13 items-center gap-2.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-4">
						<Users size={18} className="shrink-0 text-[#276143]" />
						<select
							defaultValue="1-2"
							className="w-full bg-transparent text-sm text-[#10221b] outline-none"
						>
							<option value="1-2">1-2 người</option>
							<option value="3-5">3-5 người</option>
							<option value="6+">6+ người</option>
						</select>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<label className="text-xs font-bold text-[#425048]">Loại hình</label>
					<div className="flex h-13 items-center gap-2.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-4">
						<Compass size={18} className="shrink-0 text-[#276143]" />
						<select
							defaultValue="cam-trai"
							className="w-full bg-transparent text-sm text-[#10221b] outline-none"
						>
							<option value="cam-trai">Cắm trại</option>
							<option value="trekking">Trekking</option>
							<option value="combo">Combo Lều & Tour</option>
						</select>
					</div>
				</div>
				<button
					type="button"
					onClick={() => {
						window.history.pushState({}, "", "/campsites");
						window.dispatchEvent(new PopStateEvent("popstate"));
					}}
					className="mt-auto inline-flex h-13 min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1c442f] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143323]"
				>
					<Search size={18} /> Tìm kiếm
				</button>
			</div>
		</section>
	);
};
