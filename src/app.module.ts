import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirmasModule } from './modules/firmas/firmas.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { InstitucionesModule } from './modules/instituciones/instituciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirmasModule,
    InstitucionesModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
