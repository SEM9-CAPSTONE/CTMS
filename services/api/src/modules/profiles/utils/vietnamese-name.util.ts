/**
 * Normalizes Vietnamese names for consistent accent-insensitive comparison:
 * 1. Normalize NFD diacritics and strip accents: /[\u0300-\u036f]/g -> ""
 * 2. Convert đ/Đ -> d/D
 * 3. Trim and uppercase
 * 4. Collapse multiple spaces into a single space
 */
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

/**
 * BR-351: Beneficiary bank account holder name MUST strictly match
 * the user's registered full name in the system.
 * Returns true if both normalized names are identical and non-empty.
 */
export function validateAccountHolderNameMatch(
	registeredFullName: string | null | undefined,
	accountHolderName: string | null | undefined
): boolean {
	if (!registeredFullName || !registeredFullName.trim()) {
		return false;
	}
	if (!accountHolderName || !accountHolderName.trim()) {
		return false;
	}

	const normalizedRegistered = normalizeVietnameseName(registeredFullName);
	const normalizedAccount = normalizeVietnameseName(accountHolderName);

	return normalizedRegistered === normalizedAccount;
}
