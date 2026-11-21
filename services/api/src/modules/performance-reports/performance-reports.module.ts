import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PerformanceReportsController } from "./performance-reports.controller";
import { PerformanceReportsRepository } from "./performance-reports.repository";
import { PerformanceReportsService } from "./performance-reports.service";

@Module({
	imports: [AuthModule],
	controllers: [PerformanceReportsController],
	providers: [PerformanceReportsRepository, PerformanceReportsService],
	exports: [PerformanceReportsService],
})
export class PerformanceReportsModule {}
