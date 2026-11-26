import { sb, S } from '../data.js';
import { AREAS } from '../config.js';
import { esc, hoy, fechaLarga, fecha, hm, ahoraHM, parse, money, difDias } from '../util.js';
import * as L from '../logic.js';
import { toast, xpToast, errorMsg, areaChip, bar, vacio, modal, cerrarModal, formData } from '../ui.js';
import { planHtml, mountPlan } from './plan.js';

export function tabsHoy(k) {
  return `<nav class="tabs"><a href="#/hoy" class="${k === 'hoy' ? 'on' : ''}">Hoy</a><a href="#/semana" class="${k === 'semana' ? 'on' : ''}">Semana</a><a href="#/mes" class="${k === 'mes' ? 'on' : ''}">Mes</a></nav>`;
}

export function html() {
  const h = hoy(); const dia = parse(h).getDay(); const ahora = ahoraHM();
  const ev = L.eventosXP(); const tot = L.xpTotal(ev); const g = L.nivelGeneral(tot);
  const xpHoy = ev.filter((e) => e.fecha === h).reduce((s, e) => s + e.xp, 0);
  const hs = L.habitosDelDia(h); const pct = L.pctDia(h); const racha = L.racha();
  const atr = L.atrasadas();
  const cab = S.cabeza.filter((c) => c.estado === 'abierto');
  const recs = L.recordatoriosProximos(7);
  const fijos = L.fijosPorVencer(5);
  const R = L.resumenMes(h.slice(0, 7));
  const proy = S.proyectos.filter((p) => p.estado === 'en_curso' && p.fecha_obj && difDias(h, p.fecha_obj) <= 7);

  return `
  <header class="top">
    <div><p class="muted up">${esc(fechaLarga(h))}</p><h1>Hoy</h1></div>
    <div class="player">
      <div class="lv"><b>${g.n}</b><span>nivel</span></div>
      <div class="pl-info"><div class="row sp"><span>${tot} XP total</span><span class="muted">+${xpHoy} hoy</span></div>${bar(g.pct)}
      <div class="row sp sm"><span>🔥 Racha: ${racha} ${racha === 1 ? 'día' : 'días'}</span><span class="muted">Día ${pct >= 70 ? 'ganado ✓' : 'en juego'}</span></div></div>
    </div>
  </header>
  ${tabsHoy('hoy')}

  <div class="grid2">
    <section class="card">
      <div class="row sp"><h2>Misiones de hoy</h2><span class="pct ${pct >= 70 ? 'ok' : ''}">${pct}%</span></div>
      ${bar(pct, pct >= 70 ? 'var(--green)' : 'var(--accent)')}
      <ul class="checks">${hs.map((x) => { const ok = L.hecho(x.id, h); return `<li><button class="check ${ok ? 'on' : ''}" data-hab="${x.id}">
        <span class="box">${ok ? '✓' : ''}</span><span class="t">${esc(x.nombre)}</span><span class="xp" style="color:${AREAS[x.area]?.c}">+${x.xp}</span></button></li>`; }).join('') || vacio('Hoy no tenés hábitos cargados.')}</ul>
      <p class="muted sm">Con el 70% ganás el día y sumás a la racha.</p>
    </section>

    <section class="card">
      <div class="row sp"><h2>Plan del día</h2><a class="btn sm" href="#/semana">Armar semana</a></div>
      ${planHtml(h)}
    </section>
  </div>

  ${atr.length ? `<section class="card"><h2>Atrasadas <small class="muted">(${atr.length})</small></h2><ul class="tareas">${atr.map((t) => `<li class="tarea"><span class="t">${esc(t.titulo)}</span><span class="muted sm red">${fecha(t.fecha)}</span><button class="btn sm" data-mañana="${t.id}">Pasar a hoy</button><button class="btn sm ghost" data-edt="${t.id}" aria-label="Editar">✎</button></li>`).join('')}</ul></section>` : ''}

  <section class="card">
    <div class="row sp"><h2>A resolver</h2><button class="btn sm" id="b-rec">+ Recordatorio</button></div>
    <ul class="list">
      ${recs.map((r) => `<li><span class="ic">${r.tipo === 'cumple' ? '🎂' : r.tipo === 'vencimiento' ? '⏰' : '•'}</span><span class="t">${esc(r.titulo)}</span>
        <span class="muted sm ${r.vencido ? 'red' : ''}">${r.vencido ? 'vencido ' : ''}${r.prox === h ? 'hoy' : fecha(r.prox)}</span>
        ${r.repetir === 'no' ? `<button class="btn sm ok" data-rec="${r.id}">Listo</button>` : ''}</li>`).join('')}
      ${fijos.map((f) => `<li><span class="ic">$</span><span class="t">Pagar ${esc(f.concepto)} · ${money(f.monto)}</span><span class="muted sm ${f.vencido ? 'red' : ''}">${f.vencido ? 'venció' : 'vence'} el ${f.dia_vto}</span><a class="btn sm" href="#/plata">Ir</a></li>`).join('')}
      ${R.aCobrarItems.map((m) => `<li><span class="ic">↓</span><span class="t">Cobrar ${esc(m.detalle || m.categoria || '')} · ${money(m.monto)}</span><a class="btn sm" href="#/plata">Ir</a></li>`).join('')}
      ${proy.map((p) => `<li><span class="ic">◆</span><span class="t">${esc(p.nombre)}: ${esc(p.proximo_paso || '')}</span><span class="muted sm">${fecha(p.fecha_obj)}</span></li>`).join('')}
      ${cab.slice(0, 5).map((c) => `<li><span class="ic">☁</span><span class="t">${esc(c.texto)}</span><span class="muted sm">hace ${Math.max(0, difDias(c.creado.slice(0, 10), h))} d</span></li>`).join('')}
    </ul>
    ${!recs.length && !fijos.length && !R.aCobrarItems.length && !cab.length && !proy.length ? vacio('Nada pendiente. Cabeza despejada.') : ''}
    ${cab.length > 5 ? `<a class="muted sm" href="#/cabeza">Ver las ${cab.length} cosas abiertas en la Cabeza →</a>` : ''}
  </section>

  ${objetivosHtml()}

  <section class="card">
    <h2>Tus áreas</h2>
    <div class="areas">${Object.entries(L.xpPorArea(ev)).map(([k, xp]) => { const p = L.progreso(xp); const A = AREAS[k];
      return `<div class="area" style="--c:${A.c}"><div class="row sp"><span>${A.ic} ${esc(A.l)}</span><b>Nv ${p.n}</b></div>${bar(p.pct, A.c)}</div>`; }).join('')}</div>
  </section>`;
}

