import { startOpenTelemetry } from "@agentops/observability";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createApp } from "./bootstrap";
import { resolveTrustProxy } from "./common/http/trust-proxy";

async function bootstrap() {
  startOpenTelemetry({ serviceName: "agentops-api", serviceVersion: "0.1.0" });
  const app = (await createApp()) as NestExpressApplication;
  const trustProxy = resolveTrustProxy(process.env.API_TRUST_PROXY);
  if (trustProxy !== false) {
    app.set("trust proxy", trustProxy);
  }
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
