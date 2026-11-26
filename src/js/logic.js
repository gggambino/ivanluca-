import { S } from './data.js';
import { AREAS } from './config.js';
import { hoy, addDias, parse, difDias, sum } from './util.js';

// ---------- XP y niveles ----------
// Nivel N necesita 50*N*(N+1) XP acumulada: 100, 300, 600, 1000, 1500...
export const nivelDe = (xp) => { let n = 0; while (50 * (n + 1) * (n + 2) <= xp) n++; return n + 1; };
export const xpNivel = (n) => 50 * (n - 1) * n;
export function progreso(xp) {
  const n = nivelDe(xp); const a = xpNivel(n); const b = xpNivel(n + 1);
  return { n, xp, desde: a, hasta: b, pct: Math.round(((xp - a) / (b - a)) * 100) };
}

export const XP_REGLAS = [
  ['Cada hábito cumplido', 'los XP del hábito, en su área'],
  ['Anotar algo en la Cabeza', '+5 Bienestar'],
  ['Cerrar algo de la Cabeza (resuelto o ya no importaba)', '+10 Bienestar'],
  ['Registrar un movimiento de plata', '+2 Ingresos'],
  ['Pagar un gasto fijo del mes', '+5 Ingresos'],
  ['Pasar un proyecto a "en curso"', '+10 en su área'],
  ['Terminar un proyecto', '+50 en su área'],
  ['Registrar tu peso', '+5 Salud'],
  ['Día ganado (70% de los hábitos del día)', '+10 Bienestar'],
];

export function eventosXP() {
  const ev = []; // {fecha, area, xp, txt}
  const hab = Object.fromEntries(S.habitos.map((h) => [h.id, h]));
  for (const l of S.log) { const h = hab[l.habito_id]; if (h) ev.push({ fecha: l.fecha, area: h.area, xp: h.xp, txt: h.nombre }); }
  for (const c of S.cabeza) {
    ev.push({ fecha: c.creado.slice(0, 10), area: 'bienestar', xp: 5, txt: 'Anotaste algo en la Cabeza' });
    if (c.estado !== 'abierto' && c.cerrado) ev.push({ fecha: c.cerrado.slice(0, 10), area: 'bienestar', xp: 10, txt: 'Cerraste algo de la Cabeza' });
  }
  for (const m of S.movs) ev.push({ fecha: m.fecha, area: 'ingresos', xp: 2, txt: 'Registraste un movimiento' });
  for (const p of S.fijosPagos) ev.push({ fecha: p.pagado_en || hoy(), area: 'ingresos', xp: 5, txt: 'Pagaste un gasto fijo' });
  const inicio = S.perfil?.creado ? new Date(new Date(S.perfil.creado).getTime() + 120000).toISOString() : '';
  for (const p of S.proyectos) {
    const a = AREAS[p.area] ? p.area : 'proyectos';
    const sembrado = p.creado < inicio; // los que vinieron de tus planillas no regalan XP de arranque
    if (!sembrado && (p.estado === 'en_curso' || p.estado === 'hecho')) ev.push({ fecha: p.creado.slice(0, 10), area: a, xp: 10, txt: 'Proyecto en curso' });
    if (p.estado === 'hecho') ev.push({ fecha: (p.cerrado || p.creado).slice(0, 10), area: a, xp: 50, txt: 'Proyecto terminado: ' + p.nombre });
  }
  for (const s of S.salud) if (s.peso && !String(s.notas || '').startsWith('Punto de partida')) ev.push({ fecha: s.fecha, area: 'salud', xp: 5, txt: 'Registraste tu peso' });
  for (const f of diasGanados()) ev.push({ fecha: f, area: 'bienestar', xp: 10, txt: 'Día ganado' });
  return ev;
}

export function xpPorArea(ev = eventosXP()) {
  const r = Object.fromEntries(Object.keys(AREAS).map((k) => [k, 0]));
  for (const e of ev) r[e.area] = (r[e.area] || 0) + e.xp;
  return r;
}
export const xpTotal = (ev = eventosXP()) => sum(ev, (e) => e.xp);
// Nivel general: XP total con una curva 3 veces más larga que la de cada área
export const nivelGeneral = (xp) => progreso(Math.floor(xp / 3));

// ---------- Hábitos ----------
export const habitosDelDia = (f = hoy()) => { const d = parse(f).getDay(); return S.habitos.filter((h) => h.activo && (h.dias || []).includes(d)); };
export const hecho = (hid, f = hoy()) => S.log.some((l) => l.habito_id === hid && l.fecha === f);
export function pctDia(f = hoy()) {
  const hs = habitosDelDia(f); if (!hs.length) return 0;
  return Math.round((hs.filter((h) => hecho(h.id, f)).length / hs.length) * 100);
}
export function diasGanados() {
  const fechas = [...new Set(S.log.map((l) => l.fecha))];
  return fechas.filter((f) => pctDia(f) >= 70);
}
export function racha() {
  const set = new Set(diasGanados()); let n = 0; let f = hoy();
  if (!set.has(f)) f = addDias(f, -1); // hoy todavía está en juego
  while (set.has(f)) { n++; f = addDias(f, -1); }
  return n;
}

