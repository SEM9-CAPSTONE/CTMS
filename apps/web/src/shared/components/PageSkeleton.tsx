/** Lightweight fallback shared by route chunks; keep feature dependencies out. */
export function PageSkeleton() {
	return (
		<div aria-busy="true" className="min-h-screen bg-[#f4f7f2] p-6 sm:p-10">
			<div
				aria-hidden="true"
				className="mx-auto max-w-6xl animate-pulse motion-reduce:animate-none"
			>
				<div className="mb-10 h-12 w-32 rounded-lg bg-slate-200" />
				<div className="mb-4 h-8 w-2/3 rounded-lg bg-slate-200" />
				<div className="mb-8 h-4 w-1/2 rounded bg-slate-200" />
				<div className="h-80 rounded-2xl bg-slate-200" />
			</div>
		</div>
	);
}
