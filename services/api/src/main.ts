import type { IncomingMessage } from "node:http";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./modules/app.module";
import { validationExceptionFactory } from "./shared/pipes/validation-exception-factory";
import { UPLOAD_PUBLIC_PREFIX, getUploadRoot } from "./shared/uploads/upload-paths";

const ROUTE_GEOMETRY_BODY_LIMIT = "2mb";

function isRouteGeometryJson(request: IncomingMessage): boolean {
	const path = request.url?.split("?")[0].replace(/\/$/, "");
	const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
	if (contentType !== "application/json" || !path) return false;
	return (
		(request.method === "POST" &&
			["/api/trekking-routes", "/api/route-safety/analyze", "/api/route-safety/terrain"].includes(
				path.toLowerCase()
			)) ||
		(request.method === "PATCH" && /^\/api\/trekking-routes\/[a-f0-9-]+$/i.test(path))
	);
}

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.setGlobalPrefix("api");
	app.enableCors({ exposedHeaders: ["Retry-After"] });
	app.useBodyParser("json", { type: isRouteGeometryJson, limit: ROUTE_GEOMETRY_BODY_LIMIT });
	app.useBodyParser("json");
	app.useStaticAssets(getUploadRoot(), { prefix: UPLOAD_PUBLIC_PREFIX });

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			exceptionFactory: validationExceptionFactory,
		})
	);

	const swaggerConfig = new DocumentBuilder()
		.setTitle("CTMS API")
		.setDescription("Camping Site and Trekking Management System API")
		.setVersion("0.1.0")
		.addBearerAuth()
		.build();

	const document = SwaggerModule.createDocument(app, swaggerConfig);
	SwaggerModule.setup("api/docs", app, document);

	await app.listen(Number(process.env.API_PORT ?? 3000));
}

void bootstrap();
