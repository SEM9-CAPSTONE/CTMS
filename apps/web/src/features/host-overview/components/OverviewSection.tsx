import type { ReactNode } from "react";
import { OVERVIEW_TEXT } from "../constants";
import type { OverviewSection as Section } from "../types";
import { overviewDate } from "../utils";

interface Props<T> {
	title: string;
	section: Section<T>;
	timeZone: string;
	children: (item: T) => ReactNode;
}
export function OverviewSection<T extends { id: string }>({
	title,
	section,
	timeZone,
	children,
}: Props<T>) {
	const available = section.availability === "available" && section.data !== null;
	return (
		<section
			aria-label={title}
			className="min-w-0 rounded-[28px] border border-[#dfe8df] bg-white p-5 shadow-sm"
		>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-lg font-extrabold text-[#10221b]">{title}</h2>
				<span className="rounded-full bg-[#f4f7f2] px-3 py-1 text-sm font-bold text-[#55685a]">
					{available ? section.data?.total.toLocaleString("vi-VN") : "—"}
				</span>
			</div>
			{!available && (
				<output className="block rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
					{OVERVIEW_TEXT.unavailable}
				</output>
			)}
			{available && section.data?.items.length === 0 && (
				<p className="py-3 text-sm text-[#627769]">
					{section.data.total === 0 ? OVERVIEW_TEXT.empty : OVERVIEW_TEXT.emptyPage}
				</p>
			)}
			{available && (
				<ul className="divide-y divide-[#edf3ed]">
					{section.data?.items.map((item) => (
						<li key={item.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
							{children(item)}
						</li>
					))}
				</ul>
			)}
			<p className="mt-4 text-xs text-[#627769]">
				{OVERVIEW_TEXT.updated}: {overviewDate(section.queriedAt, timeZone)}
			</p>
		</section>
	);
}
