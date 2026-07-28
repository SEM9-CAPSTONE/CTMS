import type React from "react";
import { MAIN_FEATURES } from "../constants";

export const MainFeaturesSection: React.FC = () => {
	return (
		<section className="mb-16">
			<div className="mx-auto mb-10 max-w-[760px] text-center">
				<p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#276143]">
					TÍNH NĂNG THÔNG MINH ĐỘT PHÁ
				</p>
				<h2 className="text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
					Tận hưởng hành trình trọn vẹn với các công cụ hỗ trợ chuyên nghiệp được thiết kế riêng cho
					điều kiện tại Việt Nam.
				</h2>
			</div>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{MAIN_FEATURES.map((feat) => {
					const Icon = feat.icon;
					return (
						<article
							className="rounded-3xl border border-[#dfe8df] bg-white p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#c5d9c7] hover:shadow-md"
							key={feat.title}
						>
							<div className="mb-4.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#1c442f]">
								<Icon size={22} />
							</div>
							<h3 className="mb-2.5 text-lg font-extrabold text-[#10221b]">{feat.title}</h3>
							<p className="text-sm leading-relaxed text-[#425048]">{feat.description}</p>
						</article>
					);
				})}
			</div>
		</section>
	);
};
