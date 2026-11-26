// Datos iniciales sacados de tus planillas (RUTINA OCT-NOV-DIC 2026 y SEPTIEMBRE - PLANI).
// Todo se puede editar desde la app.
const LV = [1, 2, 3, 4, 5, 6];
export const SEED = {
  objetivos: 'Bajar de 86 a 80 kg. Físico fuerte, atlético, con cardio.\nMás horas CEO: gestión, contenido, planificar.\nOrden = profesionalismo = disciplina.',
  plan_entreno: 'Fuerza x3 (básicos barra, full body máquinas, full body mancuernas/smith)\nBoxeo + circuito x3\nRunning x1 (sábado)\nCardio 30 min en días de fuerza',
  plan_dieta: 'Proteína: huevos, pechuga, atún\nCarbos: papines, tomate, pan, galleta de arroz, avena, granola\nMerienda: leche con granola, fruta, café, mate\nSuple: proteína, multivitamínico, Lipo 6 Black',
  habitos: [
    { nombre: 'Entrenar', area: 'salud', xp: 15, dias: LV },
    { nombre: 'Comer según el plan', area: 'salud', xp: 10, dias: [0, ...LV] },
    { nombre: 'Proteína y suplementos', area: 'salud', xp: 5, dias: [0, ...LV] },
    { nombre: 'Dormir 7 h o más', area: 'bienestar', xp: 10, dias: [0, ...LV] },
    { nombre: 'Vaciar la cabeza (anotar lo que me preocupa)', area: 'bienestar', xp: 5, dias: [0, ...LV] },
    { nombre: 'Bloque CEO: gestión y planificación', area: 'negocios', xp: 20, dias: [1, 3, 5] },
    { nombre: 'Planificar la semana', area: 'negocios', xp: 25, dias: [0] },
    { nombre: 'Grabar o editar contenido', area: 'imagen', xp: 10, dias: LV },
    { nombre: 'Registrar mis gastos del día', area: 'ingresos', xp: 5, dias: [0, ...LV] },
    { nombre: 'Avanzar un proyecto o idea', area: 'proyectos', xp: 15, dias: [1, 2, 3, 4, 5] },
    { nombre: 'Tiempo con alguien que quiero', area: 'relaciones', xp: 10, dias: [0, ...LV] },
  ],
  // dia_vto sin dato en tus planillas: completalo en Perfil > Gastos fijos
  fijos: [
    { concepto: 'Alquiler (Franco)', monto: 560000 },
    { concepto: 'Luz', monto: 39500 },
    { concepto: 'Expensas', monto: 65557 },
    { concepto: 'Gas', monto: 7500 },
    { concepto: 'Claude (IA)', monto: 31500 },
    { concepto: 'CapCut (IA)', monto: 18500 },
    { concepto: 'ManyChat (IA)', monto: 22500 },
  ],
  proyectos: [
    { nombre: 'BambinoShop', area: 'negocios', estado: 'en_curso', prioridad: 1, proximo_paso: 'Terminar el catálogo', notas: 'Comprar más guantes. Que la gente sepa que vendo. Reviews, contenido, colabs con partners. Servicio, tiempo de entrega y costos OK. Venta cruzada a alumnos y online, venta mayorista.' },
    { nombre: 'Marca personal: contenido', area: 'imagen', estado: 'en_curso', prioridad: 1, proximo_paso: 'Planificar el contenido de la semana' },
    { nombre: 'Saldar deuda con Franco', area: 'ingresos', estado: 'en_curso', prioridad: 1, proximo_paso: 'Confirmar cuánto queda (la planilla dice $550.000)' },
    { nombre: 'Subir ticket y ordenar fecha de cobro de los 1 a 1', area: 'ingresos', estado: 'idea', prioridad: 2 },
    { nombre: 'Venta de software con Cris', area: 'negocios', estado: 'idea', prioridad: 2 },
    { nombre: 'Nueva web al Ruso', area: 'negocios', estado: 'idea', prioridad: 2 },
    { nombre: 'IPF', area: 'negocios', estado: 'idea', prioridad: 3 },
  ],
  rutina: [
    // Lunes, miércoles, viernes
    ...[1, 3, 5].flatMap((d) => [
      { dia: d, desde: '07:00', hasta: '09:00', titulo: 'Clases 1 a 1', area: 'ingresos' },
      { dia: d, desde: '09:00', hasta: '10:00', titulo: d === 1 ? 'Entreno: básicos barra + cardio 30 min' : d === 3 ? 'Entreno: full body máquinas + cardio 30 min' : 'Entreno: full body mancuernas / smith', area: 'salud' },
      { dia: d, desde: '10:00', hasta: '12:00', titulo: 'Clases 1 a 1', area: 'ingresos' },
      { dia: d, desde: '12:00', hasta: '14:00', titulo: 'Comer, siesta, casa', area: 'bienestar' },
      { dia: d, desde: '14:00', hasta: '16:00', titulo: 'Bloque CEO: gestión y planificación', area: 'negocios' },
      { dia: d, desde: '16:00', hasta: '19:00', titulo: 'Edición, mensajes y gestión', area: 'imagen' },
      { dia: d, desde: '19:00', hasta: '20:30', titulo: 'Merienda y pre gym', area: 'bienestar' },
      { dia: d, desde: '20:30', hasta: '22:00', titulo: 'Clases grupales', area: 'ingresos' },
    ]),
    // Martes y jueves
    ...[2, 4].flatMap((d) => [
      { dia: d, desde: '07:00', hasta: '09:00', titulo: 'Clases 1 a 1', area: 'ingresos' },
      { dia: d, desde: '09:00', hasta: '10:00', titulo: 'Entreno: circuito + boxeo', area: 'salud' },
      { dia: d, desde: '10:00', hasta: '12:00', titulo: 'Clases 1 a 1', area: 'ingresos' },
      { dia: d, desde: '12:00', hasta: '14:00', titulo: 'Comer, siesta, casa', area: 'bienestar' },
      { dia: d, desde: '14:00', hasta: '18:00', titulo: d === 2 ? 'Grabar contenido de la semana' : 'Edición, mensajes y gestión', area: 'imagen' },
      { dia: d, desde: '18:00', hasta: '19:00', titulo: 'Merienda y pre gym', area: 'bienestar' },
      { dia: d, desde: '19:00', hasta: '20:30', titulo: 'Clases grupales', area: 'ingresos' },
      { dia: d, desde: '20:30', hasta: '22:00', titulo: 'Segundo turno de grupales o trabajo', area: 'ingresos' },
    ]),
    // Sábado
    { dia: 6, desde: '07:00', hasta: '09:00', titulo: 'Clases 1 a 1', area: 'ingresos' },
    { dia: 6, desde: '09:00', hasta: '10:00', titulo: 'Entreno: circuito + boxeo', area: 'salud' },
    { dia: 6, desde: '10:00', hasta: '14:00', titulo: 'Segundo día de grabación', area: 'imagen' },
    { dia: 6, desde: '17:00', hasta: '18:00', titulo: 'Running', area: 'salud' },
    // Domingo
    { dia: 0, desde: '11:00', hasta: '12:00', titulo: 'Planificar la semana y revisar la Cabeza', area: 'negocios' },
  ],
};
