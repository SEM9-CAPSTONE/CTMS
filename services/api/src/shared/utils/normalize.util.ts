const VN_MOBILE_LOCAL_REGEX = /^0(3|5|7|8|9)\d{8}$/;
export const VN_MOBILE_E164_REGEX = /^\+84(3|5|7|8|9)\d{8}$/;

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

export function normalizeVietnamPhone(value: string): string {
	const trimmed = value.trim();

	if (VN_MOBILE_LOCAL_REGEX.test(trimmed)) {
		return `+84${trimmed.slice(1)}`;
	}

	return trimmed;
}
