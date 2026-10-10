import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Pagination } from "../../../shared/components/Pagination";
import {
	AVAILABLE_PORTERS_DEFAULT_LIMIT,
	AVAILABLE_PORTERS_DEFAULT_PAGE,
	mapAvailablePortersError,
	useAvailablePorters,
} from "../hooks/useAvailablePorters";
import type { IntendedPorterRole } from "../types";
import { AvailablePorterCard } from "./AvailablePorterCard";

interface AvailablePortersResultsProps {
	tripId: string;
	role: IntendedPorterRole;
	minExperienceYears?: number;
}

export function AvailablePortersResults({
	tripId,
	role,
	minExperienceYears,
}: AvailablePortersResultsProps) {
	const [page, setPage] = useState(AVAILABLE_PORTERS_DEFAULT_PAGE);
	const query = useAvailablePorters({
		tripId,
		role,
		minExperienceYears,
		page,
		limit: AVAILABLE_PORTERS_DEFAULT_LIMIT,
	});
	const errorState = query.error ? mapAvailablePortersError(query.error) : null;

	useEffect(() => {
		if (query.data && query.data.items.length === 0 && page > query.data.pagination.totalPages) {
			setPage(Math.max(AVAILABLE_PORTERS_DEFAULT_PAGE, query.data.pagination.totalPages));
		}
	}, [page, query.data]);

	if (query.isPending || query.isFetching) {
		return (
			<output className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#f8faf8] p-5 text-xs font-bold text-[#164027]">
				<Loader2 className="size-4 animate-spin" />
				Đang kiểm tra Porter phù hợp...
			</output>
		);
	}

	if (errorState) {
		return (
			<div
				role="alert"
				data-error-kind={errorState.kind}
				className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
			>
				<div className="flex items-start gap-2">
					<AlertTriangle className="size-4 shrink-0" />
					<p className="font-bold">{errorState.message}</p>
				</div>
				{errorState.canRetry && (
					<Button
						size="sm"
						variant="outline"
						className="mt-3 gap-2"
						onClick={() => void query.refetch()}
					>
						<RefreshCw className="size-3.5" />
						Thử lại
					</Button>
				)}
			</div>
		);
	}

	if (!query.data || query.data.items.length === 0) {
		return (
			<div
				data-testid="available-porters-empty"
				className="mt-5 rounded-2xl border border-dashed border-[#cbd9cd] bg-[#f8faf8] p-5 text-center"
			>
				<p className="text-sm font-extrabold text-[#10221b]">Không có Porter phù hợp</p>
				<p className="mt-1 text-xs leading-5 text-[#667a6d]">
					Hiện chưa có Porter khớp với chuyến đi và bộ lọc này. Hãy thử vai trò khác hoặc giảm mức
					kinh nghiệm.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-5 space-y-3">
			<p className="text-xs font-bold text-[#667a6d]">
				Tìm thấy {query.data.pagination.total} Porter
			</p>
			{query.data.items.map((porter) => (
				<AvailablePorterCard key={porter.porterId} porter={porter} role={role} />
			))}
			<Pagination
				currentPage={query.data.pagination.page}
				totalPages={query.data.pagination.totalPages}
				totalItems={query.data.pagination.total}
				itemsPerPage={query.data.pagination.limit}
				onPageChange={setPage}
			/>
		</div>
	);
}
