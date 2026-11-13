import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import type { GetPerformanceReportQueryDto } from "./dto/get-performance-report-query.dto";
import type { PerformanceReportResponseDto } from "./dto/performance-report-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import {
	PerformanceReportsRepository,
	type ReportUserScope,
} from "./performance-reports.repository";

@Injectable()
export class PerformanceReportsService {
	constructor(private readonly repository: PerformanceReportsRepository) {}

	async getPerformanceReport(
		user: AuthenticatedUser,
		query: GetPerformanceReportQueryDto
	): Promise<PerformanceReportResponseDto> {
		// 1. Validate role & scope (BR-211, PB AC-2)
		const isAdmin = user.roles.includes(UserRole.ADMIN);
		const isHost = user.roles.includes(UserRole.HOST);

		if (!isAdmin && !isHost) {
			throw new ForbiddenException({
				statusCode: 403,
				error: "FORBIDDEN",
				message: "Chỉ Quản trị viên (Admin) hoặc Đối tác (Host) mới có quyền xem báo cáo hiệu suất",
			});
		}

		// Validate custom date boundaries if provided
		if (query.from && query.to) {
			const fromDate = new Date(query.from);
			const toDate = new Date(query.to);
			if (fromDate.getTime() > toDate.getTime()) {
				throw new BadRequestException({
					statusCode: 400,
					error: "INVALID_DATE_RANGE",
					message: "Ngày bắt đầu không được lớn hơn ngày kết thúc",
				});
			}
		}

		// 2. Define data authorization scope:
		// - Admin views all system-wide data
		// - Host views only trips/bookings under their ownership
		const scope: ReportUserScope = isAdmin
			? { role: "admin" }
			: { role: "host", hostId: user.userId };

		// 3. Delegate to repository
		return this.repository.generateReport(query, scope);
	}
}
