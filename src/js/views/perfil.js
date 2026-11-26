import { sb, S } from '../data.js';
import { AREAS } from '../config.js';
import { esc, money, hm, DIAS, DIAS_C, fecha } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal, areaChip, areaOpts, formData } from '../ui.js';
import { nuevoRecordatorio } from './hoy.js';

let diaSel = new Date().getDay();
let sec = 'jugador';
const SECS = [['jugador', 'Jugador'], ['agenda', 'Agenda'], ['recordatorios', 'Recordatorios'], ['habitos', 'Hábitos'], ['fijos', 'Gastos fijos'], ['ajustes', 'Ajustes']];

export function html() {
  return `<header class="top"><div><p class="muted up">Tu personaje y la configuración del juego</p><h1>Perfil</h1></div></header>
  <div class="tabs">${SECS.map(([k, l]) => `<button data-sec="${k}" class="${sec === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  ${({ jugador, agenda, recordatorios, habitos, fijos, ajustes })[sec]()}`;
}

function jugador() {
  const ev = L.eventosXP(); const tot = L.xpTotal(ev); const g = L.nivelGeneral(tot); const xa = L.xpPorArea(ev);
  const ult = [...ev].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 12);
  const debil = Object.entries(xa).sort((a, b) => a[1] - b[1])[0];
  return `<section class="card hero"><div class="lv big"><b>${g.n}</b><span>nivel</span></div>
    <div class="grow"><h2>${esc(S.perfil?.nombre || 'Ivan')}</h2><p class="muted">${tot} XP · racha ${L.racha()} días · ${L.diasGanados().length} días ganados</p>${bar(g.pct)}
    <p class="sm muted">Te faltan ${(g.hasta - g.xp) * 3} XP para el nivel ${g.n + 1}.</p></div></section>
  <div class="areas big">${Object.entries(xa).map(([k, xp]) => { const p = L.progreso(xp); const A = AREAS[k];
    return `<div class="card area" style="--c:${A.c}"><div class="row sp"><span>${A.ic} ${esc(A.l)}</span><b>Nv ${p.n}</b></div>${bar(p.pct, A.c)}<small class="muted">${xp} XP · ${p.hasta - xp} para subir</small></div>`; }).join('')}</div>
  ${debil ? `<p class="aviso">Tu área más floja es <b>${esc(AREAS[debil[0]].l)}</b>. Esta semana sumale una misión.</p>` : ''}
  <div class="grid2">
    <section class="card"><h2>Últimos XP</h2><ul class="list">${ult.map((e) => `<li><span class="muted sm">${fecha(e.fecha)}</span><span class="t">${esc(e.txt)}</span><b style="color:${AREAS[e.area]?.c}">+${e.xp}</b></li>`).join('') || vacio('Todavía no sumaste XP. Arrancá por Hoy.')}</ul></section>
    <section class="card"><h2>Reglas del juego</h2><ul class="list">${L.XP_REGLAS.map(([a, b]) => `<li><span class="t">${esc(a)}</span><span class="muted sm">${esc(b)}</span></li>`).join('')}</ul>
    <p class="muted sm">Cada nivel cuesta más que el anterior: 100, 300, 600, 1000 XP… El nivel general usa la XP de todas las áreas juntas.</p></section>
  </div>
  <section class="card"><h2>Objetivos</h2><textarea id="t-obj" rows="4">${esc(S.perfil?.objetivos || '')}</textarea></section>`;
}

function agenda() {
  const bl = S.rutina.filter((r) => r.dia === diaSel);
  const horas = (d) => S.rutina.filter((r) => r.dia === d).reduce((o, r) => { const m = (t) => { const [h, mi] = hm(t).split(':').map(Number); return h * 60 + mi; }; o[r.area] = (o[r.area] || 0) + (m(r.hasta) - m(r.desde)) / 60; return o; }, {});
  const sem = {}; for (let d = 0; d < 7; d++) for (const [a, h] of Object.entries(horas(d))) sem[a] = (sem[a] || 0) + h;
  return `<section class="card"><h2>Semana tipo</h2><p class="muted sm">Es la estructura que ves en Hoy y en el mail de las 7 AM.</p>
    <div class="seg dias">${DIAS_C.map((c, i) => `<button data-dia="${i}" class="${i === diaSel ? 'on' : ''}" aria-label="${DIAS[i]}">${c}</button>`).join('')}</div>
    <h3>${DIAS[diaSel]}</h3>
    <ul class="list">${bl.map((b) => `<li><span class="h">${hm(b.desde)}–${hm(b.hasta)}</span><span class="t">${esc(b.titulo)}</span>${areaChip(b.area)}<button class="btn sm ghost" data-delb="${b.id}" aria-label="Borrar">✕</button></li>`).join('') || vacio('Sin bloques.')}</ul>
    <form id="f-b" class="row g wrap"><input name="desde" type="time" required><input name="hasta" type="time" required><input name="titulo" placeholder="Qué hago" required class="grow"><select name="area">${areaOpts('negocios')}</select><button class="btn">Agregar</button></form>
  </section>
  <section class="card"><h2>Horas por semana</h2>${Object.entries(sem).sort((a, b) => b[1] - a[1]).map(([a, h]) => `<div class="cat"><div class="row sp sm"><span>${esc(AREAS[a]?.l || a)}</span><b>${h.toFixed(1)} h</b></div>${bar((h / 50) * 100, AREAS[a]?.c)}</div>`).join('')}
  <p class="muted sm">Si querés más horas CEO, tienen que estar acá. Lo que no está en la agenda, no pasa.</p></section>`;
}

