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
  ['Completar una tarea de tu plan del día', '+5 en su área'],
  ['Lograr un objetivo de la semana', '+30 en su área'],
  ['Lograr un objetivo del mes', '+60 en su área'],
  ['Día con calorías dentro de tu meta (±10%)', '+10 Salud'],
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
  for (const t of S.tareas) if (t.hecho && !t.es_bloque) ev.push({ fecha: (t.hecho_en || t.fecha).slice(0, 10), area: t.area, xp: 5, txt: 'Tarea: ' + t.titulo });
  for (const o of S.objetivos) if (o.hecho) ev.push({ fecha: (o.cerrado || o.creado).slice(0, 10), area: o.area, xp: o.periodo === 'mes' ? 60 : 30, txt: 'Objetivo logrado: ' + o.titulo });
  for (const f of diasEnCalorias()) ev.push({ fecha: f, area: 'salud', xp: 10, txt: 'Calorías dentro de tu meta' });
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
// Costos del gym de un mes (se cargan acá: Base Bambino solo tiene cobros). Los fijos cuentan desde/hasta su mes;
// si ese mes hay un gasto del gym atado al fijo, vale ese monto (así se ajusta un mes puntual).
export const fijoGymVigente = (f, mes) => (!f.desde || f.desde <= mes) && (!f.hasta || mes <= f.hasta);
export function costosGym(mes, conCobros = true) {
  const gs = (S.gymGastos || []).filter((g) => mesDe(g.fecha) === mes);
  const fijos = (S.gymFijos || []).filter((f) => fijoGymVigente(f, mes) && mes <= mesDe(hoy()) && (conCobros || gs.length))
    .map((f) => { const aj = gs.find((g) => g.fijo_id === f.id); return { f, ajuste: aj || null, monto: Number(aj ? aj.monto : f.monto) }; });
  const otros = gs.filter((g) => !g.fijo_id || !fijos.some((x) => x.f.id === g.fijo_id));
  const tFijos = sum(fijos, (x) => x.monto); const tOtros = sum(otros, (g) => g.monto);
  return { fijos, otros, tFijos, tOtros, total: tFijos + tOtros };
}
// Gastos fijos personales mes a mes: valen desde/hasta su mes. El monto de un mes sale de:
// 1) un cambio "solo este mes", 2) el último cambio "de acá en adelante" hasta ese mes, 3) el monto base.
export const fijoVigente = (f, mes) => f.activo && (!f.desde || f.desde <= mes) && (!f.hasta || mes <= f.hasta);
export function montoFijoMes(f, mes) {
  const xs = (S.fijosMontos || []).filter((x) => x.fijo_id === f.id);
  const solo = xs.find((x) => x.solo_mes && x.mes === mes); if (solo) return Number(solo.monto);
  const prev = xs.filter((x) => !x.solo_mes && x.mes <= mes).sort((a, b) => (a.mes < b.mes ? 1 : -1))[0];
  return Number(prev ? prev.monto : f.monto);
}
export function resumenMes(mes) {
  const bbIng = S.ingBB.filter((x) => mesDe(x.fecha) === mes);
  const bbBruto = sum(bbIng, (x) => x.monto);
  const gym = costosGym(mes);
  const bbNeto = bbBruto - gym.total;
  const movs = S.movs.filter((m) => mesDe(m.fecha) === mes);
  const ingManual = movs.filter((m) => m.tipo === 'ingreso' && m.estado === 'hecho');
  const aCobrar = movs.filter((m) => m.tipo === 'ingreso' && m.estado === 'pendiente');
  const gastosVar = movs.filter((m) => m.tipo === 'gasto' && m.estado === 'hecho');
  const aPagar = movs.filter((m) => m.tipo === 'gasto' && m.estado === 'pendiente');
  const fijosAct = S.fijos.filter((f) => fijoVigente(f, mes));
  const pagos = S.fijosPagos.filter((p) => p.mes === mes);
  const pagadoFijo = (f) => pagos.find((p) => p.fijo_id === f.id);
  const fijosPagados = sum(fijosAct.filter(pagadoFijo), (f) => pagadoFijo(f).monto ?? montoFijoMes(f, mes));
  const fijosPend = fijosAct.filter((f) => !pagadoFijo(f)).map((f) => ({ ...f, monto: montoFijoMes(f, mes) }));
  const ingresos = bbNeto + sum(ingManual, (x) => x.monto);
  const gastos = sum(gastosVar, (x) => x.monto) + fijosPagados;
  return {
    bb: bbBruto, bbNeto, gym, manual: sum(ingManual, (x) => x.monto), ingresos,
    gastosVar: sum(gastosVar, (x) => x.monto), fijosPagados, gastos,
    resultado: ingresos - gastos,
    aCobrar: sum(aCobrar, (x) => x.monto), aCobrarItems: aCobrar,
    aPagar: sum(aPagar, (x) => x.monto) + sum(fijosPend, (f) => f.monto), fijosPend, aPagarItems: aPagar,
    totalFijos: sum(fijosAct, (f) => montoFijoMes(f, mes)), fijosAct, movs, pagadoFijo,
    porCategoria: Object.entries(gastosVar.reduce((o, m) => { const k = m.categoria || 'Otros'; o[k] = (o[k] || 0) + Number(m.monto); return o; }, {})).sort((a, b) => b[1] - a[1]),
    porFuente: Object.entries([...ingManual, ...(bbBruto || gym.total ? [{ categoria: 'Gym neto (Base Bambino)', monto: bbNeto }] : [])].reduce((o, m) => { const k = m.categoria || 'Otro'; o[k] = (o[k] || 0) + Number(m.monto); return o; }, {})).sort((a, b) => b[1] - a[1]),
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

// ---------- Calorías ----------
export const comidasDel = (f = hoy()) => S.comidas.filter((c) => c.fecha === f);
export const kcalDel = (f = hoy()) => sum(comidasDel(f), (c) => c.calorias);
export const protDel = (f = hoy()) => sum(comidasDel(f), (c) => c.proteina);
export function diasEnCalorias() {
  const meta = Number(S.perfil?.meta_calorias) || 0; if (!meta) return [];
  const fechas = [...new Set(S.comidas.map((c) => c.fecha))].filter((f) => f < hoy());
  return fechas.filter((f) => { const k = kcalDel(f); return k >= meta * 0.9 && k <= meta * 1.1; });
}

// ---------- Objetivos ----------
export const inicioSemana = (f = hoy()) => { const d = parse(f).getDay(); return addDias(f, -((d + 6) % 7)); };
export const inicioMes = (f = hoy()) => f.slice(0, 8) + '01';
export function finPeriodo(o) {
  if (o.periodo === 'semana') return addDias(o.desde, 6);
  const d = parse(o.desde); return ymdLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function ingresosEntre(a, b) {
  // si es un mes entero, uso el neto del gym (cobros menos costos)
  if (a.endsWith('-01') && mesDe(a) === mesDe(b) && b === ymdLocal(new Date(parse(a).getFullYear(), parse(a).getMonth() + 1, 0))) return resumenMes(mesDe(a)).ingresos;
  return sum(S.ingBB.filter((x) => x.fecha >= a && x.fecha <= b), (x) => x.monto)
    + sum(S.movs.filter((m) => m.tipo === 'ingreso' && m.estado === 'hecho' && m.fecha >= a && m.fecha <= b), (m) => m.monto);
}
export function valorObjetivo(o) {
  if (o.auto === 'ingresos') return ingresosEntre(o.desde, finPeriodo(o));
  if (o.auto === 'ahorro') return resumenMes(o.desde.slice(0, 7)).resultado;
  if (o.tipo === 'si_no') return o.hecho ? 1 : 0;
  return Number(o.actual) || 0;
}
export function pctObjetivo(o) {
  if (o.tipo === 'si_no') return o.hecho ? 100 : 0;
  const m = Number(o.meta) || 1; return Math.max(0, Math.min(100, Math.round((valorObjetivo(o) / m) * 100)));
}
export const objetivosDe = (periodo, desde) => S.objetivos.filter((o) => o.periodo === periodo && o.desde === desde);

// ---------- Tareas por día ----------
const ordHora = (a, b) => (a.hora || '99') < (b.hora || '99') ? -1 : (a.hora || '99') > (b.hora || '99') ? 1 : (a.prioridad - b.prioridad);
// Un día "personalizado" ya no lee la semana tipo: sus bloques son filas propias (es_bloque) que se editan libremente
export const diaPersonalizado = (f) => S.diasPlan.includes(f);
export const tareasDel = (f) => S.tareas.filter((t) => t.fecha === f && !t.es_bloque).sort(ordHora);
export const bloquesPropios = (f) => S.tareas.filter((t) => t.fecha === f && t.es_bloque).sort(ordHora);
export const atrasadas = () => S.tareas.filter((t) => !t.hecho && !t.es_bloque && t.fecha < hoy()).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
export const bloquesDel = (f) => S.rutina.filter((r) => r.dia === parse(f).getDay());
// Bloques que se muestran ese día: los propios si lo personalizaste, si no la semana tipo + bloques sueltos agregados
export const bloquesVista = (f) => diaPersonalizado(f) ? bloquesPropios(f).map((b) => ({ ...b, propio: true, desde: b.hora }))
  : [...bloquesDel(f).map((b) => ({ ...b, tipo: true })), ...bloquesPropios(f).map((b) => ({ ...b, propio: true, desde: b.hora }))];

// ---------- Análisis de fin de mes ----------
// Compara cada categoría con el promedio de los 3 meses anteriores (los que tengan datos) y arma conclusiones simples.
const RECORTABLES = /salida|ropa|imagen|uber|transporte|delivery|regalo|suscrip|compra|otro|antojo|delivery|bar/i;
const mesMas = (mes, n) => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export function analisisMes(mes) {
  const R = resumenMes(mes);
  const previos = [1, 2, 3].map((i) => mesMas(mes, -i)).map((m) => ({ m, R: resumenMes(m) })).filter((x) => x.R.gastosVar > 0);
  const cats = new Map(R.porCategoria);
  previos.forEach((p) => p.R.porCategoria.forEach(([k]) => { if (!cats.has(k)) cats.set(k, 0); }));
  const prom = (k) => (previos.length ? sum(previos, (p) => Number(new Map(p.R.porCategoria).get(k) || 0)) / previos.length : null);
  const ant = previos.find((p) => p.m === mesMas(mes, -1));
  const enCurso = mes === mesDe(hoy());
  const [y, m] = mes.split('-').map(Number); const diasMes = new Date(y, m, 0).getDate();
  const diasPas = enCurso ? parse(hoy()).getDate() : diasMes;
  const proy = (v) => (enCurso && diasPas < diasMes ? (v / diasPas) * diasMes : v);
  const filas = [...cats.entries()].map(([k, v]) => {
    const p = prom(k); const vp = v; // por categoría no proyecto: un gasto grande suelto se exageraría
    const dif = p === null ? null : vp - p; const pct = p ? Math.round((dif / p) * 100) : null;
    return { k, v, vp, prom: p, dif, pct, share: R.gastosVar ? v / R.gastosVar : 0, ant: ant ? Number(new Map(ant.R.porCategoria).get(k) || 0) : null, recortable: RECORTABLES.test(k) };
  }).sort((a, b) => b.v - a.v);
  const umbral = Math.max(5000, R.gastosVar * 0.04);
  const deMas = filas.filter((f) => f.prom !== null && f.dif > umbral && (f.prom === 0 || f.pct >= 20)).sort((a, b) => b.dif - a.dif);
  const bajaste = filas.filter((f) => f.prom && f.dif < -umbral && f.pct <= -15).sort((a, b) => a.dif - b.dif);
  const pesada = filas.find((f) => f.share >= 0.3 && R.gastosVar > 0);
  const recortar = filas.filter((f) => f.recortable && f.v > 0).slice(0, 3);
  const ahorro20 = sum(recortar, (f) => f.vp * 0.2);
  const volverProm = sum(deMas, (f) => f.dif);
  const pendFijos = enCurso ? sum(R.fijosPend, (f) => f.monto) : 0; // mes en curso: cuento los fijos que faltan pagar
  const tasaAhorro = R.ingresos > 0 ? (R.resultado - pendFijos) / R.ingresos : null;
  const pres = Number(S.perfil?.presupuesto_mes) || 0;
  return { R, mes, enCurso, diasPas, diasMes, previos: previos.length, filas, deMas, bajaste, pesada, recortar, ahorro20, volverProm, tasaAhorro, pres, proyVar: proy(R.gastosVar) };
}
