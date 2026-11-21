import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { InAppNotificationDeliveryWorker } from "./in-app-notification-delivery.worker";
import { InAppNotificationsController } from "./in-app-notifications.controller";
import { InAppNotificationsService } from "./in-app-notifications.service";

@Module({
	imports: [RealtimeModule],
	controllers: [InAppNotificationsController],
	providers: [InAppNotificationsService, InAppNotificationDeliveryWorker],
	exports: [InAppNotificationsService],
})
export class InAppNotificationsModule {}
