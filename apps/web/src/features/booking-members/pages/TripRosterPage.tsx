import { ArrowLeft } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { TripMemberRoster } from "../components/TripMemberRoster";

export interface TripRosterPageProps {
	tripId: string;
	onBack: () => void;
	backLabel?: string;
}

export function TripRosterPage({ tripId, onBack, backLabel }: TripRosterPageProps) {
	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
			<Button variant="outline" onClick={onBack} className="gap-2">
				<ArrowLeft className="size-4" /> {backLabel ?? "Quay lại bảng điều khiển"}
			</Button>
			<div className="mt-6">
				<h1 className="text-2xl font-extrabold text-[#10221b]">Điểm danh chuyến đi</h1>
				<p className="mt-2 text-sm text-[#667a6d]">
					Danh sách và trạng thái được tải trực tiếp từ máy chủ.
				</p>
				<p className="mt-1 text-xs font-semibold text-[#7b8c82]">Mã chuyến đi: {tripId}</p>
			</div>
			<TripMemberRoster tripId={tripId} />
		</main>
	);
}
