import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GeoAreasController } from "./geo-areas.controller";
import { GeoAreasService } from "./geo-areas.service";

@Module({
	imports: [AuthModule],
	controllers: [GeoAreasController],
	providers: [GeoAreasService],
	exports: [GeoAreasService],
})
export class GeoAreasModule {}
