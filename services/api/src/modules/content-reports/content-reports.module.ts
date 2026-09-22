import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UsersModule } from "../users/users.module";
import { ContentReportsController } from "./content-reports.controller";
import { ContentReportsRepository } from "./content-reports.repository";
import { ContentReportsService } from "./content-reports.service";
import { ContentReport } from "./entities/content-report.entity";

@Module({
	imports: [UsersModule],
	controllers: [ContentReportsController],
	providers: [
		ContentReportsService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: ContentReportsRepository,
			useFactory: (dataSource: DataSource) =>
				new ContentReportsRepository(ContentReport, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class ContentReportsModule {}
