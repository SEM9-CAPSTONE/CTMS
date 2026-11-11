export function formatPrice(amount: number, unit?: string): string {
	if (amount === 0) return "Miễn phí";
	const formatted = new Intl.NumberFormat("vi-VN").format(amount);
	return unit ? `${formatted} VNĐ / ${unit}` : `${formatted} VNĐ`;
}

export function cleanPromptText(prompt: string): string {
	return prompt.replace(/[“”"]/g, "").trim();
}

export function filterDestinations<T extends { title: string; location: string }>(
	items: T[],
	query: string
): T[] {
	const q = query.toLowerCase().trim();
	if (!q) return items;
	return items.filter(
		(item) => item.title.toLowerCase().includes(q) || item.location.toLowerCase().includes(q)
	);
}
