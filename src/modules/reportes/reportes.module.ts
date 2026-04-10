import { Module } from '@nestjs/common';
import { reportesDataSourceProvider } from '../../database/reportes-data-source.provider';
import { ReportesController } from './reportes.controller';
import { ReportesRepository } from './reportes.repository';
import { ReportesService } from './reportes.service';

@Module({
  controllers: [ReportesController],
  providers: [
    reportesDataSourceProvider,
    ReportesRepository,
    ReportesService,
  ],
  exports: [ReportesService],
})
export class ReportesModule {}
