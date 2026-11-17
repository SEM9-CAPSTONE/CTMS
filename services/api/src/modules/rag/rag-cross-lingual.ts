type SupportedLanguage = "vi" | "en";

// Concepts are corroborating signals. Only the original excerpt can support the answer.
const CONCEPTS: ReadonlyArray<Record<SupportedLanguage, readonly string[]>> = [
	{
		vi: ["sấm sét", "sét đánh", "tránh sét", "chống sét", "tia sét"],
		en: ["lightning", "lightning strike"],
	},
	{
		vi: ["mưa dông", "giông bão", "dông bão", "trời có dông"],
		en: ["thunderstorm", "thunderstorms", "thunder"],
	},
	{ vi: ["lũ quét", "lũ đột ngột"], en: ["flash flood", "flash floods", "flash flooding"] },
	{
		vi: ["sạt lở đất", "sạt lở", "lở đất", "trượt đất"],
		en: ["landslide", "landslides", "debris flow", "debris flows", "mudslide"],
	},
	{ vi: ["đá rơi", "đá lăn"], en: ["rockfall", "rock fall", "falling rocks"] },
	{ vi: ["trú ẩn", "chỗ trú", "nơi trú"], en: ["shelter", "shelters", "take cover", "seek cover"] },
	{ vi: ["sơ tán", "di dời"], en: ["evacuate", "evacuation", "relocate immediately"] },
	{
		vi: ["bản đồ", "bản đồ địa hình"],
		en: ["map", "maps", "topographic map", "topographical map"],
	},
	{ vi: ["la bàn"], en: ["compass", "compasses"] },
	{
		vi: ["lạc đường", "bị lạc", "mất phương hướng"],
		en: [
			"get lost",
			"getting lost",
			"are lost",
			"become lost",
			"becomes lost",
			"lost hiker",
			"lost hikers",
			"went off trail",
		],
	},
	{ vi: ["còi", "thổi còi"], en: ["whistle", "whistles"] },
	{
		vi: ["lều trại", "dựng lều", "cắm trại"],
		en: ["tent", "tents", "campsite", "campsites", "camping"],
	},
	{
		vi: ["nước uống", "nước sạch", "lọc nước", "nước an toàn"],
		en: ["drinking water", "water purification", "potable water", "filter water", "safe water"],
	},
	{ vi: ["mất nước", "thiếu nước"], en: ["dehydration", "dehydrated"] },
	{ vi: ["hạ thân nhiệt"], en: ["hypothermia"] },
	{ vi: ["kiệt sức do nóng", "kiệt sức vì nóng"], en: ["heat exhaustion"] },
	{
		vi: ["sốc nhiệt", "say nắng", "đột quỵ do nóng"],
		en: ["heat stroke", "heatstroke", "sunstroke"],
	},
	{
		vi: ["bong gân", "trẹo cổ chân", "lật cổ chân"],
		en: ["sprain", "sprains", "sprained ankle", "twisted ankle"],
	},
	{ vi: ["gãy xương"], en: ["fracture", "fractures", "broken bone", "broken bones"] },
	{
		vi: ["chảy máu", "xuất huyết", "cầm máu"],
		en: ["bleeding", "blood loss", "hemorrhage", "haemorrhage"],
	},
	{
		vi: ["rắn cắn"],
		en: ["snake bite", "snake bites", "snakebite", "snakebites", "bitten by a snake"],
	},
	{ vi: ["cháy rừng"], en: ["wildfire", "wildfires", "forest fire", "forest fires"] },
];

export function baseLanguage(locale: string): string {
	return locale.split("-")[0];
}

function supported(language: string): language is SupportedLanguage {
	return language === "vi" || language === "en";
}

function phraseText(text: string): string {
	return ` ${text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
		.trim()} `;
}

function containsAlias(text: string, aliases: readonly string[]): boolean {
	return aliases.some((alias) => text.includes(` ${alias} `));
}

/** Require corroboration for each recognized topic in the original passage body, not just a heading. */
export function crossLingualCorroboration(question: string, questionLanguage: string) {
	const normalized = phraseText(question);
	const concepts = supported(questionLanguage)
		? CONCEPTS.filter((concept) => containsAlias(normalized, concept[questionLanguage]))
		: [];
	return (content: string, sourceLanguage: string): boolean => {
		if (!concepts.length || !supported(sourceLanguage)) return false;
		const passage = phraseText(content);
		return concepts.every((concept) => containsAlias(passage, concept[sourceLanguage]));
	};
}
