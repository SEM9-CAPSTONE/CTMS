export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhoneNumber(phone: string): boolean {
	return /^(0[3|5|7|8|9])+([0-9]{8})$/.test(phone.trim());
}

export function formatAuthIdentifier(input: string): string {
	return input.trim().toLowerCase();
}
