import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { UsersModule } from "../users/users.module";
import { FcmPushSender, UnconfiguredPushSender } from "./fcm-push.sender";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { PushDeliveryWorker } from "./push-delivery.worker";
import { PushDevicesController } from "./push-devices.controller";
import { PushNotificationsRepository } from "./push-notifications.repository";
import { PushNotificationsService } from "./push-notifications.service";
import { PUSH_PREFERENCES, PUSH_SENDER, type PushSender } from "./push-notifications.types";

function createSender(config: ConfigService): PushSender {
	const projectId = config.get<string>("FCM_PROJECT_ID")?.trim();
	const clientEmail = config.get<string>("FCM_CLIENT_EMAIL")?.trim();
	const privateKey = config.get<string>("FCM_PRIVATE_KEY")?.trim();
	if (!projectId || !clientEmail || !privateKey) return new UnconfiguredPushSender();
	return new FcmPushSender({ projectId, clientEmail, privateKey });
}

@Module({
	imports: [UsersModule, GpsTrackingModule],
	controllers: [PushDevicesController, NotificationPreferencesController],
	providers: [
		PushNotificationsRepository,
		PushNotificationsService,
		PushDeliveryWorker,
		NotificationPreferencesService,
		{ provide: PUSH_SENDER, inject: [ConfigService], useFactory: createSender },
		{ provide: PUSH_PREFERENCES, useExisting: NotificationPreferencesService },
	],
	exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
