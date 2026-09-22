import { TripFilterBar } from "../components/TripFilterBar";
import { TripList } from "../components/TripList";
import { useSearchTrips } from "../hooks/useSearchTrips";
import type { SearchTripsQuery, TrekkingRouteDifficulty, TripType } from "../types";

export interface SearchTripsPageProps {
	onBackHome?: () => void;
	onNavigateToTripDetail: (tripId: string) => void;
	initialFilters?: SearchTripsQuery;
}

interface CategoryOption {
	id: string;
	label: string;
	filters: Partial<SearchTripsQuery>;
	isActive: (q: SearchTripsQuery) => boolean;
}

const CATEGORIES: CategoryOption[] = [
	{
		id: "all",
		label: "Tất cả chuyến đi",
		filters: { tripType: undefined, difficulty: undefined },
		isActive: (q) => !q.tripType && !q.difficulty,
	},
	{
		id: "day_trip",
		label: "Trong ngày",
		filters: { tripType: "day_trip" as TripType, difficulty: undefined },
		isActive: (q) => q.tripType === "day_trip",
	},
	{
		id: "overnight",
		label: "Qua đêm",
		filters: { tripType: "overnight" as TripType, difficulty: undefined },
		isActive: (q) => q.tripType === "overnight",
	},
	{
		id: "easy",
		label: "Dễ & Thư giãn",
		filters: { tripType: undefined, difficulty: "easy" as TrekkingRouteDifficulty },
		isActive: (q) => q.difficulty === "easy",
	},
	{
		id: "hard",
		label: "Thử thách",
		filters: { tripType: undefined, difficulty: "hard" as TrekkingRouteDifficulty },
		isActive: (q) => q.difficulty === "hard" || q.difficulty === "expert",
	},
];

export function SearchTripsPage({ onNavigateToTripDetail, initialFilters }: SearchTripsPageProps) {
	const {
		query,
		items,
		pagination,
		isLoading,
		error,
		updateFilters,
		setPage,
		retry,
		resetFilters,
	} = useSearchTrips({ initialQuery: initialFilters });

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			<main className="flex-1 p-4 sm:p-6 lg:p-8">
				<div className="mx-auto flex max-w-[1440px] flex-col gap-6">
					{/* Khối 1: Hero Canvas Cover Panel với ảnh người leo núi & sắc xanh lá nhẹ dịu mắt */}
					<section className="relative overflow-hidden rounded-[28px] border border-[#dfe8df] bg-[#163323] text-white shadow-sm motion-safe:animate-in motion-safe:fade-in duration-700">
						{/* Ảnh nền người đang leo núi trên thảo nguyên xanh mướt */}
						<div
							className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out hover:scale-105"
							style={{
								backgroundImage:
									"url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=2000&q=80')",
							}}
						/>
						{/* Lớp phủ gradient xanh lá dịu mắt, hòa quyện tự nhiên với phong cảnh */}
						<div className="absolute inset-0 bg-gradient-to-t from-[#11261b]/85 via-[#1a3d2b]/45 to-black/20" />

						{/* Nội dung bên trong Hero */}
						<div className="relative z-10 flex flex-col justify-center p-8 sm:p-10 md:p-12 min-h-[200px] sm:min-h-[240px]">
							<div className="max-w-3xl">
								<h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
									Khám phá chuyến đi
								</h1>
								<p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[#e0f0e3] sm:text-base">
									Hành trình trekking & dã ngoại kết nối những tâm hồn yêu thiên nhiên. Thức dậy
									giữa rừng thông, săn mây trên đỉnh núi và tận hưởng không khí trong lành.
								</p>
							</div>
						</div>
					</section>

					{/* Khối 2: Category Quick Filter Tags */}
					<section className="rounded-[24px] border border-[#dfe8df] bg-white p-4 shadow-sm sm:px-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-700">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-xs font-extrabold uppercase tracking-wider text-[#7b8c82] mr-1">
								Phân loại:
							</span>
							{CATEGORIES.map((cat) => {
								const active = cat.isActive(query);
								return (
									<button
										key={cat.id}
										type="button"
										onClick={() => updateFilters(cat.filters)}
										className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
											active
												? "bg-[#164027] text-white shadow-sm shadow-[#164027]/20"
												: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7] hover:text-[#164027]"
										}`}
									>
										<span>{cat.label}</span>
									</button>
								);
							})}
						</div>
					</section>

					{/* Khối 3: Bộ lọc & Tìm kiếm Panel (Giữ nguyên toàn bộ logic) */}
					<div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-700">
						<TripFilterBar
							currentFilters={query}
							onFilterChange={updateFilters}
							onReset={resetFilters}
						/>
					</div>

					{/* Khối 4: Danh sách Chuyến đi Panel với hiệu ứng xuất hiện */}
					<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-700">
						<div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
							<h2 className="text-lg font-extrabold text-[#10221b]">Danh sách hành trình</h2>
							<span className="text-xs font-semibold text-[#667a6d]">
								{pagination
									? `Hiển thị ${items.length} trên tổng số ${pagination.total} chuyến đi`
									: ""}
							</span>
						</div>

						<TripList
							items={items}
							pagination={pagination}
							isLoading={isLoading}
							error={error}
							onRetry={retry}
							onSelectTrip={onNavigateToTripDetail}
							onPageChange={setPage}
						/>
					</section>
				</div>
			</main>
		</div>
	);
}
