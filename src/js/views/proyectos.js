import { sb, S } from '../data.js';
import { esc, fecha, hoy, difDias } from '../util.js';
import { toast, errorMsg, vacio, modal, cerrarModal, areaChip, areaOpts, formData } from '../ui.js';
import * as C from './cal.js';

const ESTADOS = [
  { k: 'en_curso', l: 'En curso', d: 'Lo estoy moviendo ahora' },
  { k: 'idea', l: 'Ideas', d: 'Algún día, todavía no' },
  { k: 'pausado', l: 'Pausados', d: 'Frenados a propósito' },
  { k: 'hecho', l: 'Hechos', d: 'Logros desbloqueados' },
];
let tab = 'en_curso';
const st = C.estado('Tablero');
const vencen = (f) => S.proyectos.filter((p) => p.fecha_obj === f);
const terminados = (f) => S.proyectos.filter((p) => p.estado === 'hecho' && p.cerrado && p.cerrado.slice(0, 10) === f);
const nuevos = (f) => S.proyectos.filter((p) => p.creado && p.creado.slice(0, 10) === f);
const tareasP = (f) => S.tareas.filter((t) => t.fecha === f && !t.es_bloque && t.area === 'proyectos');

export function html() {
  const cnt = (k) => S.proyectos.filter((p) => p.estado === k).length;
  const xs = S.proyectos.filter((p) => p.estado === tab);
  const enCurso = cnt('en_curso');
  return `
  <header class="top"><div><p class="muted up">Proyectos en curso e ideas para después</p><h1>Proyectos</h1></div><button class="btn primary" id="b-new">+ Nuevo</button></header>
  ${enCurso > 5 ? `<p class="aviso">Tenés ${enCurso} proyectos en curso. Con más de 3 o 4 a la vez, ninguno avanza. Pasá alguno a Pausado.</p>` : ''}
  ${C.tabs(st)}
  ${st.vista !== 'lista' ? calHtml() : `<div class="tabs">${ESTADOS.map((e) => `<button data-tab="${e.k}" class="${tab === e.k ? 'on' : ''}">${e.l} (${cnt(e.k)})</button>`).join('')}</div>
  <p class="muted sm">${esc(ESTADOS.find((e) => e.k === tab).d)}</p>
  <div class="proys">${xs.map(card).join('') || `<div class="card">${vacio('Nada acá todavía.')}</div>`}</div>`}`;
}

function calHtml() {
  const f = st.sel;
  if (st.vista === 'dia') { const v = vencen(f); const t = terminados(f); const n = nuevos(f); const ts = tareasP(f);
    return `${C.nav(st)}
    ${v.length ? `<h3 class="muted up">Fecha objetivo este día</h3><div class="proys">${v.map(card).join('')}</div>` : ''}
    ${t.length ? `<h3 class="muted up">Terminados este día 🏆</h3><div class="proys">${t.map(card).join('')}</div>` : ''}
    ${n.length ? `<h3 class="muted up">Nuevos este día</h3><div class="proys">${n.map(card).join('')}</div>` : ''}
    <section class="card"><div class="row sp"><h2>Tareas de proyectos</h2><a class="btn sm" href="#/semana">Planificar</a></div>
      <ul class="list">${ts.map((x) => `<li><span class="ic">${x.hecho ? '✓' : '○'}</span><span class="t">${x.hora ? `<b>${x.hora.slice(0, 5)}</b> ` : ''}${esc(x.titulo)}</span></li>`).join('') || vacio('Sin tareas de proyectos este día. Sumalas desde Hoy o Semana.')}</ul></section>
    ${!v.length && !t.length && !n.length ? `<p class="muted sm">Para que un proyecto aparezca en el calendario, ponele fecha objetivo (Editar).</p>` : ''}`; }
  const cel = (d, larga) => { const v = vencen(d); const t = terminados(d); const ts = tareasP(d);
    return `${v.map((p) => `<span class="cal-e ${p.estado === 'hecho' ? 'ok' : ''}">◆ <i>${esc(p.nombre)}</i></span>`).join('')}${t.filter((p) => !v.includes(p)).map((p) => `<span class="cal-e ok">🏆 <i>${esc(p.nombre)}</i></span>`).join('')}${ts.length ? `<span class="cal-k">${ts.filter((x) => x.hecho).length}/${ts.length} tareas</span>` : ''}${larga && !v.length && !t.length && !ts.length ? '<span class="muted sm">Libre</span>' : ''}`; };
  if (st.vista === 'semana') return `${C.nav(st)}${C.semana(st, (d) => `<div class="sd-list">${cel(d, true)}</div>`)}`;
  return `${C.nav(st)}${C.mes(st, (d) => cel(d))}<p class="muted sm">◆ fecha objetivo de un proyecto · 🏆 terminado · tareas de proyectos hechas / total.</p>`;
}

