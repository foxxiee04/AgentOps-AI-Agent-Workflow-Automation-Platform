import "reflect-metadata";
import helmet from "helmet";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http/http-exception.filter";

export type CreateAppOptions = {
  /** Swagger UI at /docs; skipped by integration tests. */
  swagger?: boolean;
  logger?: false;
};

/** Builds the configured Nest application (shared by `main.ts` and integration tests). */
export async function createApp(options: CreateAppOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, ...(options.logger === false ? { logger: false } : {}) });

  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.WEB_APP_URL ?? "http://localhost:3000",
    credentials: true
  });
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  if (options.swagger !== false) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("AgentOps API")
      .setDescription("AI Agent workflow automation platform API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  return app;
}