function recordatorios() {
  const xs = S.recordatorios.map((r) => ({ ...r, prox: L.proximaFecha(r) })).sort((a, b) => (a.prox < b.prox ? -1 : 1));
  const rep = { no: '', semanal: 'cada semana', mensual: 'cada mes', anual: 'cada año' };
  return `<section class="card"><div class="row sp"><h2>Recordatorios y cumpleaños</h2><button class="btn sm primary" id="b-rec">+ Nuevo</button></div>
    <ul class="list">${xs.map((r) => `<li class="${r.hecho ? 'muted' : ''}"><span class="ic">${r.tipo === 'cumple' ? '🎂' : r.tipo === 'vencimiento' ? '⏰' : '•'}</span><span class="t">${esc(r.titulo)}</span><span class="muted sm">${fecha(r.prox)} ${rep[r.repetir]}${r.hecho ? ' · hecho' : ''}</span><button class="btn sm ghost" data-delr="${r.id}" aria-label="Borrar">✕</button></li>`).join('') || vacio('Sin recordatorios. Sumá los cumpleaños de tu gente.')}</ul></section>`;
}

function habitos() {
  return `<section class="card"><h2>Hábitos (tus misiones diarias)</h2><p class="muted sm">Empezá con pocos. Mejor 6 que cumplís que 15 que te frustran.</p>
    <ul class="list">${S.habitos.map((h) => `<li class="${h.activo ? '' : 'muted'}"><span class="t">${esc(h.nombre)}</span>${areaChip(h.area)}<span class="sm">+${h.xp}</span><span class="sm muted">${(h.dias || []).length === 7 ? 'todos los días' : (h.dias || []).map((d) => DIAS_C[d]).join(' ')}</span>
      <button class="btn sm ghost" data-toggleh="${h.id}">${h.activo ? 'Pausar' : 'Activar'}</button></li>`).join('')}</ul>
    <form id="f-h" class="stack"><h3>Nuevo hábito</h3><input name="nombre" placeholder="Ej: leer 10 páginas" required>
      <div class="row g wrap"><select name="area">${areaOpts('bienestar')}</select><select name="xp"><option value="5">+5 XP</option><option value="10" selected>+10 XP</option><option value="15">+15 XP</option><option value="20">+20 XP</option></select></div>
      <div class="chips">${DIAS_C.map((c, i) => `<label class="pick"><input type="checkbox" name="dias" value="${i}" checked><span>${c}</span></label>`).join('')}</div>
      <button class="btn">Agregar</button></form></section>`;
}

function fijos() {
  return `<section class="card"><h2>Gastos fijos del mes</h2><p class="muted sm">Poné el día de vencimiento y te aviso en Hoy y en el mail.</p>
    <ul class="list">${S.fijos.map((f) => `<li class="${f.activo ? '' : 'muted'}"><span class="t">${esc(f.concepto)}</span>
      <input class="mini" type="number" value="${f.monto}" data-fm="${f.id}" aria-label="Monto">
      <input class="mini" type="number" min="1" max="31" placeholder="día" value="${f.dia_vto ?? ''}" data-fd="${f.id}" aria-label="Día de vencimiento">
      <button class="btn sm ghost" data-togglef="${f.id}">${f.activo ? 'Dar de baja' : 'Activar'}</button></li>`).join('')}</ul>
    <p><b>Total: ${money(S.fijos.filter((f) => f.activo).reduce((s, f) => s + Number(f.monto), 0))}</b> por mes</p>
    <form id="f-f" class="row g wrap"><input name="concepto" placeholder="Concepto" required class="grow"><input name="monto" type="number" placeholder="Monto" required><input name="dia_vto" type="number" min="1" max="31" placeholder="Día vto"><button class="btn">Agregar</button></form></section>`;
}

function ajustes() {
  const P = S.perfil || {};
  return `<section class="card"><h2>Ajustes</h2><form id="f-aj" class="stack">
    <label>Nombre<input name="nombre" value="${esc(P.nombre || '')}"></label>
    <div class="row g"><label>Peso inicial<input name="peso_inicial" type="number" step="0.1" value="${P.peso_inicial ?? ''}"></label><label>Peso objetivo<input name="peso_objetivo" type="number" step="0.1" value="${P.peso_objetivo ?? ''}"></label></div>
    <label class="row g"><input type="checkbox" name="mail_diario" ${P.mail_diario ? 'checked' : ''}> Mandarme el resumen del día a las 7 AM</label>
    <label>Mail para el resumen<input name="mail_destino" type="email" value="${esc(P.mail_destino || S.user.email)}"></label>
    <button class="btn primary">Guardar</button></form></section>
  <section class="card"><p class="muted sm">Sesión: ${esc(S.user.email)}</p><button class="btn ghost" id="b-out">Cerrar sesión</button></section>`;
}

