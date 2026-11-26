import { sb, S } from '../data.js';
import { esc, hoy, money, MESES, parse, addDias, fecha, difDias } from '../util.js';
import * as L from '../logic.js';
import * as C from './cal.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal, areaChip, areaOpts } from '../ui.js';
import { AREAS } from '../config.js';

let periodo = 'mes';
let desde = L.inicioMes();

const label = () => {
  if (periodo === 'mes') { const d = parse(desde); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  return `Semana del ${fecha(desde)} al ${fecha(addDias(desde, 6))}`;
};
const mover = (n) => {
  if (periodo === 'semana') return addDias(desde, 7 * n);
  const d = parse(desde); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const fmt = (o, v) => (o.unidad === '$' ? money(v) : `${Math.round(v * 100) / 100}${o.unidad ? ' ' + o.unidad : ''}`);

const st = C.estado('Lista');
let EV = [];
const evDel = (f) => EV.filter((e) => e.fecha === f);
const xpDel = (f) => evDel(f).reduce((a, e) => a + e.xp, 0);
function resumenObj(per, ini) {
  const xs = L.objetivosDe(per, ini); if (!xs.length) return `<span class="muted sm">Sin objetivos ${per === 'mes' ? 'del mes' : 'de la semana'}</span>`;
  const ok = xs.filter((o) => L.pctObjetivo(o) >= 100).length;
  return `<div class="row sp sm"><b>${per === 'mes' ? 'Objetivos del mes' : 'Objetivos de la semana'}: ${ok} de ${xs.length}</b></div>${bar((ok / xs.length) * 100, 'var(--green)')}
    <div class="chips">${xs.map((o) => `<span class="chip" style="--c:${L.pctObjetivo(o) >= 100 ? 'var(--green)' : AREAS[o.area]?.c}">${L.pctObjetivo(o) >= 100 ? '🏆' : L.pctObjetivo(o) + '%'} ${esc(o.titulo)}</span>`).join('')}</div>`;
}
function calHtml() {
  EV = L.eventosXP(); const f = st.sel;
  if (st.vista === 'dia') { const xs = evDel(f);
    return `${C.nav(st)}<section class="card"><div class="row sp"><h2>Lo que sumaste este día</h2><b class="big-num">+${xpDel(f)} XP</b></div>
      <ul class="list">${xs.map((e) => `<li><span class="dot" style="background:${AREAS[e.area]?.c}"></span><span class="t">${esc(e.txt || '')}</span><b style="color:${AREAS[e.area]?.c}">+${e.xp}</b></li>`).join('') || vacio('Este día no sumaste XP.')}</ul></section>
      <section class="card">${resumenObj('semana', L.inicioSemana(f))}</section><section class="card">${resumenObj('mes', L.inicioMes(f))}</section>`; }
  if (st.vista === 'semana') { const tot = C.dias7(st).reduce((a, d) => a + xpDel(d), 0);
    return `${C.nav(st)}<section class="card">${resumenObj('semana', L.inicioSemana(f))}<p class="muted sm">+${tot} XP en la semana.</p></section>
      ${C.semana(st, (d) => { const xs = evDel(d); return `<b class="big-num">+${xpDel(d)} XP</b><ul class="mini">${xs.slice(0, 5).map((e) => `<li>${esc(e.txt || '')}</li>`).join('')}</ul>${xs.length > 5 ? `<span class="muted sm">y ${xs.length - 5} más</span>` : ''}`; })}`; }
  const max = Math.max(1, ...C.diasMes(st).map(xpDel));
  return `${C.nav(st)}<section class="card">${resumenObj('mes', L.inicioMes(f))}</section>
    ${C.mes(st, (d) => { const x = xpDel(d); return x ? `<span class="xp-heat" style="--a:${Math.max(0.2, x / max)};color:${x / max > 0.45 ? '#fff' : 'var(--navy)'}">+${x}</span>` : ''; })}
    <p class="muted sm">Cuanto más naranja, más XP sumaste ese día. Tocá un día para ver qué hiciste.</p>`;
}

export function html() {
  const xs = L.objetivosDe(periodo, desde);
  const logrados = xs.filter((o) => L.pctObjetivo(o) >= 100).length;
  const fin = L.finPeriodo({ periodo, desde });
  const quedan = difDias(hoy(), fin);
  const anterior = L.objetivosDe(periodo, mover(-1));
  return `
  <header class="top"><div><p class="muted up">Metas de la semana y del mes</p><h1>Objetivos</h1></div><button class="btn primary" id="b-new">+ Nuevo objetivo</button></header>
  ${C.tabs(st)}
  ${st.vista !== 'lista' ? calHtml() : `<div class="row sp wrap">
    <div class="seg"><button data-per="mes" class="${periodo === 'mes' ? 'on' : ''}">Del mes</button><button data-per="semana" class="${periodo === 'semana' ? 'on' : ''}">De la semana</button></div>
    <div class="mes"><button class="btn sm ghost" data-mov="-1" aria-label="Anterior">‹</button><b>${esc(label())}</b><button class="btn sm ghost" data-mov="1" aria-label="Siguiente">›</button></div>
  </div>
  ${xs.length ? `<section class="card"><div class="row sp"><b>${logrados} de ${xs.length} logrados</b><span class="muted sm">${quedan >= 0 && hoy() >= desde ? `quedan ${quedan + 1} ${quedan === 0 ? 'día' : 'días'}` : hoy() < desde ? 'todavía no empezó' : 'período cerrado'}</span></div>${bar((logrados / xs.length) * 100, 'var(--green)')}</section>` : ''}
  <div class="objs">${xs.map(card).join('') || `<div class="card">${vacio(`Sin objetivos para ${periodo === 'mes' ? 'este mes' : 'esta semana'}.`)}${anterior.length ? `<button class="btn" id="b-copy">Copiar los ${anterior.length} objetivos ${periodo === 'mes' ? 'del mes' : 'de la semana'} anterior</button>` : ''}</div>`}</div>
  <p class="muted sm">Pocos y claros: 3 a 5 por mes y 2 o 3 por semana. Lograr uno de la semana da +30 XP y uno del mes +60 XP.</p>`}`;
}

function card(o) {
  const v = L.valorObjetivo(o); const pct = L.pctObjetivo(o); const ok = pct >= 100;
  return `<article class="card obj ${ok ? 'ok' : ''}" style="--c:${AREAS[o.area]?.c}">
    <div class="row sp"><h3>${ok ? '🏆 ' : ''}${esc(o.titulo)}</h3>${areaChip(o.area)}</div>
    ${o.tipo === 'si_no'
      ? `<p class="sm muted">${ok ? 'Logrado' : 'Pendiente'}</p>`
      : `<div class="row sp"><b class="big-num">${fmt(o, v)}</b><span class="muted sm">de ${fmt(o, Number(o.meta))} · ${pct}%</span></div>${bar(pct, ok ? 'var(--green)' : AREAS[o.area]?.c)}`}
    ${o.auto ? `<p class="muted sm">Se calcula solo con ${o.auto === 'ingresos' ? 'tus ingresos (gym + otros)' : 'lo que te quedó en Plata'}.</p>` : ''}
    <div class="row g acts">
      ${o.tipo === 'si_no' ? `<button class="btn sm ${ok ? 'ghost' : 'ok'}" data-sino="${o.id}">${ok ? 'Desmarcar' : '✓ Logrado'}</button>` : ''}
      ${o.tipo === 'numero' && !o.auto ? `<button class="btn sm ok" data-mas="${o.id}">+1</button><button class="btn sm" data-set="${o.id}">Cargar avance</button>` : ''}
      <button class="btn sm ghost" data-edit="${o.id}">Editar</button>
    </div></article>`;
}

async function guardar(o, patch, rerender) {
  const antes = !!o.hecho;
  Object.assign(o, patch);
  const ahora = L.pctObjetivo(o) >= 100;
  if (ahora !== antes || patch.hecho !== undefined) { patch.hecho = ahora; patch.cerrado = ahora ? (o.cerrado && antes ? o.cerrado : new Date().toISOString()) : null; Object.assign(o, patch); }
  const r = await sb.from('objetivos').update(patch).eq('id', o.id);
  if (r.error) return toast(errorMsg(r.error), true);
  if (!antes && ahora) toast(`🏆 ¡Objetivo logrado! +${o.periodo === 'mes' ? 60 : 30} XP`);
  rerender();
}

// Los automáticos (ingresos/ahorro) se marcan como logrados cuando llegan a la meta
export async function revisarAutomaticos() {
  for (const o of S.objetivos.filter((x) => x.auto)) {
    const ok = L.pctObjetivo(o) >= 100;
    if (ok !== o.hecho) {
      const patch = { hecho: ok, cerrado: ok ? new Date().toISOString() : null };
      const r = await sb.from('objetivos').update(patch).eq('id', o.id);
      if (!r.error) Object.assign(o, patch);
    }
  }
}

function form(o = {}) {
  return `<form id="f-o" class="stack">
    <label>Objetivo<input name="titulo" value="${esc(o.titulo || '')}" placeholder="Ej: lanzar 10 videos, ganar $2.000.000" required></label>
    <div class="row g"><label>Período<select name="periodo"><option value="mes" ${(o.periodo || periodo) === 'mes' ? 'selected' : ''}>Mes</option><option value="semana" ${(o.periodo || periodo) === 'semana' ? 'selected' : ''}>Semana</option></select></label>
    <label>Área<select name="area">${areaOpts(o.area || 'negocios')}</select></label></div>
    <label>Cómo se mide<select name="modo">
      <option value="numero" ${o.tipo !== 'si_no' && !o.auto ? 'selected' : ''}>Con un número que voy sumando (videos, clases, kilos…)</option>
      <option value="si_no" ${o.tipo === 'si_no' ? 'selected' : ''}>Lo hice o no lo hice (lanzar algo)</option>
      <option value="ingresos" ${o.auto === 'ingresos' ? 'selected' : ''}>Plata que entra (se calcula solo)</option>
      <option value="ahorro" ${o.auto === 'ahorro' ? 'selected' : ''}>Lo que me queda en el mes (se calcula solo)</option>
    </select></label>
    <div class="row g" id="meta-row"><label>Meta<input name="meta" type="number" inputmode="decimal" step="any" min="0" value="${o.meta ?? ''}"></label>
    <label>Unidad<input name="unidad" value="${esc(o.unidad || '')}" placeholder="videos, clases, kg, $"></label></div>
    <div class="row sp"><button class="btn primary">Guardar</button>${o.id ? '<button type="button" class="btn ghost red" id="b-del">Borrar</button>' : ''}</div></form>`;
}

export function mount(v, rerender) {
  C.mount(v, st, rerender);
  v.querySelectorAll('[data-per]').forEach((b) => b.onclick = () => { periodo = b.dataset.per; desde = periodo === 'mes' ? L.inicioMes() : L.inicioSemana(); rerender(); });
  v.querySelectorAll('[data-mov]').forEach((b) => b.onclick = () => { desde = mover(Number(b.dataset.mov)); rerender(); });
  const byId = (id) => S.objetivos.find((o) => o.id === id);
  v.querySelectorAll('[data-sino]').forEach((b) => b.onclick = () => { const o = byId(b.dataset.sino); guardar(o, { hecho: !o.hecho, cerrado: !o.hecho ? new Date().toISOString() : null }, rerender); });
  v.querySelectorAll('[data-mas]').forEach((b) => b.onclick = () => { const o = byId(b.dataset.mas); guardar(o, { actual: (Number(o.actual) || 0) + 1 }, rerender); });
  v.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => {
    const o = byId(b.dataset.set);
    modal('Cargar avance', `<form id="f-a" class="stack"><label>${esc(o.titulo)}: ¿cuánto llevás?<input name="v" type="number" step="any" inputmode="decimal" value="${o.actual ?? 0}" required></label><button class="btn primary">Guardar</button></form>`, (m) => {
      m.querySelector('#f-a').onsubmit = (e) => { e.preventDefault(); cerrarModal(); guardar(o, { actual: Number(e.target.v.value) }, rerender); };
    });
  });
  const abrir = (o) => modal(o ? 'Editar objetivo' : 'Nuevo objetivo', form(o), (m) => {
    const f = m.querySelector('#f-o');
    const sync = () => { m.querySelector('#meta-row').style.display = f.modo.value === 'si_no' ? 'none' : ''; if (f.modo.value === 'ingresos' || f.modo.value === 'ahorro') f.unidad.value = '$'; };
    f.modo.onchange = sync; sync();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const modo = f.modo.value; const per = f.periodo.value;
      const row = {
        titulo: f.titulo.value.trim(), periodo: per, area: f.area.value,
        tipo: modo === 'si_no' ? 'si_no' : 'numero', auto: modo === 'ingresos' || modo === 'ahorro' ? modo : null,
        meta: modo === 'si_no' ? 1 : Number(f.meta.value) || 1, unidad: modo === 'si_no' ? null : (f.unidad.value.trim() || null),
      };
      if (!o) row.desde = per === periodo ? desde : (per === 'mes' ? L.inicioMes() : L.inicioSemana());
      else if (o.periodo !== per) row.desde = per === 'mes' ? L.inicioMes(o.desde) : L.inicioSemana(o.desde);
      const r = o ? await sb.from('objetivos').update(row).eq('id', o.id).select().single() : await sb.from('objetivos').insert(row).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (o) Object.assign(o, r.data); else S.objetivos.push(r.data);
      periodo = r.data.periodo; desde = r.data.desde;
      await revisarAutomaticos(); cerrarModal(); rerender();
    };
    const del = m.querySelector('#b-del');
    if (del) del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Seguro? Tocá de nuevo'; return; }
      const r = await sb.from('objetivos').delete().eq('id', o.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.objetivos = S.objetivos.filter((x) => x.id !== o.id); cerrarModal(); rerender();
    };
  });
  v.querySelector('#b-new').onclick = () => abrir();
  v.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => abrir(byId(b.dataset.edit)));
  const cp = v.querySelector('#b-copy');
  if (cp) cp.onclick = async () => {
    const rows = L.objetivosDe(periodo, mover(-1)).map((o) => ({ titulo: o.titulo, periodo: o.periodo, area: o.area, tipo: o.tipo, meta: o.meta, unidad: o.unidad, auto: o.auto, desde, actual: 0 }));
    const r = await sb.from('objetivos').insert(rows).select();
    if (r.error) return toast(errorMsg(r.error), true);
    S.objetivos.push(...r.data); await revisarAutomaticos(); toast('Objetivos copiados'); rerender();
  };
}
