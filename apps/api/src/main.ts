import "reflect-metadata";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = Number(process.env.PORT ?? 4000);

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle("AgentOps API")
    .setDescription("AI Agent workflow automation platform API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(port);
}

void bootstrap();
