import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GpsTrackingModule } from "../gps-tracking/gps-tracking.module";
import { UsersModule } from "../users/users.module";
import { FcmPushSender, UnconfiguredPushSender } from "./fcm-push.sender";
import { PushDeliveryWorker } from "./push-delivery.worker";
import { PushDevicesController } from "./push-devices.controller";
import { PushNotificationsRepository } from "./push-notifications.repository";
import { PushNotificationsService } from "./push-notifications.service";
import {
	PUSH_PREFERENCES,
	PUSH_SENDER,
	type PushPreferenceSource,
	type PushSender,
} from "./push-notifications.types";

/** Until CTMS-091 stores user choices, every ordinary category is on (PD-3). */
const allowAllPreferences: PushPreferenceSource = { allows: async () => true };

function createSender(config: ConfigService): PushSender {
	const projectId = config.get<string>("FCM_PROJECT_ID")?.trim();
	const clientEmail = config.get<string>("FCM_CLIENT_EMAIL")?.trim();
	const privateKey = config.get<string>("FCM_PRIVATE_KEY")?.trim();
	if (!projectId || !clientEmail || !privateKey) return new UnconfiguredPushSender();
	return new FcmPushSender({ projectId, clientEmail, privateKey });
}

@Module({
	imports: [UsersModule, GpsTrackingModule],
	controllers: [PushDevicesController],
	providers: [
		PushNotificationsRepository,
		PushNotificationsService,
		PushDeliveryWorker,
		{ provide: PUSH_SENDER, inject: [ConfigService], useFactory: createSender },
		{ provide: PUSH_PREFERENCES, useValue: allowAllPreferences },
	],
	exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
