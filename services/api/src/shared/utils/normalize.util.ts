const VN_MOBILE_LOCAL_REGEX = /^0(3|5|7|8|9)\d{8}$/;
export const VN_MOBILE_E164_REGEX = /^\+84(3|5|7|8|9)\d{8}$/;

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

/**
 * Every stored form one Vietnamese mobile number may have. Registration saves the
 * E.164 form (`+849…`), but seed and older rows keep the local form (`09…`), so a
 * lookup by phone has to match both or those accounts cannot sign in by phone.
 */
export function vietnamPhoneLookupForms(value: string): string[] {
	const normalized = normalizeVietnamPhone(value);
	if (!VN_MOBILE_E164_REGEX.test(normalized)) return [normalized];
	return [normalized, `0${normalized.slice(3)}`];
}

export function normalizeVietnamPhone(value: string): string {
	const trimmed = value.trim();

	if (VN_MOBILE_LOCAL_REGEX.test(trimmed)) {
		return `+84${trimmed.slice(1)}`;
	}

	return trimmed;
}
