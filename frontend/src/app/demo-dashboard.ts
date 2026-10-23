import { DashboardCelda, DashboardResumen } from './models/dashboard';

function entryAt(hour: number, minute: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '01';
  return `${part('year')}-${part('month')}-${part('day')}T${String(hour + 5).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
}

function demoCell(
  codigo: string,
  zona: DashboardCelda['zona'],
  estado: DashboardCelda['estado'],
  options: { plate?: string; monthly?: boolean; enteredAt?: [number, number] } = {},
): DashboardCelda {
  const tipo = zona === 'M' ? 'MOTO' : zona === 'P' ? 'PESADO' : 'AUTOMOVIL';
  return {
    id: 0,
    codigo,
    tipo,
    zona,
    estado,
    mensualidad: options.monthly ?? false,
    vehiculo: options.plate
      ? { placa: options.plate, tipo: tipo === 'PESADO' ? 'CAMIONETA' : tipo }
      : null,
    entrada: options.enteredAt ? entryAt(...options.enteredAt) : null,
  };
}

/** Figma preview values for `/?demo=1`; this fixture never writes to the API or database. */
export function createDemoDashboard(): DashboardResumen {
  const visible: DashboardCelda[] = [
    demoCell('A-01', 'A', 'OCUPADA', { plate: 'JTR-428', enteredAt: [8, 24] }),
    demoCell('A-02', 'A', 'DISPONIBLE'),
    demoCell('A-03', 'A', 'DISPONIBLE'),
    demoCell('A-04', 'A', 'OCUPADA', { plate: 'KLV-103', monthly: true }),
    demoCell('A-05', 'A', 'OCUPADA', { plate: 'NGQ-716', enteredAt: [9, 12] }),
    demoCell('A-06', 'A', 'DISPONIBLE'),
    demoCell('A-07', 'A', 'OCUPADA', { plate: 'BMX-904', enteredAt: [10, 3] }),
    demoCell('A-08', 'A', 'DISPONIBLE'),
    demoCell('M-01', 'M', 'OCUPADA', { plate: 'VRD-59F', enteredAt: [7, 58] }),
    demoCell('M-02', 'M', 'OCUPADA', { plate: 'QRS-82D', monthly: true }),
    demoCell('M-03', 'M', 'DISPONIBLE'),
    demoCell('M-04', 'M', 'OCUPADA', { plate: 'DFK-31H', enteredAt: [10, 40] }),
    demoCell('M-05', 'M', 'DISPONIBLE'),
    demoCell('M-06', 'M', 'DISPONIBLE'),
    demoCell('M-07', 'M', 'OCUPADA', { plate: 'APL-70G', monthly: true }),
    demoCell('M-08', 'M', 'DISPONIBLE'),
    demoCell('P-01', 'P', 'DISPONIBLE'),
    demoCell('P-02', 'P', 'OCUPADA', { plate: 'TUX-872', enteredAt: [6, 42] }),
  ];

  const generated: DashboardCelda[] = [];
  const additional: Array<{ zone: DashboardCelda['zona']; first: number; last: number }> = [
    { zone: 'A', first: 9, last: 26 },
    { zone: 'M', first: 9, last: 26 },
    { zone: 'P', first: 3, last: 10 },
  ];
  let occupiedIndex = 1;
  for (const group of additional) {
    for (let number = group.first; number <= group.last; number++) {
      const codigo = `${group.zone}-${String(number).padStart(2, '0')}`;
      const occupied = occupiedIndex <= 15;
      generated.push(
        demoCell(codigo, group.zone, occupied ? 'OCUPADA' : 'DISPONIBLE', occupied
          ? { plate: `DMO-${String(occupiedIndex).padStart(3, '0')}`, enteredAt: [11, occupiedIndex] }
          : {}),
      );
      if (occupied) occupiedIndex++;
    }
  }

  // Use unique IDs for Angular tracking and generated cell links.
  const celdas = [...visible, ...generated].map((cell, index) => ({ ...cell, id: index + 1 }));
  return {
    total_celdas: 62,
    celdas_disponibles: 38,
    celdas_ocupadas: 24,
    estancias_activas: 21,
    mensualidades_activas: 3,
    recaudacion_hoy: 864500,
    variacion_recaudacion_pct: 12.4,
    variacion_ocupadas_24h: 5,
    celdas,
  };
}