async function run(q, okMsg) { const r = await q; if (r.error) { toast(errorMsg(r.error), true); return null; } if (okMsg) toast(okMsg); return r; }

export function mount(v, rerender) {
  v.querySelectorAll('[data-sec]').forEach((b) => b.onclick = () => { sec = b.dataset.sec; rerender(); });
  const $ = (s) => v.querySelector(s);
  if (sec === 'jugador') $('#t-obj').onchange = async (e) => { if (await run(sb.from('perfil').update({ objetivos: e.target.value }).eq('user_id', S.user.id), 'Objetivos guardados')) S.perfil.objetivos = e.target.value; };
  if (sec === 'agenda') {
    v.querySelectorAll('[data-dia]').forEach((b) => b.onclick = () => { diaSel = Number(b.dataset.dia); rerender(); });
    v.querySelectorAll('[data-delb]').forEach((b) => b.onclick = async () => { if (await run(sb.from('rutina').delete().eq('id', b.dataset.delb))) { S.rutina = S.rutina.filter((x) => x.id !== b.dataset.delb); rerender(); } });
    $('#f-b').onsubmit = async (e) => { e.preventDefault(); const r = await run(sb.from('rutina').insert({ ...formData(e.target), dia: diaSel }).select().single());
      if (r) { S.rutina.push(r.data); S.rutina.sort((a, b) => a.dia - b.dia || (a.desde < b.desde ? -1 : 1)); rerender(); } };
  }
  if (sec === 'recordatorios') {
    $('#b-rec').onclick = () => nuevoRecordatorio(rerender);
    v.querySelectorAll('[data-delr]').forEach((b) => b.onclick = async () => { if (await run(sb.from('recordatorios').delete().eq('id', b.dataset.delr))) { S.recordatorios = S.recordatorios.filter((x) => x.id !== b.dataset.delr); rerender(); } });
  }
  if (sec === 'habitos') {
    v.querySelectorAll('[data-toggleh]').forEach((b) => b.onclick = async () => { const h = S.habitos.find((x) => x.id === b.dataset.toggleh);
      if (await run(sb.from('habitos').update({ activo: !h.activo }).eq('id', h.id))) { h.activo = !h.activo; rerender(); } });
    $('#f-h').onsubmit = async (e) => { e.preventDefault(); const f = e.target; const dias = [...f.querySelectorAll('[name=dias]:checked')].map((x) => Number(x.value));
      const r = await run(sb.from('habitos').insert({ nombre: f.nombre.value, area: f.area.value, xp: Number(f.xp.value), dias, orden: S.habitos.length }).select().single());
      if (r) { S.habitos.push(r.data); rerender(); } };
  }
  if (sec === 'fijos') {
    v.querySelectorAll('[data-fm]').forEach((i) => i.onchange = async () => { const f = S.fijos.find((x) => x.id === i.dataset.fm); if (await run(sb.from('gastos_fijos').update({ monto: Number(i.value) }).eq('id', f.id), 'Guardado')) { f.monto = Number(i.value); } });
    v.querySelectorAll('[data-fd]').forEach((i) => i.onchange = async () => { const f = S.fijos.find((x) => x.id === i.dataset.fd); const d = i.value ? Number(i.value) : null; if (await run(sb.from('gastos_fijos').update({ dia_vto: d }).eq('id', f.id), 'Guardado')) { f.dia_vto = d; } });
    v.querySelectorAll('[data-togglef]').forEach((b) => b.onclick = async () => { const f = S.fijos.find((x) => x.id === b.dataset.togglef); if (await run(sb.from('gastos_fijos').update({ activo: !f.activo }).eq('id', f.id))) { f.activo = !f.activo; rerender(); } });
    $('#f-f').onsubmit = async (e) => { e.preventDefault(); const d = formData(e.target);
      const r = await run(sb.from('gastos_fijos').insert({ concepto: d.concepto, monto: Number(d.monto), dia_vto: d.dia_vto ? Number(d.dia_vto) : null, orden: S.fijos.length }).select().single());
      if (r) { S.fijos.push(r.data); rerender(); } };
  }
  if (sec === 'ajustes') {
    $('#f-aj').onsubmit = async (e) => { e.preventDefault(); const f = e.target;
      const row = { nombre: f.nombre.value, peso_inicial: f.peso_inicial.value ? Number(f.peso_inicial.value) : null, peso_objetivo: f.peso_objetivo.value ? Number(f.peso_objetivo.value) : null, mail_diario: f.mail_diario.checked, mail_destino: f.mail_destino.value || null };
      if (await run(sb.from('perfil').update(row).eq('user_id', S.user.id), 'Ajustes guardados')) { Object.assign(S.perfil, row); rerender(); } };
    $('#b-out').onclick = () => sb.auth.signOut();
  }
  void cerrarModal; void modal;
}