// ---------- Plata ----------
export const mesDe = (f) => f.slice(0, 7);
export function resumenMes(mes) {
  const bbIng = S.ingBB.filter((x) => mesDe(x.fecha) === mes);
  const movs = S.movs.filter((m) => mesDe(m.fecha) === mes);
  const ingManual = movs.filter((m) => m.tipo === 'ingreso' && m.estado === 'hecho');
  const aCobrar = movs.filter((m) => m.tipo === 'ingreso' && m.estado === 'pendiente');
  const gastosVar = movs.filter((m) => m.tipo === 'gasto' && m.estado === 'hecho');
  const aPagar = movs.filter((m) => m.tipo === 'gasto' && m.estado === 'pendiente');
  const fijosAct = S.fijos.filter((f) => f.activo);
  const pagos = S.fijosPagos.filter((p) => p.mes === mes);
  const pagadoFijo = (f) => pagos.find((p) => p.fijo_id === f.id);
  const fijosPagados = sum(fijosAct.filter(pagadoFijo), (f) => pagadoFijo(f).monto ?? f.monto);
  const fijosPend = fijosAct.filter((f) => !pagadoFijo(f));
  const ingresos = sum(bbIng, (x) => x.monto) + sum(ingManual, (x) => x.monto);
  const gastos = sum(gastosVar, (x) => x.monto) + fijosPagados;
  return {
    bb: sum(bbIng, (x) => x.monto), manual: sum(ingManual, (x) => x.monto), ingresos,
    gastosVar: sum(gastosVar, (x) => x.monto), fijosPagados, gastos,
    resultado: ingresos - gastos,
    aCobrar: sum(aCobrar, (x) => x.monto), aCobrarItems: aCobrar,
    aPagar: sum(aPagar, (x) => x.monto) + sum(fijosPend, (f) => f.monto), fijosPend, aPagarItems: aPagar,
    totalFijos: sum(fijosAct, (f) => f.monto), movs, pagadoFijo,
    porCategoria: Object.entries(gastosVar.reduce((o, m) => { const k = m.categoria || 'Otros'; o[k] = (o[k] || 0) + Number(m.monto); return o; }, {})).sort((a, b) => b[1] - a[1]),
    porFuente: Object.entries([...ingManual, ...bbIng.map((x) => ({ ...x, categoria: 'Base Bambino (gym)' }))].reduce((o, m) => { const k = m.categoria || 'Otro'; o[k] = (o[k] || 0) + Number(m.monto); return o; }, {})).sort((a, b) => b[1] - a[1]),
  };
}

// ---------- Recordatorios ----------
const f3 = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const ultimoDia = (y, m) => new Date(y, m + 1, 0).getDate();
export function proximaFecha(r, desde = hoy()) {
  if (r.repetir === 'no' || r.fecha >= desde) return r.fecha;
  const d0 = parse(r.fecha); const dd = parse(desde);
  if (r.repetir === 'anual') {
    for (const y of [dd.getFullYear(), dd.getFullYear() + 1]) {
      const c = f3(y, d0.getMonth(), Math.min(d0.getDate(), ultimoDia(y, d0.getMonth())));
      if (c >= desde) return c;
    }
  }
  if (r.repetir === 'mensual') {
    for (let i = 0; i < 3; i++) {
      const y = dd.getFullYear() + Math.floor((dd.getMonth() + i) / 12); const m = (dd.getMonth() + i) % 12;
      const c = f3(y, m, Math.min(d0.getDate(), ultimoDia(y, m)));
      if (c >= desde) return c;
    }
  }
  if (r.repetir === 'semanal') return addDias(desde, (d0.getDay() - dd.getDay() + 7) % 7);
  return r.fecha;
}
export function recordatoriosProximos(dias = 7) {
  const h = hoy();
  return S.recordatorios
    .filter((r) => !(r.repetir === 'no' && r.hecho))
    .map((r) => ({ ...r, prox: proximaFecha(r, h), vencido: r.repetir === 'no' && r.fecha < h }))
    .filter((r) => r.vencido || difDias(h, r.prox) <= (r.tipo === 'cumple' ? Math.max(dias, 3) : dias))
    .sort((a, b) => (a.prox < b.prox ? -1 : 1));
}

export function fijosPorVencer(dias = 5) {
  const h = hoy(); const mes = mesDe(h); const d = parse(h).getDate();
  const R = resumenMes(mes);
  return R.fijosPend.filter((f) => f.dia_vto && (f.dia_vto < d || f.dia_vto - d <= dias)).map((f) => ({ ...f, vencido: f.dia_vto < d }));
}
