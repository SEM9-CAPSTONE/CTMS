import { Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS injection metadata
import { DataSource } from "typeorm";
import { BookingCancellationNotice } from "./entities/booking-cancellation-notice.entity";

export const CANCELLATION_NOTICE_LIMIT = 50;

@Injectable()
export class BookingCancellationNoticesService {
	constructor(private readonly dataSource: DataSource) {}

	list(userId: string): Promise<BookingCancellationNotice[]> {
		return this.dataSource.getRepository(BookingCancellationNotice).find({
			where: { recipientId: userId },
			order: { createdAt: "DESC", id: "DESC" },
			take: CANCELLATION_NOTICE_LIMIT,
		});
	}

	async markRead(userId: string, noticeId: string): Promise<void> {
		const result = await this.dataSource
			.getRepository(BookingCancellationNotice)
			.createQueryBuilder()
			.update()
			.set({ readAt: () => 'COALESCE("read_at", CURRENT_TIMESTAMP)' })
			.where("id = :noticeId AND recipient_id = :userId", { noticeId, userId })
			.execute();
		if (!result.affected) throw new NotFoundException("Notification not found");
	}
}
