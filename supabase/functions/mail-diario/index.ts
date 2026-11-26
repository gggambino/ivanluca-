// Mail diario de las 7 AM (Argentina). Lo dispara pg_cron con un token interno.
// Necesita el secreto RESEND_API_KEY (lo carga Ivan en el panel de Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const AREAS: Record<string, { l: string; c: string }> = {
  salud: { l: 'Salud', c: '#E5484D' }, ingresos: { l: 'Ingresos', c: '#2E9E55' }, proyectos: { l: 'Proyectos', c: '#3F7AC8' },
  relaciones: { l: 'Relaciones', c: '#C2559F' }, imagen: { l: 'Imagen personal', c: '#C8871E' }, bienestar: { l: 'Bienestar', c: '#2E9E9E' }, negocios: { l: 'Negocios', c: '#7E57C2' },
};
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-AR');
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDias = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const dif = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const fecha = (s: string) => { const d = parse(s); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`; };
const ultimo = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function proxima(r: any, desde: string): string {
  if (r.repetir === 'no' || r.fecha >= desde) return r.fecha;
  const d0 = parse(r.fecha); const dd = parse(desde);
  const f3 = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  if (r.repetir === 'anual') for (const y of [dd.getUTCFullYear(), dd.getUTCFullYear() + 1]) { const c = f3(y, d0.getUTCMonth(), Math.min(d0.getUTCDate(), ultimo(y, d0.getUTCMonth()))); if (c >= desde) return c; }
  if (r.repetir === 'mensual') for (let i = 0; i < 3; i++) { const y = dd.getUTCFullYear() + Math.floor((dd.getUTCMonth() + i) / 12); const m = (dd.getUTCMonth() + i) % 12; const c = f3(y, m, Math.min(d0.getUTCDate(), ultimo(y, m))); if (c >= desde) return c; }
  if (r.repetir === 'semanal') return addDias(desde, (d0.getUTCDay() - dd.getUTCDay() + 7) % 7);
  return r.fecha;
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!; const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: cfg } = await db.from('config').select('valor').eq('clave', 'cron_token').single();
  if (!cfg || req.headers.get('x-cron-token') !== cfg.valor) return new Response('no autorizado', { status: 401 });
  const resend = Deno.env.get('RESEND_API_KEY');
  if (!resend) return new Response('falta RESEND_API_KEY', { status: 500 });
  const soloVer = new URL(req.url).searchParams.get('preview') === '1';

  // hoy en Argentina (UTC-3)
  const hoy = ymd(new Date(Date.now() - 3 * 3600000));
  const dia = parse(hoy).getUTCDay(); const mes = hoy.slice(0, 7);
  const { data: perfiles } = await db.from('perfil').select('*').eq('mail_diario', true);
  const out: unknown[] = [];

  for (const P of perfiles || []) {
    const u = P.user_id; const q = (t: string) => db.from(t).select('*').eq('user_id', u);
    const [ru, ha, lo, ca, re, fi, fp, mo, pr, ib] = await Promise.all([
      q('rutina').eq('dia', dia).order('desde'), q('habitos').eq('activo', true).order('orden'),
      q('habito_log').gte('fecha', addDias(hoy, -60)), q('cabeza').eq('estado', 'abierto').order('creado'),
      q('recordatorios'), q('gastos_fijos').eq('activo', true), q('fijos_pagos').eq('mes', mes),
      q('movimientos').gte('fecha', mes + '-01'), q('proyectos').eq('estado', 'en_curso').order('prioridad'), q('ingresos_bb').gte('fecha', mes + '-01'),
    ]);
    const habitos = (ha.data || []).filter((h: any) => (h.dias || []).includes(dia));
    // racha
    const log = lo.data || [];
    const todos = ha.data || [];
    const ganado = (f: string) => { const d = parse(f).getUTCDay(); const hs = todos.filter((h: any) => (h.dias || []).includes(d)); if (!hs.length) return false; return hs.filter((h: any) => log.some((l: any) => l.habito_id === h.id && l.fecha === f)).length / hs.length >= 0.7; };
    let racha = 0; let f = addDias(hoy, -1); while (ganado(f)) { racha++; f = addDias(f, -1); }

    const recs = (re.data || []).filter((r: any) => !(r.repetir === 'no' && r.hecho)).map((r: any) => ({ ...r, prox: proxima(r, hoy) }))
      .filter((r: any) => (r.repetir === 'no' && r.fecha < hoy) || dif(hoy, r.prox) <= 7).sort((a: any, b: any) => (a.prox < b.prox ? -1 : 1));
    const cumples = recs.filter((r: any) => r.tipo === 'cumple');
    const tareas = recs.filter((r: any) => r.tipo !== 'cumple');
    const pagados = new Set((fp.data || []).map((p: any) => p.fijo_id)); const dhoy = parse(hoy).getUTCDate();
    const fijos = (fi.data || []).filter((x: any) => !pagados.has(x.id) && x.dia_vto && (x.dia_vto < dhoy || x.dia_vto - dhoy <= 5));
    const movs = mo.data || [];
    const aCobrar = movs.filter((m: any) => m.tipo === 'ingreso' && m.estado === 'pendiente');
    const ingresos = (ib.data || []).reduce((s: number, x: any) => s + Number(x.monto), 0) + movs.filter((m: any) => m.tipo === 'ingreso' && m.estado === 'hecho').reduce((s: number, x: any) => s + Number(x.monto), 0);
    const gastos = movs.filter((m: any) => m.tipo === 'gasto' && m.estado === 'hecho').reduce((s: number, x: any) => s + Number(x.monto), 0) + (fp.data || []).reduce((s: number, x: any) => s + Number(x.monto || 0), 0);
    const cab = ca.data || []; const proys = pr.data || [];

    const li = (t: string) => `<li style="margin:0 0 6px">${t}</li>`;
    const sec = (titulo: string, body: string) => body ? `<h2 style="font:700 13px Arial;letter-spacing:1.5px;text-transform:uppercase;color:#C8102E;margin:26px 0 10px">${titulo}</h2>${body}` : '';
    const ul = (xs: string[]) => xs.length ? `<ul style="padding-left:18px;margin:0;font:15px/1.45 Arial;color:#1a1a1a">${xs.join('')}</ul>` : '';
    const d = parse(hoy);

    const html = `<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a">
      <div style="font:900 26px Arial;letter-spacing:1px">IVAN <span style="color:#C8102E">LUCA</span></div>
      <div style="color:#777;font-size:14px;margin-top:2px">${DIAS[dia]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} · racha ${racha} ${racha === 1 ? 'día' : 'días'} 🔥</div>
      ${sec('Estructura del día', (ru.data || []).length ? `<table style="border-collapse:collapse;width:100%;font:14px Arial">${(ru.data || []).map((b: any) => `<tr><td style="padding:6px 10px 6px 0;color:#777;white-space:nowrap;border-left:3px solid ${AREAS[b.area]?.c || '#999'};padding-left:10px">${String(b.desde).slice(0, 5)}–${String(b.hasta).slice(0, 5)}</td><td style="padding:6px 0">${esc(b.titulo)}</td></tr>`).join('')}</table>` : '<p style="color:#777">Día libre en la agenda.</p>')}
      ${sec('Misiones de hoy', ul(habitos.map((h: any) => li(`☐ ${esc(h.nombre)} <span style="color:${AREAS[h.area]?.c};font-size:12px">+${h.xp}</span>`))))}
      ${sec('Cosas a resolver', ul([
        ...fijos.map((x: any) => li(`💸 Pagar <b>${esc(x.concepto)}</b> · ${money(x.monto)} · ${x.dia_vto < dhoy ? '<b style="color:#C8102E">venció</b>' : 'vence'} el ${x.dia_vto}`)),
        ...tareas.map((r: any) => li(`${r.tipo === 'vencimiento' ? '⏰' : '•'} ${esc(r.titulo)} · ${r.prox < hoy ? '<b style="color:#C8102E">vencido</b>' : r.prox === hoy ? '<b>hoy</b>' : fecha(r.prox)}`)),
        ...aCobrar.map((m: any) => li(`↓ Cobrar ${esc(m.detalle || m.categoria)} · ${money(m.monto)}`)),
        ...cab.slice(0, 6).map((c: any) => li(`☁ ${esc(c.texto)} <span style="color:#999;font-size:12px">(hace ${dif(String(c.creado).slice(0, 10), hoy)} d)</span>`)),
      ]))}
      ${sec('Puntos importantes', ul([
        ...cumples.map((r: any) => li(`🎂 <b>${esc(r.titulo)}</b> · ${r.prox === hoy ? '<b>¡hoy!</b>' : fecha(r.prox)}`)),
        ...proys.slice(0, 4).map((p: any) => li(`◆ <b>${esc(p.nombre)}</b>${p.proximo_paso ? ': ' + esc(p.proximo_paso) : ' (sin próximo paso)'}`)),
        li(`💰 ${MESES[d.getUTCMonth()]}: entró ${money(ingresos)}, salió ${money(gastos)}, te quedan <b>${money(ingresos - gastos)}</b>`),
        cab.length > 6 ? li(`Tenés ${cab.length} cosas abiertas en la Cabeza. Revisalas el domingo.`) : '',
      ]))}
      <p style="margin-top:28px"><a href="https://ivanluca.vercel.app/#/hoy" style="background:#C8102E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font:700 15px Arial;display:inline-block">Abrir Ivan Luca</a></p>
    </div>`;

    if (soloVer) { out.push({ html }); continue; }
    const to = P.mail_destino || (await db.auth.admin.getUserById(u)).data.user?.email;
    if (!to) continue;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') || 'Ivan Luca <onboarding@resend.dev>', to: [to], subject: `Tu ${DIAS[dia].toLowerCase()}: ${habitos.length} misiones, ${fijos.length + tareas.length + cab.length} cosas a resolver`, html }),
    });
    out.push({ to, status: r.status, body: await r.text() });
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
