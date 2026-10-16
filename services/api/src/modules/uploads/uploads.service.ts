import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { type UploadApiResponse, v2 as cloudinary } from "cloudinary";
import { UPLOAD_PUBLIC_PREFIX, getUploadRoot } from "../../shared/uploads/upload-paths";
import type { UploadImageResponseDto } from "./dto/upload-image-response.dto";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
			return this.uploadToCloudinary(file, folder);
		}

		return this.uploadToLocalDisk(file, folder);
	}

	private uploadToCloudinary(
		file: Express.Multer.File,
		folder: string
	): Promise<UploadImageResponseDto> {
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					folder,
					resource_type: "image",
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

	private uploadToLocalDisk(file: Express.Multer.File, folder: string): UploadImageResponseDto {
		const targetDir = join(getUploadRoot(), folder);
		mkdirSync(targetDir, { recursive: true });

		const ext = extname(file.originalname).toLowerCase() || ".jpg";
		const safeSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const fileName = `img-${safeSuffix}${ext}`;
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
