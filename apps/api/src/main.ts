import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { setupSwagger } from './swagger/swagger';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  setupSwagger(app);
  const port = app.get(ConfigService).getOrThrow<string>('PORT');
  await app.listen(Number(port));
  app
    .get(Logger)
    .log(`[sample-project-api] server started on port ${port} with prefix /v1`);
}
void bootstrap();
