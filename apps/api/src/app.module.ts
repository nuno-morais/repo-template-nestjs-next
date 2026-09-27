import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { ClerkAuthGuard } from './auth/clerk.guard';
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';
import { validateApiEnvironment } from './config/api-config';
import { apiPinoHttpOptions } from './config/api-logger.config';
import { WidgetsModule } from './widgets/widgets.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      validate: validateApiEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: apiPinoHttpOptions(
          config.getOrThrow('NODE_ENV') === 'production',
        ),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const common = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: false,
        };
        return url
          ? { ...common, url }
          : {
              ...common,
              host: config.getOrThrow<string>('DB_HOST'),
              port: Number(config.getOrThrow<string>('DB_PORT')),
              username: config.getOrThrow<string>('DB_USERNAME'),
              password: config.getOrThrow<string>('DB_PASSWORD'),
              database: config.getOrThrow<string>('DB_NAME'),
            };
      },
    }),
    WidgetsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
