import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
export function RequiredFieldMark() {
	return (
		<span aria-hidden="true" className="ml-1 text-red-600">
			*
		</span>
	);
}
export function TripFormSection({
	title,
	icon: Icon,
	children,
}: { title: string; icon: LucideIcon; children: ReactNode }) {
	return (
		<section
			aria-label={title}
			className="min-w-0 rounded-xl border border-[#e5ece7] bg-[#fafcfb] p-3 sm:p-4"
		>
			<h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#10221b]">
				<span className="flex size-8 items-center justify-center rounded-lg bg-[#e6f2ea] text-[#167347]">
					<Icon className="size-4" aria-hidden="true" />
				</span>
				{title}
			</h3>
			{children}
		</section>
	);
}
