import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./modules/app.module";
import { validationExceptionFactory } from "./shared/pipes/validation-exception-factory";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.setGlobalPrefix("api");
	app.enableCors();

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
