import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { networkInterfaces } from 'os';

async function bootstrap() {
  // Charge mon-backend/backend/.env (indépendant du cwd npm)
  loadEnv({ path: join(__dirname, '..', '.env') });
  // IMPORTANT : on utilise NestExpressApplication pour servir les fichiers statiques
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 🔥 Enable CORS pour les requêtes du frontend
  app.enableCors({
    origin: true, // Accepte toutes les origines en développement
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Mon API')
    .setDescription('Documentation de mon backend NestJS')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez votre JWT token',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 🔥 Permet d'accéder aux photos uploadées via /uploads/xxxx.jpg
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const port = 3000;
  await app.listen(port, '0.0.0.0');

  const nets = networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  console.log(`Server listening on http://0.0.0.0:${port}`);
  if (addresses.length) {
    console.log(`Local network addresses: ${addresses.join(', ')}`);
  } else {
    console.log('No external IPv4 address detected.');
  }
}
bootstrap();
