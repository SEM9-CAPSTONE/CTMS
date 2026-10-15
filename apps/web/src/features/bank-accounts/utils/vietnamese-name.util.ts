export function normalizeVietnameseName(name: string): string {
	return (
		name
			.normalize("NFD")
			// biome-ignore lint/suspicious/noMisleadingCharacterClass: standard regex for stripping NFD Unicode diacritics
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
			.trim()
			.toUpperCase()
			.replace(/\s+/g, " ")
	);
}

export function validateAccountHolderNameMatch(
	accountHolderName: string,
	userFullName: string
): boolean {
	if (!accountHolderName || !userFullName) return false;
	return normalizeVietnameseName(accountHolderName) === normalizeVietnameseName(userFullName);
}
