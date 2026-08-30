import type React from "react";
import { FEATURED_DESTINATIONS } from "../constants";

interface FeaturedLocationsSectionProps {
	items?: typeof FEATURED_DESTINATIONS;
}

export const FeaturedLocationsSection: React.FC<FeaturedLocationsSectionProps> = ({
	items = FEATURED_DESTINATIONS,
}) => {
	return (
		<section className="mb-16">
			{items.length === 0 ? (
				<div className="rounded-3xl border border-dashed border-[#dfe8df] bg-white p-12 text-center text-sm font-bold text-[#54655a]">
					Không tìm thấy địa điểm nào phù hợp với bộ lọc của bạn.
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{items.map((dest) => (
						<article
							className="group overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-md shadow-[#1c442f]/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#1c442f]/12"
							key={dest.title}
						>
							<div className="relative h-50">
								<img
									className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
									src={dest.image}
									alt={dest.title}
								/>
								<span className="absolute top-3.5 right-3.5 rounded-full bg-white/94 px-3 py-1 text-xs font-extrabold text-[#d87d05] shadow-sm backdrop-blur-sm">
									★ {dest.rating}
								</span>
							</div>
							<div className="p-5">
								<h3 className="mb-1 text-lg font-extrabold text-[#10221b]">{dest.title}</h3>
								<p className="mb-3.5 text-xs font-medium text-[#425048]">📍 {dest.location}</p>
								<div className="mb-4 flex flex-wrap gap-1.5">
									<span className="rounded-lg bg-[#eef7f0] px-2.5 py-1 text-xs font-bold text-[#276143]">
										{dest.weatherBadge}
									</span>
									<span className="rounded-lg bg-[#f4f6f4] px-2.5 py-1 text-xs font-bold text-[#425048]">
										{dest.statusBadge}
									</span>
								</div>
								<div className="flex items-center justify-between border-t border-dashed border-[#dfe8df] pt-3.5">
									<span className="text-base font-extrabold text-[#1c442f]">{dest.price}</span>
									<button
										type="button"
										className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#dfe8df] bg-white px-4 py-2 text-xs font-bold text-[#10221b] transition hover:bg-[#f7faf6]"
									>
										Đặt ngay
									</button>
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
};
