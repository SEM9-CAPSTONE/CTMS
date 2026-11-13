import { departureReasonLabel } from "../copy";
import { useDepartureStatus } from "../hooks/useDepartureInbox";

/** Owner-only placement; authoritative gate state is independent of inbox read state. */
export function DepartureBlockStatus({
	actor,
	trip,
	tripStatus,
}: { actor: string; trip: string; tripStatus?: string }) {
	const status = useDepartureStatus(actor, trip);
	if (
		[tripStatus, status.data?.tripStatus].some(
			(value) => value === "cancelled" || value === "completed"
		)
	)
		return null;
	if (status.isError) return <p role="alert">Chưa kiểm tra được trạng thái khởi hành.</p>;
	if (!status.data?.blocked) return null;
	return (
		<section
			data-testid="departure-block-status"
			className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4"
		>
			<h2 className="font-bold">Chưa sẵn sàng khởi hành</h2>
			<p>{departureReasonLabel(status.data.reasonCode ?? "")}</p>
		</section>
	);
}
