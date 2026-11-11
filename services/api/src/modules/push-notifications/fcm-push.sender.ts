import { createSign } from "node:crypto";
import type { PushMessage, PushSendResult, PushSender } from "./push-notifications.types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const REQUEST_TIMEOUT_MS = 10_000;
/** Refresh the OAuth token a minute before Google says it expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface FcmCredentials {
	projectId: string;
	clientEmail: string;
	/** PEM private key of the service account; `\n` escapes from env files are accepted. */
	privateKey: string;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function base64Url(value: string | Buffer): string {
	return Buffer.from(value).toString("base64url");
}

/** Signed service-account assertion for the OAuth 2.0 JWT bearer grant (RFC 7523). */
export function signServiceAccountJwt(credentials: FcmCredentials, now: Date): string {
	const issuedAt = Math.floor(now.getTime() / 1000);
	const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const claims = base64Url(
		JSON.stringify({
			iss: credentials.clientEmail,
			scope: MESSAGING_SCOPE,
			aud: TOKEN_URL,
			iat: issuedAt,
			exp: issuedAt + 3600,
		})
	);
	const signer = createSign("RSA-SHA256");
	signer.update(`${header}.${claims}`);
	const signature = signer.sign(credentials.privateKey.replace(/\\n/g, "\n"));
	return `${header}.${claims}.${base64Url(signature)}`;
}

/** FCM error code from a v1 error body (`details[].errorCode`, then `status`). */
function fcmErrorCode(body: unknown): string {
	const error = (body as { error?: { status?: string; details?: Array<{ errorCode?: string }> } })
		?.error;
	const detail = error?.details?.find((item) => typeof item?.errorCode === "string")?.errorCode;
	return detail ?? error?.status ?? "UNKNOWN";
}

/**
 * Firebase Cloud Messaging HTTP v1 sender (Technical Design for CTMS-090). Never reports success
 * unless FCM accepted the message (BR-197); timeouts and 429/5xx are retryable, an unregistered
 * token disables the device, other 4xx are permanent.
 */
export class FcmPushSender implements PushSender {
	readonly configured = true;
	private accessToken: { value: string; expiresAt: number } | null = null;

	constructor(
		private readonly credentials: FcmCredentials,
		private readonly fetchImpl: FetchLike = fetch,
		private readonly now: () => Date = () => new Date()
	) {}

	async send(message: PushMessage): Promise<PushSendResult> {
		let token: string;
		try {
			token = await this.oauthToken();
		} catch (error) {
			return { ok: false, unregistered: false, retryable: true, error: describe(error) };
		}

		let response: Response;
		try {
			response = await this.fetchImpl(
				`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.credentials.projectId)}/messages:send`,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
					body: JSON.stringify({ message: this.toFcm(message) }),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				}
			);
		} catch (error) {
			return { ok: false, unregistered: false, retryable: true, error: describe(error) };
		}
		if (response.ok) return { ok: true };

		const body = await response.json().catch(() => null);
		const code = fcmErrorCode(body);
		if (response.status === 401) this.accessToken = null;
		if (code === "UNREGISTERED" || response.status === 404) {
			return { ok: false, unregistered: true, error: `FCM ${response.status} ${code}` };
		}
		const retryable = response.status === 401 || response.status === 429 || response.status >= 500;
		return { ok: false, unregistered: false, retryable, error: `FCM ${response.status} ${code}` };
	}

	private toFcm(message: PushMessage) {
		return {
			token: message.token,
			notification: { title: message.title, body: message.body },
			data: message.data,
			android: { priority: message.highPriority ? "HIGH" : "NORMAL" },
			apns: { headers: { "apns-priority": message.highPriority ? "10" : "5" } },
		};
	}

	private async oauthToken(): Promise<string> {
		const now = this.now();
		if (this.accessToken && this.accessToken.expiresAt > now.getTime()) {
			return this.accessToken.value;
		}
		const response = await this.fetchImpl(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion: signServiceAccountJwt(this.credentials, now),
			}).toString(),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const body = (await response.json().catch(() => null)) as {
			access_token?: string;
			expires_in?: number;
		} | null;
		if (!response.ok || !body?.access_token) {
			throw new Error(`OAuth token request failed with ${response.status}`);
		}
		this.accessToken = {
			value: body.access_token,
			expiresAt: now.getTime() + (body.expires_in ?? 3600) * 1000 - TOKEN_REFRESH_MARGIN_MS,
		};
		return body.access_token;
	}
}

/** Used until the leader provides a Firebase project: nothing is sent and nothing is faked. */
export class UnconfiguredPushSender implements PushSender {
	readonly configured = false;
	async send(): Promise<PushSendResult> {
		return {
			ok: false,
			unregistered: false,
			retryable: false,
			error: "Push provider not configured",
		};
	}
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
