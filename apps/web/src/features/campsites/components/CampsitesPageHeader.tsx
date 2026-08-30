import { Tent } from "lucide-react";

/**
 * CTMS-17-T02 / DG-W2 (frozen): a new, minimal header owned by this
 * feature -- not a reuse of CamperHeader/CamperSidebar (built for the
 * tabbed Settings page, not a browse/search layout) or a revival of the
 * unused AppSidebar/AppLayout.
 */
export function CampsitesPageHeader() {
	return (
		<header className="border-b border-[#e0ebe0] bg-white">
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-2.5">
					<Tent className="size-6 text-[#164027]" />
					<h1 className="text-lg font-extrabold text-[#10221b]">Tìm kiếm Khu cắm trại</h1>
				</div>
			</div>
		</header>
	);
}