export function mount(v, rerender) {
  v.querySelectorAll('[data-hab]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.hab; const f = hoy(); const h = S.habitos.find((x) => x.id === id);
    const ya = S.log.find((l) => l.habito_id === id && l.fecha === f);
    b.disabled = true;
    if (ya) {
      const r = await sb.from('habito_log').delete().eq('id', ya.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.log = S.log.filter((l) => l.id !== ya.id);
    } else {
      const antes = L.pctDia(f);
      const r = await sb.from('habito_log').insert({ habito_id: id, fecha: f }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      S.log.push(r.data); xpToast(h.xp, h.area);
      if (antes < 70 && L.pctDia(f) >= 70) setTimeout(() => toast('🔥 ¡Día ganado! +10 XP'), 400);
    }
    rerender();
  });
  v.querySelectorAll('[data-rec]').forEach((b) => b.onclick = async () => {
    const r = await sb.from('recordatorios').update({ hecho: true }).eq('id', b.dataset.rec);
    if (r.error) return toast(errorMsg(r.error), true);
    S.recordatorios.find((x) => x.id === b.dataset.rec).hecho = true; rerender();
  });
  v.querySelector('#b-rec').onclick = () => nuevoRecordatorio(rerender);
  mountPlan(v, rerender);
}

export function nuevoRecordatorio(rerender) {
  modal('Nuevo recordatorio', `<form id="f-rec" class="stack">
    <label>Qué<input name="titulo" required placeholder="Ej: cumple de Tomy, pagar monotributo"></label>
    <div class="row g"><label>Fecha<input name="fecha" type="date" value="${hoy()}" required></label>
    <label>Tipo<select name="tipo"><option value="tarea">Tarea</option><option value="cumple">Cumpleaños</option><option value="vencimiento">Vencimiento</option><option value="proyecto">Proyecto</option></select></label></div>
    <label>Se repite<select name="repetir"><option value="no">No</option><option value="semanal">Cada semana</option><option value="mensual">Cada mes</option><option value="anual">Cada año</option></select></label>
    <p class="muted sm">Aparece en Hoy y en tu mail de las 7 AM una semana antes.</p>
    <button class="btn primary">Guardar</button></form>`, (m) => {
    const f = m.querySelector('#f-rec');
    f.tipo.onchange = () => { if (f.tipo.value === 'cumple') f.repetir.value = 'anual'; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await sb.from('recordatorios').insert(formData(f)).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      S.recordatorios.push(r.data); cerrarModal(); toast('Recordatorio guardado'); rerender();
    };
  });
}

function objetivosHtml() {
  const xs = [...L.objetivosDe('semana', L.inicioSemana()), ...L.objetivosDe('mes', L.inicioMes())];
  return `<section class="card"><div class="row sp"><h2>Objetivos</h2><a class="btn sm" href="#/objetivos">Ver todos</a></div>
    ${xs.map((o) => { const p = L.pctObjetivo(o); return `<div class="cat"><div class="row sp sm"><span>${p >= 100 ? '🏆 ' : ''}${esc(o.titulo)} <small class="muted">· ${o.periodo === 'mes' ? 'mes' : 'semana'}</small></span><b>${p}%</b></div>${bar(p, p >= 100 ? 'var(--green)' : AREAS[o.area]?.c)}</div>`; }).join('')
      || vacio('Sin objetivos para esta semana ni este mes. Cargalos en Objetivos.')}</section>`;
}
