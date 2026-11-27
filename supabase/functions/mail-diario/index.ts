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
const money = (n: number) => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n || 0)).toLocaleString('es-AR');
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
    const [ru, ha, lo, ca, re, fi, fp, mo, pr, ib, tk, dp, gf, gg] = await Promise.all([
      q('rutina').eq('dia', dia).order('desde'), q('habitos').eq('activo', true).order('orden'),
      q('habito_log').gte('fecha', addDias(hoy, -60)), q('cabeza').eq('estado', 'abierto').order('creado'),
      q('recordatorios'), q('gastos_fijos').eq('activo', true), q('fijos_pagos').eq('mes', mes),
      q('movimientos').gte('fecha', mes + '-01'), q('proyectos').eq('estado', 'en_curso').order('prioridad'), q('ingresos_bb').gte('fecha', mes + '-01'),
      q('tareas').eq('hecho', false).lte('fecha', hoy).gte('fecha', addDias(hoy, -30)).order('hora', { nullsFirst: false }),
      q('dias_plan').eq('fecha', hoy),
      q('gym_fijos'), q('gym_gastos').gte('fecha', mes + '-01'),
    ]);
    const todas = tk.data || []; const bloquesPropios = todas.filter((t: any) => t.es_bloque && t.fecha === hoy);
    const tks = todas.filter((t: any) => !t.es_bloque); const tkHoy = tks.filter((t: any) => t.fecha === hoy); const tkAtr = tks.filter((t: any) => t.fecha < hoy);
    // Si personalizó el día, su agenda reemplaza a la semana tipo
    const base = (dp.data || []).length ? [] : (ru.data || []);
    const hh = (x: any) => String(x || '').slice(0, 5);
    const linea = [...base.map((b: any) => ({ h: hh(b.desde), h2: hh(b.hasta), t: esc(b.titulo), c: AREAS[b.area]?.c || '#999' })),
      ...bloquesPropios.map((b: any) => ({ h: hh(b.hora), h2: hh(b.hasta), t: esc(b.titulo), c: AREAS[b.area]?.c || '#999' })),
      ...tkHoy.filter((t: any) => t.hora).map((t: any) => ({ h: hh(t.hora), h2: hh(t.hasta), t: `<b>☐ ${esc(t.titulo)}</b>`, c: '#FF6B2C' }))].sort((a, b) => (a.h < b.h ? -1 : 1));
    const habitos = (ha.data || []).filter((h: any) => (h.dias || []).includes(dia));
    // racha
    const log = lo.data || [];
    const todos = ha.data || [];
    const ganado = (f: string) => { const d = parse(f).getUTCDay(); const hs = todos.filter((h: any) => (h.dias || []).includes(d)); if (!hs.length) return false; return hs.filter((h: any) => log.some((l: any) => l.habito_id === h.id && l.fecha === f)).length / hs.length >= 0.7; };
    let racha = 0; let f = addDias(hoy, -1); while (ganado(f)) { racha++; f = addDias(f, -1); }

    const recs = (re.data || []).filter((r: any) => !(r.repetir === 'no' && r.hecho)).map((r: any) => ({ ...r, prox: proxima(r, hoy) }))
      .filter((r: any) => (r.repetir === 'no' && r.fecha < hoy) || dif(hoy, r.prox) <= 7).sort((a: any, b: any) => (a.prox < b.prox ? -1 : 1));
    const cumples = recs.filter((r: any) => r.tipo === 'cumple');
    const pend = recs.filter((r: any) => r.tipo !== 'cumple');
    const pagados = new Set((fp.data || []).map((p: any) => p.fijo_id)); const dhoy = parse(hoy).getUTCDate();
    const fijos = (fi.data || []).filter((x: any) => !pagados.has(x.id) && x.dia_vto && (x.dia_vto < dhoy || x.dia_vto - dhoy <= 5));
    const movs = mo.data || [];
    const aCobrar = movs.filter((m: any) => m.tipo === 'ingreso' && m.estado === 'pendiente');
    // gym neto = cobros de Base Bambino − costos del gym (fijos vigentes, con ajuste del mes si hay, + otros gastos)
    const ggs = gg.data || [];
    const fijosGym = (gf.data || []).filter((f: any) => (!f.desde || f.desde <= mes) && (!f.hasta || mes <= f.hasta));
    const costosGym = fijosGym.reduce((s: number, f: any) => { const aj = ggs.find((g: any) => g.fijo_id === f.id); return s + Number(aj ? aj.monto : f.monto); }, 0)
      + ggs.filter((g: any) => !g.fijo_id || !fijosGym.some((f: any) => f.id === g.fijo_id)).reduce((s: number, g: any) => s + Number(g.monto), 0);
    const ingresos = (ib.data || []).reduce((s: number, x: any) => s + Number(x.monto), 0) - costosGym + movs.filter((m: any) => m.tipo === 'ingreso' && m.estado === 'hecho').reduce((s: number, x: any) => s + Number(x.monto), 0);
    const gastos = movs.filter((m: any) => m.tipo === 'gasto' && m.estado === 'hecho').reduce((s: number, x: any) => s + Number(x.monto), 0) + (fp.data || []).reduce((s: number, x: any) => s + Number(x.monto || 0), 0);
    const cab = ca.data || []; const proys = pr.data || [];

    const li = (t: string) => `<li style="margin:0 0 6px">${t}</li>`;
    const sec = (titulo: string, body: string) => body ? `<h2 style="font:700 13px Arial;letter-spacing:1.5px;text-transform:uppercase;color:#FF6B2C;margin:26px 0 10px">${titulo}</h2>${body}` : '';
    const ul = (xs: string[]) => xs.length ? `<ul style="padding-left:18px;margin:0;font:15px/1.45 Arial;color:#1a1a1a">${xs.join('')}</ul>` : '';
    const d = parse(hoy);
    // Día 1: cierre del mes anterior con análisis por categoría (vs promedio de los 3 meses previos)
    let cierre = '';
    if (dhoy === 1) {
      const mesN = (n: number) => { const x = parse(mes + '-01'); x.setUTCMonth(x.getUTCMonth() + n); return ymd(x).slice(0, 7); };
      const mp = mesN(-1); const finMp = addDias(mes + '-01', -1);
      const [mv4, fpp, ibp, ggp] = await Promise.all([
        q('movimientos').gte('fecha', mesN(-4) + '-01').lte('fecha', finMp).eq('estado', 'hecho'),
        q('fijos_pagos').eq('mes', mp), q('ingresos_bb').gte('fecha', mp + '-01').lte('fecha', finMp), q('gym_gastos').gte('fecha', mp + '-01').lte('fecha', finMp),
      ]);
      const mvs = mv4.data || []; const enMes = (m: any, mm: string) => String(m.fecha).slice(0, 7) === mm;
      const fijosGymP = (gf.data || []).filter((f: any) => (!f.desde || f.desde <= mp) && (!f.hasta || mp <= f.hasta)); const ggsP = ggp.data || [];
      const costosGymP = fijosGymP.reduce((s: number, f: any) => { const aj = ggsP.find((g: any) => g.fijo_id === f.id); return s + Number(aj ? aj.monto : f.monto); }, 0)
        + ggsP.filter((g: any) => !g.fijo_id || !fijosGymP.some((f: any) => f.id === g.fijo_id)).reduce((s: number, g: any) => s + Number(g.monto), 0);
      const sumar = (xs: any[]) => xs.reduce((s: number, x: any) => s + Number(x.monto || 0), 0);
      const ingP = sumar(ibp.data || []) - costosGymP + sumar(mvs.filter((m: any) => m.tipo === 'ingreso' && enMes(m, mp)));
      const varP = mvs.filter((m: any) => m.tipo === 'gasto' && enMes(m, mp));
      const gasP = sumar(varP) + sumar(fpp.data || []); const resP = ingP - gasP;
      const porCat = (xs: any[]) => xs.reduce((o: Record<string, number>, m: any) => { const k = m.categoria || 'Otros'; o[k] = (o[k] || 0) + Number(m.monto); return o; }, {});
      const cats = porCat(varP); const prev = [-2, -3, -4].map(mesN).map((mm) => porCat(mvs.filter((m: any) => m.tipo === 'gasto' && enMes(m, mm)))).filter((o) => Object.keys(o).length);
      const prom = (k: string) => prev.length ? prev.reduce((s, o) => s + (o[k] || 0), 0) / prev.length : null;
      const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const deMas = Object.entries(cats).map(([k, v]) => ({ k, v, p: prom(k) })).filter((x) => x.p !== null && x.v - (x.p as number) > Math.max(5000, sumar(varP) * 0.04) && (!x.p || x.v / (x.p as number) >= 1.2)).sort((a, b) => (b.v - (b.p as number)) - (a.v - (a.p as number)));
      const nm = MESES[Number(mp.slice(5)) - 1];
      cierre = sec(`Cierre de ${nm}`, ul([
        li(`${resP >= 0 ? '🏆' : '⚠️'} Entró ${money(ingP)}, salió ${money(gasP)}: <b style="color:${resP >= 0 ? '#2E9E55' : '#C8102E'}">${resP >= 0 ? 'te quedaron ' + money(resP) : 'quedaste ' + money(-resP) + ' en rojo'}</b>${ingP > 0 ? ` (${Math.round((resP / ingP) * 100)}% de lo que entró)` : ''}.`),
        ...top.map(([k, v]) => { const p = prom(k); return li(`${esc(k)}: ${money(v)}${p ? ` <span style="color:${v > p * 1.2 ? '#C8102E' : v < p * 0.85 ? '#2E9E55' : '#777'};font-size:12px">(${v >= p ? '▲' : '▼'} ${Math.abs(Math.round(((v - p) / p) * 100))}% vs promedio)</span>` : ''}`); }),
        ...deMas.slice(0, 2).map((x) => li(`🔺 Para reducir: <b>${esc(x.k)}</b>. Volviendo a tu promedio ahorrás ${money(x.v - (x.p as number))} por mes.`)),
      ]) + '<p style="font:13px Arial;color:#777;margin:8px 0 0">El análisis completo está en Plata > Mes.</p>');
    }


    const html = `<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a">
      <div style="font:900 26px Arial;letter-spacing:1px;color:#0B1F3A">IVAN <span style="color:#FF6B2C">LUCA</span></div>
      <div style="color:#777;font-size:14px;margin-top:2px">${DIAS[dia]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} · racha ${racha} ${racha === 1 ? 'día' : 'días'} 🔥</div>
      ${cierre}
      ${sec('Estructura del día', linea.length ? `<table style="border-collapse:collapse;width:100%;font:14px Arial">${linea.map((b) => `<tr><td style="padding:6px 10px 6px 0;color:#7A8AA0;white-space:nowrap;border-left:3px solid ${b.c};padding-left:10px">${b.h}${b.h2 ? '–' + b.h2 : ''}</td><td style="padding:6px 0">${b.t}</td></tr>`).join('')}</table>` : '<p style="color:#777">Día libre en la agenda.</p>')}
      ${sec('Tareas de hoy', ul([
        ...tkHoy.filter((t: any) => !t.hora).map((t: any) => li(`☐ ${t.prioridad === 1 ? '<b style="color:#FF6B2C">!</b> ' : ''}${esc(t.titulo)}`)),
        ...tkAtr.map((t: any) => li(`☐ ${esc(t.titulo)} <span style="color:#E5484D;font-size:12px">(atrasada, era del ${fecha(t.fecha)})</span>`)),
      ]))}
      ${sec('Misiones de hoy', ul(habitos.map((h: any) => li(`☐ ${esc(h.nombre)} <span style="color:${AREAS[h.area]?.c};font-size:12px">+${h.xp}</span>`))))}
      ${sec('Cosas a resolver', ul([
        ...fijos.map((x: any) => li(`💸 Pagar <b>${esc(x.concepto)}</b> · ${money(x.monto)} · ${x.dia_vto < dhoy ? '<b style="color:#C8102E">venció</b>' : 'vence'} el ${x.dia_vto}`)),
        ...pend.map((r: any) => li(`${r.tipo === 'vencimiento' ? '⏰' : '•'} ${esc(r.titulo)} · ${r.prox < hoy ? '<b style="color:#C8102E">vencido</b>' : r.prox === hoy ? '<b>hoy</b>' : fecha(r.prox)}`)),
        ...aCobrar.map((m: any) => li(`↓ Cobrar ${esc(m.detalle || m.categoria)} · ${money(m.monto)}`)),
        ...cab.slice(0, 6).map((c: any) => li(`☁ ${esc(c.texto)} <span style="color:#999;font-size:12px">(hace ${dif(String(c.creado).slice(0, 10), hoy)} d)</span>`)),
      ]))}
      ${sec('Puntos importantes', ul([
        ...cumples.map((r: any) => li(`🎂 <b>${esc(r.titulo)}</b> · ${r.prox === hoy ? '<b>¡hoy!</b>' : fecha(r.prox)}`)),
        ...proys.slice(0, 4).map((p: any) => li(`◆ <b>${esc(p.nombre)}</b>${p.proximo_paso ? ': ' + esc(p.proximo_paso) : ' (sin próximo paso)'}`)),
        li(`💰 ${MESES[d.getUTCMonth()]}: entró ${money(ingresos)}, salió ${money(gastos)}, te quedan <b>${money(ingresos - gastos)}</b>`),
        cab.length > 6 ? li(`Tenés ${cab.length} cosas abiertas en la Cabeza. Revisalas el domingo.`) : '',
      ]))}
      <p style="margin-top:28px"><a href="https://ivanluca.vercel.app/#/hoy" style="background:#FF6B2C;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font:700 15px Arial;display:inline-block">Abrir Ivan Luca</a></p>
    </div>`;

    if (soloVer) { out.push({ html }); continue; }
    const to = P.mail_destino || (await db.auth.admin.getUserById(u)).data.user?.email;
    if (!to) continue;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') || 'Ivan Luca <onboarding@resend.dev>', to: [to], subject: `Tu ${DIAS[dia].toLowerCase()}: ${habitos.length} misiones, ${tkHoy.length + tkAtr.length} tareas, ${fijos.length + pend.length + cab.length} cosas a resolver`, html }),
    });
    out.push({ to, status: r.status, body: await r.text() });
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
