import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('comprobante_asignacion_sede')
export class ComprobanteAsignacionSede {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'integer', name: 'comprobante_id' })
  comprobanteId: number;

  @Column({ type: 'integer', name: 'sede_id' })
  sedeId: number;

  @Column({ type: 'integer', name: 'rubro_gasto_id', nullable: true })
  rubroGastoId?: number | null;
}
