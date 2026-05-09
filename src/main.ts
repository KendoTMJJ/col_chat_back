import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  let port: number = Number(process.env.PORT);

  app.enableCors({ origin: '*' });

  const config = new DocumentBuilder()
    .setTitle('Chat Service')
    .setDescription('The chat API description')
    .setVersion('1.0')
    .addTag('Chat')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(port, () => {
    console.log('Servidor escuchando en el puerto: ' + port);
  });
}
bootstrap();
