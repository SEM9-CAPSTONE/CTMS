/** Where Hosts transfer a weather penalty the settlements did not cover (policy §6). */
export interface PlatformPaymentAccount {
	bankName: string;
	accountNumber: string;
	accountHolderName: string;
}

export interface PlatformBankAccount extends PlatformPaymentAccount {
	purpose: "weather_penalty";
	updatedAt: string;
	updatedByName: string | null;
}

export interface PlatformBankAccountResponse {
	account: PlatformBankAccount | null;
}

export type PlatformBankAccountInput = PlatformPaymentAccount;
