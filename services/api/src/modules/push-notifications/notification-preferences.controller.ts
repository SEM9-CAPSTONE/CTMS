import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsInt,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { NotificationPreferencesService } from "./notification-preferences.service";

export class NotificationPreferenceChangeDto {
	@ApiProperty()
	@IsString()
	@MaxLength(40)
	category!: string;

	@ApiProperty()
	@IsBoolean()
	enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
	@ApiProperty({ minimum: 0, maximum: 2147483646 })
	@IsInt()
	@Min(0)
	@Max(2147483646)
	version!: number;

	@ApiProperty({ type: [NotificationPreferenceChangeDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(5)
	@ValidateNested({ each: true })
	@Type(() => NotificationPreferenceChangeDto)
	changes!: NotificationPreferenceChangeDto[];
}

@ApiTags("notification-preferences")
@ApiBearerAuth()
@Controller("notification-preferences")
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
	constructor(private readonly preferences: NotificationPreferencesService) {}

	@Get()
	@ApiOperation({ summary: "Read my push notification preferences and server-defined categories" })
	get(@Req() request: { user: AuthenticatedUser }) {
		return this.preferences.get(request.user.userId);
	}

	@Patch()
	@ApiOperation({
		summary: "Atomically update my push preferences using the current collection version",
	})
	patch(
		@Req() request: { user: AuthenticatedUser },
		@Body() body: UpdateNotificationPreferencesDto
	) {
		return this.preferences.patch(request.user.userId, body.version, body.changes);
	}
}
