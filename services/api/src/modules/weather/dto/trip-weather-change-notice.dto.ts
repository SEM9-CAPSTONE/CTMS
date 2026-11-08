import { ApiProperty } from "@nestjs/swagger";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import type { TripWeatherChangeNoticeRow } from "../repositories/trip-weather-change-notices.repository";

export class TripWeatherChangeNoticeDto {
	@ApiProperty() id!: string;
	@ApiProperty() tripId!: string;
	@ApiProperty({ description: "Forecast row that introduced the new level" }) forecastId!: string;
	@ApiProperty() tripTitle!: string;
	@ApiProperty() tripStartsAt!: Date;
	@ApiProperty({ enum: RiskLevel }) previousRiskLevel!: RiskLevel;
	@ApiProperty({ enum: RiskLevel }) riskLevel!: RiskLevel;
	@ApiProperty({ description: "true when the level got worse (e.g. Green → Red)" })
	worsened!: boolean;
	@ApiProperty({ description: "Ready-to-show Vietnamese message" }) message!: string;
	@ApiProperty({ nullable: true, type: Date }) readAt!: Date | null;
	@ApiProperty() createdAt!: Date;
}

export class TripWeatherChangeNoticeListDto {
	@ApiProperty({ type: [TripWeatherChangeNoticeDto] }) items!: TripWeatherChangeNoticeDto[];
	@ApiProperty() unreadCount!: number;
}

const LEVEL_RANK: Record<RiskLevel, number> = {
	[RiskLevel.GREEN]: 0,
	[RiskLevel.YELLOW]: 1,
	[RiskLevel.RED]: 2,
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
	[RiskLevel.GREEN]: "Xanh",
	[RiskLevel.YELLOW]: "Vàng",
	[RiskLevel.RED]: "Đỏ",
};

/** "17/11" in Vietnam time, the timezone every CTMS Trip runs in. */
function vietnamDay(date: Date): string {
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "Asia/Ho_Chi_Minh",
	})
		.format(new Date(date))
		.replace("-", "/");
}

/** Policy §4 wording: an early warning when the forecast worsens, reassurance when it improves. */
export function weatherChangeMessage(
	previous: RiskLevel,
	current: RiskLevel,
	tripStartsAt: Date
): string {
	const day = vietnamDay(tripStartsAt);
	const levels = `${LEVEL_LABEL[previous]} → ${LEVEL_LABEL[current]}`;
	return LEVEL_RANK[current] > LEVEL_RANK[previous]
		? `Cảnh báo sớm: dự báo ngày ${day} xấu đi (${levels}), đang theo dõi.`
		: `Dự báo ngày ${day} đã cải thiện (${levels}).`;
}

export function toTripWeatherChangeNoticeDto(
	row: TripWeatherChangeNoticeRow
): TripWeatherChangeNoticeDto {
	return {
		id: row.id,
		tripId: row.tripId,
		forecastId: row.forecastId,
		tripTitle: row.tripTitle,
		tripStartsAt: row.tripStartsAt,
		previousRiskLevel: row.previousRiskLevel,
		riskLevel: row.riskLevel,
		worsened: LEVEL_RANK[row.riskLevel] > LEVEL_RANK[row.previousRiskLevel],
		message: weatherChangeMessage(row.previousRiskLevel, row.riskLevel, row.tripStartsAt),
		readAt: row.readAt,
		createdAt: row.createdAt,
	};
}
