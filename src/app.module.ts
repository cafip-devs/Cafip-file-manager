import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirmasModule } from './modules/firmas/firmas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirmasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
