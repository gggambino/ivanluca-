import { SUPABASE_URL, SUPABASE_KEY, BB_URL, BB_KEY } from './config.js';
import { hoy, addDias } from './util.js';
import { SEED } from './seed.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
// Cliente separado para Base Bambino (solo lectura, otra sesión guardada aparte)
export const bb = window.supabase.createClient(BB_URL, BB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'il-bb-auth', detectSessionInUrl: false },
});

export const S = {
  user: null, perfil: null,
  habitos: [], log: [], cabeza: [], movs: [], fijos: [], fijosPagos: [],
  proyectos: [], recordatorios: [], rutina: [], salud: [], ingBB: [],
  bbUser: null,
};

const chk = (r) => { if (r.error) throw r.error; return r.data || []; };

export async function cargarTodo() {
  const desde = addDias(hoy(), -400);
  const [pe, ha, lo, ca, mo, fi, fp, pr, re, ru, sa, ib] = await Promise.all([
    sb.from('perfil').select('*').maybeSingle(),
    sb.from('habitos').select('*').order('orden'),
    sb.from('habito_log').select('*').gte('fecha', desde),
    sb.from('cabeza').select('*').order('creado', { ascending: false }),
    sb.from('movimientos').select('*').gte('fecha', desde).order('fecha', { ascending: false }),
    sb.from('gastos_fijos').select('*').order('orden'),
    sb.from('fijos_pagos').select('*'),
    sb.from('proyectos').select('*').order('prioridad').order('creado'),
    sb.from('recordatorios').select('*').order('fecha'),
    sb.from('rutina').select('*').order('dia').order('desde'),
    sb.from('salud_log').select('*').order('fecha', { ascending: false }),
    sb.from('ingresos_bb').select('*').gte('fecha', desde),
  ]);
  if (pe.error) throw pe.error;
  S.perfil = pe.data;
  S.habitos = chk(ha); S.log = chk(lo); S.cabeza = chk(ca); S.movs = chk(mo);
  S.fijos = chk(fi); S.fijosPagos = chk(fp); S.proyectos = chk(pr); S.recordatorios = chk(re);
  S.rutina = chk(ru); S.salud = chk(sa); S.ingBB = chk(ib);
}

// Primera vez: carga los datos iniciales tomados de las planillas de Ivan.
export async function sembrarSiHaceFalta() {
  if (S.perfil) return false;
  const r = await sb.from('perfil').insert({ plan_entreno: SEED.plan_entreno, plan_dieta: SEED.plan_dieta, objetivos: SEED.objetivos, mail_destino: S.user.email }).select().single();
  if (r.error) throw r.error;
  await Promise.all([
    sb.from('habitos').insert(SEED.habitos.map((h, i) => ({ ...h, orden: i }))),
    sb.from('gastos_fijos').insert(SEED.fijos.map((f, i) => ({ ...f, orden: i }))),
    sb.from('proyectos').insert(SEED.proyectos),
    sb.from('rutina').insert(SEED.rutina),
    sb.from('salud_log').insert({ fecha: hoy(), peso: 86, notas: 'Punto de partida (de tu planilla)' }),
  ]).then((rs) => rs.forEach(chk));
  return true;
}

// ---------- Base Bambino (solo lectura) ----------
export async function bbSesion() {
  const { data } = await bb.auth.getSession();
  S.bbUser = data.session?.user || null;
  return S.bbUser;
}

export async function sincronizarBB() {
  if (!(await bbSesion())) return { ok: false, motivo: 'sin-sesion' };
  const desde = addDias(hoy(), -400);
  const r = await bb.from('pagos').select('id, fecha, monto').gte('fecha', desde);
  if (r.error) return { ok: false, motivo: r.error.message };
  const filas = (r.data || []).filter((p) => p.fecha && Number(p.monto)).map((p) => ({ bb_id: String(p.id), fecha: String(p.fecha).slice(0, 10), monto: Number(p.monto), detalle: 'Cobro Base Bambino' }));
  if (filas.length) {
    const up = await sb.from('ingresos_bb').upsert(filas, { onConflict: 'user_id,bb_id' });
    if (up.error) return { ok: false, motivo: up.error.message };
  }
  // borra de la copia los cobros que ya no existen en Base Bambino
  const ids = new Set(filas.map((f) => f.bb_id));
  const viejos = S.ingBB.filter((x) => x.fecha >= desde && !ids.has(x.bb_id)).map((x) => x.bb_id);
  if (viejos.length) await sb.from('ingresos_bb').delete().in('bb_id', viejos);
  const ib = await sb.from('ingresos_bb').select('*').gte('fecha', desde);
  if (!ib.error) S.ingBB = ib.data || [];
  localStorage.setItem('il-bb-sync', new Date().toISOString());
  return { ok: true, n: filas.length };
}
