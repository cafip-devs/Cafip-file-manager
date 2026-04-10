import { Module } from '@nestjs/common';
import { InstitucionesController } from './instituciones.controller';
import { InstitucionesService } from './instituciones.service';

@Module({
  controllers: [InstitucionesController],
  providers: [InstitucionesService],
})
export class InstitucionesModule {}

