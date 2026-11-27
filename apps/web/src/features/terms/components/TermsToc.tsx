import type React from "react";
import type { TermsSection } from "../types";

export interface TermsTocProps {
	sections: TermsSection[];
	activeNumber: number;
	onSelectSection: (sectionNumber: number) => void;
}

export const TermsToc: React.FC<TermsTocProps> = ({ sections, activeNumber, onSelectSection }) => {
	return (
		<aside
			aria-label="Mục lục điều khoản"
			className="w-full lg:sticky lg:top-6 lg:w-72 lg:shrink-0"
		>
			{/* Compact selector for small screens */}
			<div className="mb-4 lg:hidden">
				<label
					htmlFor="terms-mobile-toc"
					className="mb-1.5 block text-xs font-semibold tracking-wide text-[#54655a]"
				>
					Chuyển nhanh đến mục
				</label>
				<select
					id="terms-mobile-toc"
					value={activeNumber}
					onChange={(event) => onSelectSection(Number(event.target.value))}
					className="w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10221b] focus:border-[#164027] focus:outline-none"
				>
					{sections.map((section) => (
						<option key={section.number} value={section.number}>
							{section.number}. {section.title}
						</option>
					))}
				</select>
			</div>

			{/* Desktop sticky TOC */}
			<nav className="hidden rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-xs lg:block">
				<h2 className="px-3 pb-3 text-sm font-bold text-[#10221b]">Nội dung</h2>
				<ol className="space-y-1">
					{sections.map((section) => {
						const isActive = section.number === activeNumber;
						return (
							<li key={section.number}>
								<a
									href={`#terms-section-${section.number}`}
									onClick={(event) => {
										event.preventDefault();
										onSelectSection(section.number);
									}}
									aria-current={isActive ? "location" : undefined}
									className={`block rounded-xl px-3 py-2 text-sm transition-colors duration-150 ${
										isActive
											? "bg-[#e8f3eb] font-bold text-[#164027]"
											: "font-medium text-[#425048] hover:bg-[#f4f7f2] hover:text-[#164027]"
									}`}
								>
									{section.number}. {section.title}
								</a>
							</li>
						);
					})}
				</ol>
			</nav>
		</aside>
	);
};
