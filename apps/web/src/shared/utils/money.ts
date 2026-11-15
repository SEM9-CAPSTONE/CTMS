const vndFormatter = new Intl.NumberFormat("vi-VN", {
	style: "currency",
	currency: "VND",
	maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("vi-VN", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/** Formats an amount in Vietnamese đồng, for example "1.250.000 ₫". */
export function formatVnd(value: number): string {
	return vndFormatter.format(value);
}

/** Short axis label, for example "1,3 Tr". */
export function formatVndCompact(value: number): string {
	return compactFormatter.format(value);
}
