import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rubro_gasto_info_financiera')
export class RubroGastoInfoFinanciera {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'integer', name: 'rubro_gasto_id' })
  rubroGastoId: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'presupuesto_inicial',
  })
  presupuestoInicial: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'adicion' })
  adicion: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'reduccion' })
  reduccion: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'credito' })
  credito: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'contracredito' })
  contracredito: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'presupuesto_definitivo',
  })
  presupuestoDefinitivo: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'cdp' })
  cdp: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'crp' })
  crp: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'obligacion' })
  obligacion: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'pago' })
  pago: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'saldo_disponible',
  })
  saldoDisponible: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'saldo_por_ejecutar',
  })
  saldoPorEjecutar: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'saldo_por_pagar',
  })
  saldoPorPagar: string;
}
