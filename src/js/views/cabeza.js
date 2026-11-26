import { sb, S } from '../data.js';
import { esc, fechaHora, difDias, hoy, MESES } from '../util.js';
import { toast, errorMsg, vacio, modal, cerrarModal, areaOpts } from '../ui.js';
import * as C from './cal.js';

const st = C.estado('Lista');
const CH = { cargado: false, cargando: false, msgs: [], enviando: false, error: '' };
async function cargarChat(rerender) {
  if (CH.cargado || CH.cargando) return; CH.cargando = true;
  const r = await sb.from('cabeza_chat').select('*').order('creado', { ascending: false }).limit(40);
  CH.msgs = r.error ? [] : r.data.reverse(); CH.cargado = true; CH.cargando = false; rerender();
}
const ERRORES = {
  falta_clave: 'Falta conectar la IA: cargá tu clave de Anthropic en Supabase (te dejé los pasos en el chat del proyecto).',
  clave_invalida: 'La clave de Anthropic no es válida. Revisala en Supabase > Edge Functions > Secrets.',
  limite: 'Llegaste al límite de uso de la IA por ahora. Probá en un rato.',
};
function burbuja(m) {
  if (m.rol === 'user') return `<div class="msg yo"><p>${esc(m.texto).replace(/\n/g, '<br>')}</p></div>`;
  return `<div class="msg ia">${m.texto.split('\n').map((l) => { const t = l.trim();
    if (/^[•\-]\s+/.test(t)) { const paso = t.replace(/^[•\-]\s+/, ''); return `<p class="paso"><span>• ${esc(paso)}</span><button class="btn sm" data-ahoy="${esc(paso)}">+ Hoy</button></p>`; }
    return t ? `<p>${esc(t)}</p>` : ''; }).join('')}</div>`;
}
function chatHtml() {
  return `<section class="card chat">
    <div class="row sp"><h2>Charlalo conmigo</h2>${CH.msgs.length ? '<button class="btn sm ghost" id="b-chat-del">Borrar charla</button>' : ''}</div>
    <p class="muted sm">Contame lo que te da vueltas, como si me escribieras por WhatsApp. Te respondo con la verdad y pasos concretos. Lo que te sugiero lo podés pasar a tus tareas de hoy.</p>
    <div class="msgs" id="msgs">${CH.cargando && !CH.cargado ? '<p class="muted sm">Cargando...</p>' : CH.msgs.map(burbuja).join('') || '<p class="muted sm">Todavía no charlamos. Arrancá por lo que más te pesa hoy.</p>'}
      ${CH.enviando ? '<div class="msg ia"><p class="muted">Pensando...</p></div>' : ''}</div>
    ${CH.error ? `<p class="aviso">${esc(CH.error)}</p>` : ''}
    <form id="f-chat" class="chat-in"><textarea name="t" rows="2" placeholder="Ej: tengo mil cosas del gym, la deuda con Franco y no llego con nada..." required ${CH.enviando ? 'disabled' : ''}></textarea><button class="btn primary" ${CH.enviando ? 'disabled' : ''}>Enviar</button></form>
  </section>`;
}
const creadas = (f) => S.cabeza.filter((c) => c.creado.slice(0, 10) === f);
const cerradas = (f) => S.cabeza.filter((c) => c.cerrado && c.cerrado.slice(0, 10) === f);

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
  ${chatHtml()}
  <div class="stats3">
    <div class="card stat"><b>${ab.length}</b><span>abiertas</span></div>
    <div class="card stat"><b>${ce.length - noImp}</b><span>resueltas</span></div>
    <div class="card stat"><b>${ce.length ? Math.round((noImp / ce.length) * 100) : 0}%</b><span>no importaban</span></div>
  </div>
  ${C.tabs(st)}
  ${st.vista !== 'lista' ? calHtml() : `<div class="tabs"><button data-tab="abierto" class="${tab === 'abierto' ? 'on' : ''}">En la cabeza (${ab.length})</button><button data-tab="cerrado" class="${tab !== 'abierto' ? 'on' : ''}">Historial (${ce.length})</button></div>
  ${Object.entries(grupos).map(([k, xs]) => `<section class="card"><h3 class="muted up">${MESES[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}</h3>
    <ul class="cab">${xs.map(item).join('')}</ul></section>`).join('') || `<section class="card">${vacio(tab === 'abierto' ? 'Cabeza despejada. Nada abierto.' : 'Todavía no cerraste nada.')}</section>`}`}`;
}

function calHtml() {
  const f = st.sel;
  if (st.vista === 'dia') return `${C.nav(st)}
    <div class="grid2"><section class="card"><h2>Anotado este día (${creadas(f).length})</h2><ul class="cab">${creadas(f).map(item).join('') || vacio('Nada anotado este día.')}</ul></section>
    <section class="card"><h2>Cerrado este día (${cerradas(f).length})</h2><ul class="cab">${cerradas(f).map(item).join('') || vacio('Nada cerrado este día.')}</ul></section></div>`;
  if (st.vista === 'semana') return `${C.nav(st)}${C.semana(st, (d) => { const a = creadas(d); const c = cerradas(d);
    return `<div class="sm">${a.length ? `☁ ${a.length} anotadas` : '<span class="muted">Nada anotado</span>'}${c.length ? ` · <span class="green">✓ ${c.length} cerradas</span>` : ''}</div>
    <ul class="mini">${a.slice(0, 4).map((x) => `<li class="${x.estado}">${esc(x.texto.slice(0, 70))}</li>`).join('')}</ul>${a.length > 4 ? `<span class="muted sm">y ${a.length - 4} más</span>` : ''}`; })}`;
  return `${C.nav(st)}${C.mes(st, (d) => { const a = creadas(d).length; const c = cerradas(d).length;
    return `${a ? `<span class="cal-e">☁ ${a}</span>` : ''}${c ? `<span class="cal-e ok">✓ ${c}</span>` : ''}`; })}
    <p class="muted sm">☁ cosas que anotaste ese día · ✓ cosas que cerraste. Tocá un día para verlas y resolverlas.</p>`;
}

function item(c) {
  const dias = difDias(c.creado.slice(0, 10), (c.cerrado || new Date().toISOString()).slice(0, 10));
  return `<li class="${c.estado}"><p>${esc(c.texto)}</p>
    <div class="row sp sm muted"><span>${esc(fechaHora(c.creado))}</span>
    <span>${c.estado === 'abierto' ? (dias ? `hace ${dias} ${dias === 1 ? 'día' : 'días'}` : 'hoy') : `${c.estado === 'resuelto' ? '✓ Resuelto' : '○ Ya no importaba'} · ${dias} ${dias === 1 ? 'día' : 'días'} en la cabeza`}</span></div>
    ${c.nota ? `<p class="nota">${esc(c.nota)}</p>` : ''}
    <div class="row g acts">${c.estado === 'abierto'
      ? `<button class="btn sm ok" data-cerrar="resuelto" data-id="${c.id}">Resuelto</button><button class="btn sm" data-cerrar="no_importaba" data-id="${c.id}">Ya no importa</button><button class="btn sm ghost" data-proy="${c.id}">→ Proyecto</button><button class="btn sm ghost" data-charla="${c.id}">💬 Charlarlo</button>`
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
  C.mount(v, st, rerender);
  cargarChat(rerender);
  const box = v.querySelector('#msgs'); if (box) box.scrollTop = box.scrollHeight;
  const enviar = async (texto) => {
    CH.enviando = true; CH.error = ''; CH.msgs.push({ rol: 'user', texto }); rerender();
    const { data, error } = await sb.functions.invoke('cabeza-chat', { body: { texto, hoy: hoy() } });
    CH.enviando = false;
    if (error) {
      let code = ''; try { code = (await error.context.json()).error; } catch { /* sin cuerpo */ }
      CH.error = ERRORES[code] || 'No pude responder ahora. Probá de nuevo en un rato.';
      return rerender();
    }
    CH.msgs.push(data.assistant); rerender();
  };
  const fc = v.querySelector('#f-chat'); if (fc) {
    fc.onsubmit = (e) => { e.preventDefault(); const t = fc.t.value.trim(); if (t && !CH.enviando) enviar(t); };
    fc.t.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) fc.requestSubmit(); };
  }
  v.querySelectorAll('[data-charla]').forEach((b) => b.onclick = () => {
    const c = S.cabeza.find((x) => x.id === b.dataset.charla); const t = v.querySelector('#f-chat textarea');
    t.value = `Tengo esto en la cabeza desde el ${c.creado.slice(0, 10)}: "${c.texto}". ¿Cómo lo encaro?`; t.focus(); t.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  v.querySelectorAll('[data-ahoy]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    const r = await sb.from('tareas').insert({ fecha: hoy(), titulo: b.dataset.ahoy.slice(0, 200), area: 'bienestar' }).select().single();
    if (r.error) { b.disabled = false; return toast(errorMsg(r.error), true); }
    S.tareas.push(r.data); b.textContent = '✓ En Hoy'; toast('Sumado a tus tareas de hoy');
  });
  const del = v.querySelector('#b-chat-del'); if (del) del.onclick = async () => {
    if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Borrar todo? Tocá de nuevo'; return; }
    const r = await sb.from('cabeza_chat').delete().eq('user_id', S.user.id);
    if (r.error) return toast(errorMsg(r.error), true);
    CH.msgs = []; rerender();
  };
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
