import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import chalk from 'chalk';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';

import { ValidationRequestPipe } from '@/shared/pipes/validation-request.pipe';
import { AppModule } from './app.module';
import { CustomLogger } from '@/config/logger';
import { corsConfig } from '@/config/cors';

import { env } from '@globe-rtc/env';

async function bootstrap() {
  const logger = new CustomLogger('API');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 5 * 1024 * 1024 }), { logger });
  app.useLogger(logger);

  app.enableCors(corsConfig);
  await app.register(fastifyCookie as any);
  await app.register(fastifyMultipart as any);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationRequestPipe());
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Globe RTC API')
    .setDescription('API docs for Globe RTC backend')
    .setVersion('1.0')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Health', 'Health check endpoints')
    .addTag('User', 'User profile endpoints')
    .addTag('Rooms', 'Rooms management')
    .addTag('Friends', 'Friendship requests and connections')
    .addTag('Uploads', 'Upload endpoints')
    .addTag('Skins', 'Avatar skin generation')
    .addBearerAuth()
    .addCookieAuth('meta-session')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      withCredentials: true,
    },
    customJs: ['/docs/login.js'],
  });
  const port = env.PORT_NEST ?? 3000;
  await app.listen(port, '0.0.0.0');
  const appUrl = await app.getUrl();
  console.log(`Application is running on: ${appUrl}`);
  console.log(chalk.cyanBright(`Swagger docs: ${appUrl}/docs`));
}
bootstrap();
