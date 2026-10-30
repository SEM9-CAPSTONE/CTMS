import type { RouteCheckpoint } from "../types";
import {
	type PreviewBounds,
	checkpointDescription,
	checkpointMarkerColor,
	checkpointMarkerLabel,
	fallbackCoordinate,
} from "../utils/route-preview";
interface Props {
	checkpoint: RouteCheckpoint;
	index: number;
	bounds: PreviewBounds;
}
export function RoutePreviewCheckpoint({ checkpoint, index, bounds }: Props) {
	const [x, y] = fallbackCoordinate(checkpoint.location.coordinates, bounds);
	const description = checkpointDescription(checkpoint);
	const shelter = checkpoint.type === "emergency_shelter";
	return (
		<g
			key={checkpoint.id}
			data-testid={`route-preview-checkpoint-${checkpoint.id}`}
			data-checkpoint-type={checkpoint.type}
			aria-label={description}
		>
			<title>{description}</title>
			{shelter ? (
				<rect
					x={x - 3}
					y={y - 3}
					width="6"
					height="6"
					rx="0.8"
					fill={checkpointMarkerColor(checkpoint.type)}
					stroke="white"
					strokeWidth="0.6"
				/>
			) : (
				<circle
					cx={x}
					cy={y}
					r="3"
					fill={checkpointMarkerColor(checkpoint.type)}
					stroke="white"
					strokeWidth="0.6"
				/>
			)}
			<text x={x} y={y + 1.1} textAnchor="middle" fontSize="3.2" fontWeight="800" fill="white">
				{checkpointMarkerLabel(checkpoint, index)}
			</text>
		</g>
	);
}
