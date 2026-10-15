export interface BankAccountItem {
	id: string;
	userId: string;
	bankName: string;
	accountNumber: string;
	accountHolderName: string;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateBankAccountInput {
	bankName: string;
	accountNumber: string;
	accountHolderName: string;
	isDefault?: boolean;
}
