import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ObjectUtils } from 'typeorm/util/ObjectUtils';

process.env.NODE_ENV ||= 'test';
process.env.PORT ||= '3000';
process.env.CLERK_SECRET_KEY ||= 'sk_test_placeholder';
process.env.CLIENT_ORIGINS ||= 'http://localhost:{{ web_port }}';
process.env.DB_HOST ||= 'localhost';
process.env.DB_PORT ||= '{{ postgres_port }}';
process.env.DB_USERNAME ||= 'postgres';
process.env.DB_PASSWORD ||= 'postgres';
process.env.DB_NAME ||= '{{ project_name | replace("-", "_") }}';

DataSource.prototype.initialize = async function () {
  if (this.driver) {
    this.driver.connect = async () => {};
    this.driver.afterConnect = async () => {};
    this.driver.disconnect = async () => {};
  }
  ObjectUtils.assign(this, { isInitialized: true });
  await this.buildMetadatas();
  return this;
};
DataSource.prototype.destroy = async function () {
  ObjectUtils.assign(this, { isInitialized: false });
};

async function generateApiContract(): Promise<void> {
  // AppModule reads environment during import; load it after contract defaults.
  const { AppModule } = require('../apps/api/src/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widgets-contract-'));
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('{{ project_name }} API').setVersion('1.0').addServer('/v1').build());
    if (!document.components?.schemas?.WidgetResponseDto) throw new Error('WidgetResponseDto missing from OpenAPI document');
    const openapi = path.join(directory, 'openapi.json');
    const output = path.resolve(__dirname, '../apps/web/src/types/api-contract.ts');
    fs.writeFileSync(openapi, JSON.stringify(document));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    execFileSync('yarn', ['openapi-typescript', openapi, '-o', output], { stdio: 'inherit' });
    execFileSync('yarn', ['prettier', '--write', output], { stdio: 'inherit' });
  } finally {
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
void generateApiContract().catch((error: unknown) => {
  console.error('API contract generation failed:', error);
  process.exit(1);
});
