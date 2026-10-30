import { safetyText as t } from "../messages";
import type { LiveSafetySource, RouteSafetyResult } from "../types";

interface Props {
	source: RouteSafetyResult["liveSource"];
	sources?: LiveSafetySource[];
	onRetry: () => void;
}

const time = (value: string) =>
	new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function LiveSafetyStatus({ source, sources, onRetry }: Props) {
	const items: LiveSafetySource[] = sources ?? [
		source ?? {
			source: "NCHMF",
			status: "UNAVAILABLE",
			checkedAt: "",
			dataTime: null,
			validUntil: null,
		},
	];
	return (
		<div className="mt-2 rounded-lg border bg-white p-3">
			{items.map((item) => (
				<div
					key={item.source}
					className="mb-2"
					role={item.status === "LIVE" || item.status === "LOADING" ? "status" : "alert"}
				>
					<p>
						{item.source === "NCHMF"
							? t.liveSource[item.status]
							: t.contextSource[item.source][item.status]}
					</p>
					{item.checkedAt && (
						<p className="mt-1 text-xs">
							{t.sourceCheckedAt}: {time(item.checkedAt)}
						</p>
					)}
					{item.dataTime && (
						<p className="mt-1 text-xs">
							{t.sourceDataTime}: {time(item.dataTime)}
						</p>
					)}
					{item.validUntil && (
						<p className="mt-1 text-xs">
							{t.sourceValidUntil}: {time(item.validUntil)}
						</p>
					)}
				</div>
			))}
			<button type="button" onClick={onRetry} className="mt-2 font-bold underline">
				{t.retry}
			</button>
		</div>
	);
}
