import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { EmergencyAssessment } from "./emergency-safety-engine";

export const MAX_EMERGENCY_CONTEXT_LENGTH = 2048;

function contextKey(secret: string) {
	return createHmac("sha256", secret).update("ctms-075-conversation-context-v1").digest();
}

// The client keeps the latest opaque context in memory for a single conversation.
// No transcript, coordinates or requests are added to server persistence.
export function sealEmergencyContext(
	userId: string,
	assessment: EmergencyAssessment,
	secret = process.env.JWT_SECRET
) {
	if (!secret) return null;
	const nonce = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", contextKey(secret), nonce);
	cipher.setAAD(Buffer.from(userId));
	const ciphertext = Buffer.concat([cipher.update(JSON.stringify(assessment)), cipher.final()]);
	return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function openEmergencyContext(
	userId: string,
	token: string,
	secret = process.env.JWT_SECRET
): EmergencyAssessment | null {
	if (!secret || token.length > MAX_EMERGENCY_CONTEXT_LENGTH || !/^[\w-]+$/.test(token))
		return null;
	try {
		const bytes = Buffer.from(token, "base64url");
		if (bytes.length <= 28 || bytes.toString("base64url") !== token) return null;
		const decipher = createDecipheriv("aes-256-gcm", contextKey(secret), bytes.subarray(0, 12));
		decipher.setAAD(Buffer.from(userId));
		decipher.setAuthTag(bytes.subarray(12, 28));
		const text = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
		const assessment = JSON.parse(text.toString("utf8")) as EmergencyAssessment;
		return ["WARNING", "EMERGENCY"].includes(assessment.severity) ? assessment : null;
	} catch {
		return null;
	}
}
