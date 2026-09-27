import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();
const common = {
  type: 'postgres' as const,
  entities: ['apps/api/src/entities/**/*.entity.ts'],
  migrations: ['apps/api/src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
};
const options: DataSourceOptions = process.env.DATABASE_URL
  ? { ...common, url: process.env.DATABASE_URL }
  : { ...common, host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || '5432'), username: process.env.DB_USERNAME || 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || '{{ project_name | replace("-", "_") }}' };
export default new DataSource(options);
