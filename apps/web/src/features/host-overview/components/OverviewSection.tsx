import type { ReactNode } from "react";
import { cn } from "../../../shared/utils/cn";
import { OVERVIEW_TEXT } from "../constants";
import type { OverviewSection as Section } from "../types";
import { overviewDate } from "../utils";

interface Props<T> {
	title: string;
	section: Section<T>;
	timeZone: string;
	className?: string;
	listClassName?: string;
	emptyMessage?: string;
	showHeading?: boolean;
	surface?: "card" | "plain";
	children: (item: T) => ReactNode;
}
export function OverviewSection<T extends { id: string }>({
	title,
	section,
	timeZone,
	className,
	listClassName,
	emptyMessage,
	showHeading = true,
	surface = "card",
	children,
}: Props<T>) {
	const available = section.availability === "available" && section.data !== null;
	return (
		<section
			aria-label={title}
			className={cn(
				"flex min-w-0 flex-col",
				surface === "card" &&
					"rounded-2xl border border-[#e0e7df] bg-white p-5 shadow-[0_2px_6px_#183a2805]",
				className
			)}
		>
			{showHeading && (
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-base font-bold text-[#10221b]">{title}</h2>
					<span className="rounded-full bg-[#f4f7f2] px-3 py-1 text-sm font-bold text-[#55685a]">
						{available ? section.data?.total.toLocaleString("vi-VN") : "—"}
					</span>
				</div>
			)}
			{!available && (
				<output className="block rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
					{OVERVIEW_TEXT.unavailable}
				</output>
			)}
			{available && section.data?.items.length === 0 && (
				<p className="flex flex-1 items-center justify-center py-6 text-sm text-[#829087]">
					{section.data.total === 0
						? (emptyMessage ?? OVERVIEW_TEXT.empty)
						: OVERVIEW_TEXT.emptyPage}
				</p>
			)}
			{available && section.data && section.data.items.length > 0 && (
				<ul
					tabIndex={section.data && section.data.items.length > 2 ? 0 : undefined}
					aria-label={`Danh sách ${title}`}
					className={cn("divide-y divide-[#edf1ec]", listClassName)}
				>
					{section.data?.items.map((item) => (
						<li
							key={item.id}
							className="min-w-0 space-y-2 py-3 first:pt-0 last:pb-0 [overflow-wrap:anywhere]"
						>
							{children(item)}
						</li>
					))}
				</ul>
			)}
			<p className="mt-auto pt-3 text-[11px] text-[#829087]">
				{OVERVIEW_TEXT.updated}: {overviewDate(section.queriedAt, timeZone)}
			</p>
		</section>
	);
}