function card(p) {
  const venc = p.fecha_obj && p.estado !== 'hecho' ? difDias(hoy(), p.fecha_obj) : null;
  return `<article class="card proy">
    <div class="row sp"><h3>${esc(p.nombre)}</h3>${areaChip(p.area)}</div>
    ${p.proximo_paso ? `<p><span class="muted sm up">Próximo paso</span><br>${esc(p.proximo_paso)}</p>` : p.estado !== 'hecho' ? '<p class="muted sm">Sin próximo paso. Sin eso no avanza.</p>' : ''}
    ${p.notas ? `<p class="muted sm">${esc(p.notas)}</p>` : ''}
    ${venc !== null ? `<p class="sm ${venc < 0 ? 'red' : ''}">Objetivo: ${fecha(p.fecha_obj)} ${venc < 0 ? '(pasado)' : `(en ${venc} días)`}</p>` : ''}
    <div class="row g acts">
      ${p.estado !== 'en_curso' && p.estado !== 'hecho' ? `<button class="btn sm" data-est="en_curso" data-id="${p.id}">▶ Arrancar</button>` : ''}
      ${p.estado === 'en_curso' ? `<button class="btn sm ok" data-est="hecho" data-id="${p.id}">✓ Terminado</button><button class="btn sm" data-est="pausado" data-id="${p.id}">Pausar</button>` : ''}
      ${p.estado === 'hecho' ? `<button class="btn sm ghost" data-est="en_curso" data-id="${p.id}">Reabrir</button>` : ''}
      <button class="btn sm ghost" data-edit="${p.id}">Editar</button>
    </div></article>`;
}

function form(p = {}) {
  return `<form id="f-pr" class="stack">
    <label>Nombre<input name="nombre" value="${esc(p.nombre || '')}" required></label>
    <div class="row g"><label>Área<select name="area">${areaOpts(p.area || 'proyectos')}</select></label>
    <label>Estado<select name="estado">${ESTADOS.map((e) => `<option value="${e.k}" ${e.k === (p.estado || 'idea') ? 'selected' : ''}>${e.l}</option>`).join('')}</select></label></div>
    <label>Próximo paso<input name="proximo_paso" value="${esc(p.proximo_paso || '')}" placeholder="La acción más chica que lo mueve"></label>
    <div class="row g"><label>Fecha objetivo<input name="fecha_obj" type="date" value="${p.fecha_obj || ''}"></label>
    <label>Prioridad<select name="prioridad">${[1, 2, 3].map((n) => `<option value="${n}" ${n === (p.prioridad || 2) ? 'selected' : ''}>${['', 'Alta', 'Media', 'Baja'][n]}</option>`).join('')}</select></label></div>
    <label>Notas<textarea name="notas" rows="3">${esc(p.notas || '')}</textarea></label>
    <div class="row sp"><button class="btn primary">Guardar</button>${p.id ? '<button type="button" class="btn ghost red" id="b-del">Borrar</button>' : ''}</div></form>`;
}

export function mount(v, rerender) {
  v.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; rerender(); });
  C.mount(v, st, rerender);
  v.querySelectorAll('[data-est]').forEach((b) => b.onclick = async () => {
    const estado = b.dataset.est; const id = b.dataset.id;
    const patch = { estado, cerrado: estado === 'hecho' ? new Date().toISOString() : null };
    const r = await sb.from('proyectos').update(patch).eq('id', id);
    if (r.error) return toast(errorMsg(r.error), true);
    Object.assign(S.proyectos.find((p) => p.id === id), patch);
    toast(estado === 'hecho' ? '🏆 Proyecto terminado. +50 XP' : estado === 'en_curso' ? 'En marcha. +10 XP' : 'Pausado'); rerender();
  });
  const abrir = (p) => modal(p ? 'Editar proyecto' : 'Nuevo proyecto o idea', form(p), (m) => {
    const f = m.querySelector('#f-pr');
    f.onsubmit = async (e) => {
      e.preventDefault(); const d = formData(f);
      const row = { ...d, prioridad: Number(d.prioridad), fecha_obj: d.fecha_obj || null, proximo_paso: d.proximo_paso || null, notas: d.notas || null };
      const r = p ? await sb.from('proyectos').update(row).eq('id', p.id).select().single() : await sb.from('proyectos').insert(row).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (p) Object.assign(p, r.data); else S.proyectos.push(r.data);
      tab = r.data.estado; cerrarModal(); rerender();
    };
    const del = m.querySelector('#b-del');
    if (del) del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Seguro? Tocá de nuevo'; return; }
      const r = await sb.from('proyectos').delete().eq('id', p.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.proyectos = S.proyectos.filter((x) => x.id !== p.id); cerrarModal(); rerender();
    };
  });
  v.querySelector('#b-new').onclick = () => abrir();
  v.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => abrir(S.proyectos.find((p) => p.id === b.dataset.edit)));
}
