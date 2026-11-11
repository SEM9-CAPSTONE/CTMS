import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { ConfigService } from "@nestjs/config";
import { type UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { UPLOAD_PUBLIC_PREFIX, getUploadRoot } from "../../shared/uploads/upload-paths";
import type { UploadImageResponseDto } from "./dto/upload-image-response.dto";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PDF_MIME_TYPE = "application/pdf";
const PDF_SIGNATURE = Buffer.from("%PDF-");

type StoredResourceType = "image" | "raw";

@Injectable()
export class UploadsService {
	private readonly logger = new Logger(UploadsService.name);
	private readonly isCloudinaryConfigured: boolean;

	constructor(private readonly configService: ConfigService) {
		const cloudName = this.configService.get<string>("CLOUDINARY_CLOUD_NAME")?.trim();
		const apiKey = this.configService.get<string>("CLOUDINARY_API_KEY")?.trim();
		const apiSecret = this.configService.get<string>("CLOUDINARY_API_SECRET")?.trim();

		if (cloudName && apiKey && apiSecret) {
			cloudinary.config({
				cloud_name: cloudName,
				api_key: apiKey,
				api_secret: apiSecret,
				secure: true,
			});
			this.isCloudinaryConfigured = true;
			this.logger.log(`Cloudinary storage initialized for cloud: ${cloudName}`);
		} else {
			this.isCloudinaryConfigured = false;
			this.logger.warn(
				"Cloudinary credentials missing in environment. Falling back to local disk storage."
			);
		}
	}

	async uploadImage(file?: Express.Multer.File, folder = "ctms"): Promise<UploadImageResponseDto> {
		if (!file) {
			throw new BadRequestException("Vui lòng chọn file hình ảnh");
		}

		if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
			throw new BadRequestException(
				"Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP hoặc GIF."
			);
		}

		if (this.isCloudinaryConfigured) {
			return this.uploadToCloudinary(file, folder, "image");
		}

		return this.uploadToLocalDisk(file, folder, "img");
	}

	/**
	 * Stores a supporting document (JPG/PNG/WEBP image or PDF). PDFs go to
	 * Cloudinary as `raw` resources because image-type PDF delivery is commonly
	 * blocked on Cloudinary accounts.
	 */
	async uploadDocument(
		file?: Express.Multer.File,
		folder = "ctms"
	): Promise<UploadImageResponseDto> {
		if (!file) {
			throw new BadRequestException("Vui lòng chọn file tài liệu");
		}

		const isPdf = file.mimetype === PDF_MIME_TYPE;
		if (!isPdf && !DOCUMENT_IMAGE_MIME_TYPES.has(file.mimetype)) {
			throw new BadRequestException(
				"Định dạng tài liệu không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP hoặc PDF."
			);
		}
		if (isPdf && !file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
			throw new BadRequestException("File PDF không hợp lệ");
		}

		if (this.isCloudinaryConfigured) {
			return this.uploadToCloudinary(file, folder, isPdf ? "raw" : "image");
		}

		return this.uploadToLocalDisk(file, folder, "doc");
	}

	/** Reserve a deterministic storage location before I/O, allowing durable orphan cleanup. */
	prepareTripImage(file: Express.Multer.File): {
		url: string;
		key?: string;
		upload: () => Promise<UploadImageResponseDto>;
	} {
		const id = randomUUID();
		if (this.isCloudinaryConfigured) {
			const key = `trips/${id}`;
			return {
				url: `https://res.cloudinary.com/${this.configService.get<string>("CLOUDINARY_CLOUD_NAME")?.trim()}/image/upload/${key}`,
				key,
				upload: () => this.uploadToCloudinary(file, "trips", "image", id),
			};
		}
		const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[
			file.mimetype
		];
		if (!extension) throw new BadRequestException("Unsupported Trip image type");
		const name = `img-${id}.${extension}`;
		const base =
			this.configService.get<string>("API_PUBLIC_URL") ??
			`http://localhost:${this.configService.get<string>("API_PORT") ?? "3000"}`;
		const url = `${base}${UPLOAD_PUBLIC_PREFIX}trips/${name}`;
		return {
			url,
			upload: async () => {
				const directory = join(getUploadRoot(), "trips");
				mkdirSync(directory, { recursive: true });
				await writeFile(join(directory, name), file.buffer);
				return { url };
			},
		};
	}

	async deleteStoredImage(url: string, key?: string | null): Promise<void> {
		let storageKey = key;
		// Recover provider identity for existing Trip covers created before the image table.
		if (!storageKey && this.isCloudinaryConfigured) {
			const legacy =
				/^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:v[0-9]+\/)?(trips\/[^?#]+)\.[a-zA-Z0-9]+$/.exec(
					url
				);
			if (legacy && legacy[1] === this.configService.get<string>("CLOUDINARY_CLOUD_NAME")?.trim())
				storageKey = legacy[2];
		}
		if (storageKey) {
			if (!storageKey.startsWith("trips/")) return;
			const result = await cloudinary.uploader.destroy(storageKey, { invalidate: true });
			if (result.result !== "ok" && result.result !== "not found")
				throw new Error("Image storage deletion failed");
			return;
		}
		const base =
			this.configService.get<string>("API_PUBLIC_URL") ??
			`http://localhost:${this.configService.get<string>("API_PORT") ?? "3000"}`;
		const parsed = new URL(url, base);
		if (parsed.origin !== new URL(base).origin) return;
		const pathname = parsed.pathname;
		const match = /^\/uploads\/trips\/(img-[a-zA-Z0-9.-]+)$/.exec(pathname);
		if (!match) return;
		try {
			await unlink(join(getUploadRoot(), "trips", match[1]));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}

	private uploadToCloudinary(
		file: Express.Multer.File,
		folder: string,
		resourceType: StoredResourceType,
		publicId?: string
	): Promise<UploadImageResponseDto> {
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					folder,
					...(publicId ? { public_id: publicId } : {}),
					resource_type: resourceType,
					// Raw resources keep no format, so the extension must be part of the id
					// for the delivered file to be served with the right content type.
					...(resourceType === "raw" ? { public_id: `doc-${uniqueSuffix()}.pdf` } : {}),
				},
				(error, result: UploadApiResponse | undefined) => {
					if (error || !result) {
						this.logger.error("Cloudinary upload failed", error);
						const detail = error?.message ? `: ${error.message}` : "";
						return reject(new BadRequestException(`Tải ảnh lên Cloudinary thất bại${detail}`));
					}

					resolve({
						url: result.secure_url,
						key: result.public_id,
					});
				}
			);

			Readable.from(file.buffer).pipe(uploadStream);
		});
	}

	private uploadToLocalDisk(
		file: Express.Multer.File,
		folder: string,
		filePrefix: string
	): UploadImageResponseDto {
		const targetDir = join(getUploadRoot(), folder);
		mkdirSync(targetDir, { recursive: true });

		const ext = extname(file.originalname).toLowerCase() || ".jpg";
		const fileName = `${filePrefix}-${uniqueSuffix()}${ext}`;
		const filePath = join(targetDir, fileName);

		writeFileSync(filePath, file.buffer);

		const baseUrl =
			this.configService.get<string>("API_PUBLIC_URL") ??
			`http://localhost:${this.configService.get<string>("API_PORT") ?? "3000"}`;

		return {
			url: `${baseUrl}${UPLOAD_PUBLIC_PREFIX}${folder}/${fileName}`,
		};
	}
}

function uniqueSuffix(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
