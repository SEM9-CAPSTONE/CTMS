import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Put,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { PushNotificationsService } from "./push-notifications.service";
import { PushPlatform } from "./push-notifications.types";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

export class RegisterPushDeviceDto {
	@ApiProperty({ description: "FCM registration token of this app installation" })
	@IsString()
	@IsNotEmpty()
	@MaxLength(512)
	token!: string;

	@ApiProperty({ enum: PushPlatform })
	@IsEnum(PushPlatform)
	platform!: PushPlatform;
}

export class UnregisterPushDeviceDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(512)
	token!: string;
}

export class PushDeviceResponseDto {
	@ApiProperty({ format: "uuid" }) id!: string;
	@ApiProperty({ enum: PushPlatform }) platform!: PushPlatform;
}

/** CTMS-090: the mobile app registers its push token for the signed-in user. */
@ApiTags("push-notifications")
@ApiBearerAuth()
@Controller("me/push-devices")
@UseGuards(JwtAuthGuard)
export class PushDevicesController {
	constructor(private readonly pushes: PushNotificationsService) {}

	@Put()
	@ApiOperation({
		summary:
			"Register (or refresh) this device's push token for me; a token used by another account on the same phone moves to me",
	})
	@ApiResponse({ status: 200, type: PushDeviceResponseDto })
	async register(
		@Req() req: AuthenticatedRequest,
		@Body() body: RegisterPushDeviceDto
	): Promise<PushDeviceResponseDto> {
		const device = await this.pushes.registerDevice(req.user.userId, body.token, body.platform);
		return { id: device.id, platform: device.platform };
	}

	@Delete()
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Stop pushes to this device (sign-out)" })
	@ApiResponse({ status: 204 })
	@ApiResponse({ status: 404, description: "The token is not registered for me" })
	async unregister(
		@Req() req: AuthenticatedRequest,
		@Body() body: UnregisterPushDeviceDto
	): Promise<void> {
		const removed = await this.pushes.unregisterDevice(req.user.userId, body.token);
		if (!removed) throw new NotFoundException("Push device not found");
	}
}
