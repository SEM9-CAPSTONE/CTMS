import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import { UPLOAD_PUBLIC_PREFIX, getUploadRoot } from "../../shared/uploads/upload-paths";
import { INCIDENT_MEDIA_DIRECTORY } from "./incidents.constants";

interface ImageSignature {
	contentType: string;
	extension: string;
	matches: (bytes: Buffer) => boolean;
}

/** BR-224 upload verification: the file content, not the client's declared type, decides. */
const IMAGE_SIGNATURES: readonly ImageSignature[] = [
	{
		contentType: "image/jpeg",
		extension: "jpg",
		matches: (bytes) =>
			bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
	},
	{
		contentType: "image/png",
		extension: "png",
		matches: (bytes) =>
			bytes.length > 8 &&
			bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	},
	{
		contentType: "image/webp",
		extension: "webp",
		matches: (bytes) =>
			bytes.length > 12 &&
			bytes.toString("ascii", 0, 4) === "RIFF" &&
			bytes.toString("ascii", 8, 12) === "WEBP",
	},
];

export interface StoredIncidentMedia {
	url: string;
	contentType: string;
	sizeBytes: number;
}

@Injectable()
export class IncidentMediaStorage {
	/** Returns the verified image type, or null when the bytes are not a supported image. */
	detectImage(bytes: Buffer): ImageSignature | null {
		return IMAGE_SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
	}

	/**
	 * The incident id and content hash keep retries stable and prevent concurrent
	 * uploads with different bytes from overwriting the authoritative image.
	 */
	async save(
		incidentId: string,
		bytes: Buffer,
		signature: ImageSignature
	): Promise<StoredIncidentMedia> {
		const directory = join(getUploadRoot(), INCIDENT_MEDIA_DIRECTORY);
		// Concurrent requests with different bytes cannot overwrite the winning upload.
		const digest = createHash("sha256").update(bytes).digest("hex");
		const fileName = `${incidentId}-${digest}.${signature.extension}`;
		await mkdir(directory, { recursive: true });
		await writeFile(join(directory, fileName), bytes);
		return {
			url: `${UPLOAD_PUBLIC_PREFIX}${INCIDENT_MEDIA_DIRECTORY}/${fileName}`,
			contentType: signature.contentType,
			sizeBytes: bytes.length,
		};
	}
}
