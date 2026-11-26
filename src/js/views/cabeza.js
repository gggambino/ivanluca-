import { sb, S } from '../data.js';
import { esc, fechaHora, difDias, hoy, MESES } from '../util.js';
import { toast, errorMsg, vacio, modal, cerrarModal, areaOpts } from '../ui.js';

let tab = 'abierto';

export function html() {
  const ab = S.cabeza.filter((c) => c.estado === 'abierto');
  const ce = S.cabeza.filter((c) => c.estado !== 'abierto');
  const noImp = ce.filter((c) => c.estado === 'no_importaba').length;
  const lista = tab === 'abierto' ? ab : ce;
  // agrupar por mes
  const grupos = {};
  for (const c of lista) { const k = c.creado.slice(0, 7); (grupos[k] ||= []).push(c); }
  return `
  <header class="top"><div><p class="muted up">Todo lo que tengo en la cabeza</p><h1>Cabeza</h1></div></header>
  <section class="card">
    <form id="f-dump" class="dump"><textarea name="texto" rows="2" placeholder="¿Qué te está dando vueltas? Escribilo y soltalo." required></textarea><button class="btn primary">Soltar</button></form>
    <p class="muted sm">En vez de pensarlo, escribilo. Queda con fecha y hora, y lo resolvés cuando toque.</p>
  </section>
  <div class="stats3">
    <div class="card stat"><b>${ab.length}</b><span>abiertas</span></div>
    <div class="card stat"><b>${ce.length - noImp}</b><span>resueltas</span></div>
    <div class="card stat"><b>${ce.length ? Math.round((noImp / ce.length) * 100) : 0}%</b><span>no importaban</span></div>
  </div>
  <div class="tabs"><button data-tab="abierto" class="${tab === 'abierto' ? 'on' : ''}">En la cabeza (${ab.length})</button><button data-tab="cerrado" class="${tab !== 'abierto' ? 'on' : ''}">Historial (${ce.length})</button></div>
  ${Object.entries(grupos).map(([k, xs]) => `<section class="card"><h3 class="muted up">${MESES[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}</h3>
    <ul class="cab">${xs.map(item).join('')}</ul></section>`).join('') || `<section class="card">${vacio(tab === 'abierto' ? 'Cabeza despejada. Nada abierto.' : 'Todavía no cerraste nada.')}</section>`}`;
}

function item(c) {
  const dias = difDias(c.creado.slice(0, 10), (c.cerrado || new Date().toISOString()).slice(0, 10));
  return `<li class="${c.estado}"><p>${esc(c.texto)}</p>
    <div class="row sp sm muted"><span>${esc(fechaHora(c.creado))}</span>
    <span>${c.estado === 'abierto' ? (dias ? `hace ${dias} ${dias === 1 ? 'día' : 'días'}` : 'hoy') : `${c.estado === 'resuelto' ? '✓ Resuelto' : '○ Ya no importaba'} · ${dias} ${dias === 1 ? 'día' : 'días'} en la cabeza`}</span></div>
    ${c.nota ? `<p class="nota">${esc(c.nota)}</p>` : ''}
    <div class="row g acts">${c.estado === 'abierto'
      ? `<button class="btn sm ok" data-cerrar="resuelto" data-id="${c.id}">Resuelto</button><button class="btn sm" data-cerrar="no_importaba" data-id="${c.id}">Ya no importa</button><button class="btn sm ghost" data-proy="${c.id}">→ Proyecto</button>`
      : `<button class="btn sm ghost" data-reabrir="${c.id}">Reabrir</button>`}</div></li>`;
}

export function mount(v, rerender) {
  v.querySelector('#f-dump').onsubmit = async (e) => {
    e.preventDefault(); const texto = e.target.texto.value.trim(); if (!texto) return;
    const r = await sb.from('cabeza').insert({ texto }).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.cabeza.unshift(r.data); toast('Afuera. +5 XP Bienestar'); tab = 'abierto'; rerender();
  };
  v.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; rerender(); });
  v.querySelectorAll('[data-cerrar]').forEach((b) => b.onclick = () => {
    const estado = b.dataset.cerrar; const id = b.dataset.id;
    modal(estado === 'resuelto' ? '¿Cómo lo resolviste?' : 'Ya no importa', `<form id="f-c" class="stack">
      <textarea name="nota" rows="3" placeholder="Opcional: una línea para acordarte después."></textarea>
      <button class="btn primary">Cerrar</button></form>`, (m) => {
      m.querySelector('#f-c').onsubmit = async (e) => {
        e.preventDefault();
        const patch = { estado, cerrado: new Date().toISOString(), nota: e.target.nota.value.trim() || null };
        const r = await sb.from('cabeza').update(patch).eq('id', id);
        if (r.error) return toast(errorMsg(r.error), true);
        Object.assign(S.cabeza.find((x) => x.id === id), patch); cerrarModal(); toast('Cerrado. +10 XP Bienestar'); rerender();
      };
    });
  });
  v.querySelectorAll('[data-reabrir]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.reabrir; const patch = { estado: 'abierto', cerrado: null };
    const r = await sb.from('cabeza').update(patch).eq('id', id);
    if (r.error) return toast(errorMsg(r.error), true);
    Object.assign(S.cabeza.find((x) => x.id === id), patch); rerender();
  });
  v.querySelectorAll('[data-proy]').forEach((b) => b.onclick = () => {
    const c = S.cabeza.find((x) => x.id === b.dataset.proy);
    modal('Convertir en proyecto', `<form id="f-p" class="stack">
      <label>Nombre<input name="nombre" value="${esc(c.texto.slice(0, 80))}" required></label>
      <label>Área<select name="area">${areaOpts('proyectos')}</select></label>
      <label>Próximo paso<input name="proximo_paso" placeholder="La acción más chica que lo mueve"></label>
      <button class="btn primary">Crear y sacarlo de la cabeza</button></form>`, (m) => {
      m.querySelector('#f-p').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target;
        const p = await sb.from('proyectos').insert({ nombre: f.nombre.value, area: f.area.value, proximo_paso: f.proximo_paso.value || null, estado: 'en_curso', notas: 'Salió de la Cabeza: ' + c.texto }).select().single();
        if (p.error) return toast(errorMsg(p.error), true);
        const patch = { estado: 'resuelto', cerrado: new Date().toISOString(), nota: 'Pasó a proyecto' };
        await sb.from('cabeza').update(patch).eq('id', c.id);
        Object.assign(c, patch); S.proyectos.push(p.data); cerrarModal(); toast('Ahora es un proyecto'); rerender();
      };
    });
  });
  void hoy;
}
