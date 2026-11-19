/** Hide old internal references while leaving the recorded financial history untouched. */
export function formatWalletDescription(description: string, tripTitle?: string | null): string {
	return description
		.replace("Rút toàn bộ số dư ví mẫu", "Rút toàn bộ số dư ví")
		.replace(
			/(chuyến(?: đi)?)\s*(?::\s*#?|#)\s*(?:[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}|[\da-f]{8})(?![\da-f-])/gi,
			(_reference, label: string) =>
				`${label}: ${tripTitle?.trim() || "Chưa có thông tin chuyến đi"}`
		)
		.replace(/ - (?:Booking|Payout) [\da-f]{8}:/gi, ":")
		.replace(/\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi, "[tham chiếu nội bộ]");
}
