import { terrainMessages } from "../terrain-messages";

export function RouteDurationAdvice({
	invalid,
	minimumMinutes,
	language = "vi",
}: { invalid: boolean; minimumMinutes: number; language?: keyof typeof terrainMessages }) {
	if (!invalid) return null;
	return (
		<span role="alert" className="mt-1 block text-xs font-normal text-red-600">
			{terrainMessages[language].minimum(minimumMinutes)}
		</span>
	);
}
