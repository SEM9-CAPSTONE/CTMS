export const TRIP_ACTIVITIES = [
	{ code: "cloud_hunting", label: "Săn mây" },
	{ code: "sunrise_sunset", label: "Ngắm bình minh, hoàng hôn" },
	{ code: "coast", label: "Khám phá biển" },
	{ code: "forest", label: "Khám phá rừng" },
	{ code: "waterfall_stream", label: "Thác, suối" },
	{ code: "camping", label: "Cắm trại" },
	{ code: "mountain_climbing", label: "Leo núi" },
	{ code: "stargazing", label: "Ngắm sao" },
	{ code: "photography", label: "Chụp ảnh" },
] as const;
export const TRIP_ACTIVITY_CODES = TRIP_ACTIVITIES.map((item) => item.code);
export type TripActivity = (typeof TRIP_ACTIVITIES)[number]["code"];
