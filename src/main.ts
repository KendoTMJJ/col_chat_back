import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  let port: number = Number(process.env.PORT);

  await app.listen(port, () => {
    console.log('Servidor escuchando el puerdo:', port);
  });
}
bootstrap();
