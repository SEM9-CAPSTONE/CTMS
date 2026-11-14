/** Hide old internal references while leaving the recorded financial history untouched. */
export function formatWalletDescription(description: string): string {
	return description
		.replace("Rút toàn bộ số dư ví mẫu", "Rút toàn bộ số dư ví")
		.replace(/ - (?:Booking|Payout) [\da-f]{8}:/gi, ":")
		.replace(/\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi, "[tham chiếu nội bộ]");
}
