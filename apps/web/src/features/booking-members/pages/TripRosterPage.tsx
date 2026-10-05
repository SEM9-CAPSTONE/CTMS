import { ArrowLeft } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { TripMemberRoster } from "../components/TripMemberRoster";

export interface TripRosterPageProps {
	tripId: string;
	onBack: () => void;
}

export function TripRosterPage({ tripId, onBack }: TripRosterPageProps) {
	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
			<Button variant="outline" onClick={onBack} className="gap-2">
				<ArrowLeft className="size-4" /> Quay lại bảng điều khiển
			</Button>
			<div className="mt-6">
				<h1 className="text-2xl font-extrabold text-[#10221b]">Điểm danh chuyến đi</h1>
				<p className="mt-2 text-sm text-[#667a6d]">
					Danh sách và trạng thái được tải trực tiếp từ máy chủ.
				</p>
			</div>
			<TripMemberRoster tripId={tripId} />
		</main>
	);
}
