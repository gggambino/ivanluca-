// Componente compartido: el plan de un día = semana tipo + tus tareas de ese día
import { sb, S } from '../data.js';
import { AREAS } from '../config.js';
import { esc, hoy, hm, ahoraHM, addDias } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, areaOpts, modal, cerrarModal } from '../ui.js';

export function planHtml(f, { compacto = false } = {}) {
  const esHoy = f === hoy(); const ahora = ahoraHM();
  const bloques = L.bloquesDel(f).map((b) => ({ k: 'b', h: hm(b.desde), h2: hm(b.hasta), t: b.titulo, area: b.area }));
  const ts = L.tareasDel(f);
  const conHora = ts.filter((t) => t.hora).map((t) => ({ k: 't', h: hm(t.hora), h2: t.hasta ? hm(t.hasta) : '', t: t.titulo, area: t.area, x: t }));
  const sinHora = ts.filter((t) => !t.hora);
  const linea = [...bloques, ...conHora].sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : a.k === 't' ? -1 : 1));
  const item = (t) => `<li class="tarea ${t.hecho ? 'on' : ''}"><button class="tk" data-tk="${t.id}" aria-label="${t.hecho ? 'Desmarcar' : 'Completar'} ${esc(t.titulo)}">${t.hecho ? '✓' : ''}</button>
    <span class="t">${t.hora ? `<b class="h">${hm(t.hora)}${t.hasta ? '–' + hm(t.hasta) : ''}</b> ` : ''}${t.prioridad === 1 ? '<span class="prio">!</span> ' : ''}${esc(t.titulo)}</span>
    <span class="dot" style="background:${AREAS[t.area]?.c}" title="${esc(AREAS[t.area]?.l)}"></span>
    ${!t.hecho ? `<button class="btn sm ghost" data-mañana="${t.id}" title="Pasar al día siguiente">→</button>` : ''}<button class="btn sm ghost" data-edt="${t.id}" aria-label="Editar">✎</button></li>`;
  return `<div class="plan">
    <ol class="timeline">${linea.map((x) => {
      if (x.k === 't') return item(x.x);
      const now = esHoy && x.h <= ahora && ahora < x.h2; const past = esHoy && x.h2 <= ahora;
      return `<li class="${now ? 'now' : ''} ${past ? 'past' : ''} ${compacto ? 'compacto' : ''}" style="--c:${AREAS[x.area]?.c || 'var(--ink-3)'}"><span class="h">${x.h}–${x.h2}</span><span>${esc(x.t)}</span>${now ? '<em>ahora</em>' : ''}</li>`;
    }).join('') || (sinHora.length ? '' : vacio('Día libre. Sumale tareas.'))}</ol>
    ${sinHora.length ? `<h3 class="muted up">Tareas del día</h3><ul class="tareas">${sinHora.map(item).join('')}</ul>` : ''}
    <form class="add-tarea" data-fecha="${f}">
      <input name="titulo" placeholder="${compacto ? "+ Tarea" : "+ Tarea para " + (esHoy ? "hoy" : "este día")}" required>
      <input name="hora" type="time" aria-label="Hora (opcional)">
      <button class="btn sm primary">Sumar</button>
    </form>
  </div>`;
}

export function mountPlan(v, rerender) {
  const byId = (id) => S.tareas.find((t) => t.id === id);
  v.querySelectorAll('.add-tarea').forEach((f) => f.onsubmit = async (e) => {
    e.preventDefault();
    const row = { fecha: f.dataset.fecha, titulo: f.titulo.value.trim(), hora: f.hora.value || null, area: adivinarArea(f.titulo.value) };
    if (!row.titulo) return;
    const r = await sb.from('tareas').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.tareas.push(r.data); rerender();
  });
  v.querySelectorAll('[data-tk]').forEach((b) => b.onclick = async () => {
    const t = byId(b.dataset.tk); const patch = { hecho: !t.hecho, hecho_en: !t.hecho ? new Date().toISOString() : null };
    const r = await sb.from('tareas').update(patch).eq('id', t.id);
    if (r.error) return toast(errorMsg(r.error), true);
    Object.assign(t, patch); if (t.hecho) toast(`+5 XP · ${AREAS[t.area]?.l}`); rerender();
  });
  v.querySelectorAll('[data-mañana]').forEach((b) => b.onclick = async () => {
    const t = byId(b.dataset.mañana); const fecha = t.fecha < hoy() ? hoy() : addDias(t.fecha, 1);
    const r = await sb.from('tareas').update({ fecha }).eq('id', t.id);
    if (r.error) return toast(errorMsg(r.error), true);
    t.fecha = fecha; toast(fecha === hoy() ? 'Pasada a hoy' : 'Pasada al día siguiente'); rerender();
  });
  v.querySelectorAll('[data-edt]').forEach((b) => b.onclick = () => editarTarea(byId(b.dataset.edt), rerender));
}

export function editarTarea(t, rerender) {
  modal('Editar tarea', `<form id="f-t" class="stack">
    <label>Tarea<input name="titulo" value="${esc(t.titulo)}" required></label>
    <div class="row g"><label>Día<input name="fecha" type="date" value="${t.fecha}" required></label>
    <label>Desde<input name="hora" type="time" value="${t.hora ? hm(t.hora) : ''}"></label><label>Hasta<input name="hasta" type="time" value="${t.hasta ? hm(t.hasta) : ''}"></label></div>
    <div class="row g"><label>Área<select name="area">${areaOpts(t.area)}</select></label>
    <label>Prioridad<select name="prioridad"><option value="1" ${t.prioridad === 1 ? 'selected' : ''}>Alta</option><option value="2" ${t.prioridad !== 1 ? 'selected' : ''}>Normal</option></select></label></div>
    <div class="row sp"><button class="btn primary">Guardar</button><button type="button" class="btn ghost red" id="b-del">Borrar</button></div></form>`, (m) => {
    const f = m.querySelector('#f-t');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const row = { titulo: f.titulo.value.trim(), fecha: f.fecha.value, hora: f.hora.value || null, hasta: f.hasta.value || null, area: f.area.value, prioridad: Number(f.prioridad.value) };
      const r = await sb.from('tareas').update(row).eq('id', t.id);
      if (r.error) return toast(errorMsg(r.error), true);
      Object.assign(t, row); cerrarModal(); rerender();
    };
    m.querySelector('#b-del').onclick = async () => {
      const r = await sb.from('tareas').delete().eq('id', t.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.tareas = S.tareas.filter((x) => x.id !== t.id); cerrarModal(); rerender();
    };
  });
}

// Le asigna un área según palabras clave; se puede cambiar editando la tarea
function adivinarArea(txt) {
  const s = txt.toLowerCase();
  const reglas = [
    ['salud', /entren|gym|correr|running|médic|medic|dentist|turno|dieta|comer|boxeo|cardio/],
    ['ingresos', /cobr|pag|factur|banco|afip|monotribut|plata|transfer|alquiler|expensa/],
    ['imagen', /grab|edit|video|reel|post|conten|foto|subir|ropa|pelo|barber/],
    ['relaciones', /cumple|llamar|mamá|mama|papá|papa|amig|novia|familia|cena con|visitar/],
    ['bienestar', /leer|medit|dormir|descans|siesta|limpiar|lavar|ordenar|casa/],
    ['proyectos', /bambinoshop|web|software|merch|catálogo|catalogo|proyecto/],
  ];
  for (const [a, re] of reglas) if (re.test(s)) return a;
  return 'negocios';
}
