import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('comprobante_presupuestal')
export class ComprobantePresupuestal {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'integer', name: 'institucion' })
  institucionId: number;

  @Column({ type: 'timestamp', name: 'fecha' })
  fecha: Date;

  @Column({ type: 'varchar', length: 20, name: 'estado' })
  estado: string;
}
