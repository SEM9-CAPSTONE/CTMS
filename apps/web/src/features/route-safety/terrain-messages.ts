// This app uses feature-local message dictionaries; keep both languages together.
export const terrainMessages = {
	vi: {
		warning: "Thời lượng dự kiến có thể quá ngắn cho tuyến đã vẽ.",
		minimum: (minutes: number) => `Thời lượng di chuyển phải từ ${minutes} phút.`,
	},
	en: {
		warning: "The planned duration may be too short for the drawn route.",
		minimum: (minutes: number) => `Moving duration must be at least ${minutes} minutes.`,
	},
} as const;
