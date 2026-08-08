import type { UserGender } from "../users/entities/user.entity";

export interface ProfileSnapshot extends Record<string, unknown> {
	fullName: string | null;
	dateOfBirth: string | null;
	gender: UserGender | null;
	address: string | null;
	bio: string | null;
	emergencyContacts: EmergencyContactSnapshot[];
}

export interface EmergencyContactSnapshot extends Record<string, unknown> {
	name: string;
	relationship: string;
	phone: string;
	email: string | null;
}
