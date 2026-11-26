// Rutinas de entreno: biblioteca editable por bloques, calendario por día y texto listo para WhatsApp
import { sb, S } from '../data.js';
import { esc, hoy, parse, DIAS, MESES } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, modal, cerrarModal } from '../ui.js';

export const FOCOS = { fuerza: 'Fuerza', cardio: 'Cardio', circuito: 'Circuito', boxeo: 'Boxeo', running: 'Running', movilidad: 'Movilidad' };
export const ENFASIS = ['', 'pierna', 'torso', 'core', 'full body', 'empuje', 'tracción'];
export const FORMATOS = ['Series x reps', 'Circuito', 'EMOM', 'AMRAP', 'Tabata', 'Por tiempo', 'Libre'];

export const activos = () => S.entrenos.filter((e) => e.activo !== false);
export const porId = (id) => S.entrenos.find((e) => e.id === id);
export const planDel = (f) => S.entPlan.find((p) => p.fecha === f);

// Rutinas iniciales armadas a partir de tu agenda. Son un punto de partida: se editan todas.
const SEED = [
  { titulo: 'Básicos barra', foco: 'fuerza', enfasis: 'full body', bloques: [
    { nombre: 'Entrada en calor', formato: 'Circuito', detalle: '2 vueltas', ejercicios: ['Movilidad de cadera y hombros', '10 sentadillas sin peso', '10 flexiones'] },
    { nombre: 'Fuerza', formato: 'Series x reps', detalle: '4 x 6-8', ejercicios: ['Sentadilla con barra', 'Press banca', 'Peso muerto', 'Remo con barra'] },
    { nombre: 'Cardio', formato: 'Por tiempo', detalle: '30 min', ejercicios: ['Cinta o bici a ritmo moderado'] }] },
  { titulo: 'Full body máquinas', foco: 'fuerza', enfasis: 'full body', bloques: [
    { nombre: 'Fuerza', formato: 'Series x reps', detalle: '3 x 10-12', ejercicios: ['Prensa', 'Pecho en máquina', 'Jalón al pecho', 'Camilla de femorales', 'Hombros en máquina'] },
    { nombre: 'Cardio', formato: 'Por tiempo', detalle: '30 min', ejercicios: ['Escaladora o bici'] }] },
  { titulo: 'Full body mancuernas / smith', foco: 'fuerza', enfasis: 'full body', bloques: [
    { nombre: 'Fuerza', formato: 'Series x reps', detalle: '3 x 10', ejercicios: ['Sentadilla en smith', 'Press inclinado con mancuernas', 'Remo con mancuerna', 'Estocadas', 'Press militar'] },
    { nombre: 'Cardio', formato: 'Por tiempo', detalle: '30 min', ejercicios: ['Cinta inclinada'] }] },
  { titulo: 'Circuito + boxeo', foco: 'circuito', enfasis: 'full body', bloques: [
    { nombre: 'Circuito', formato: 'AMRAP', detalle: '20 min', ejercicios: ['10 burpees', '15 kettlebell swings', '20 mountain climbers', '10 sentadillas con salto'] },
    { nombre: 'Boxeo', formato: 'Por tiempo', detalle: '6 rounds de 3 min', ejercicios: ['Bolsa: combinaciones 1-2, 1-2-3, uppercuts'] }] },
  { titulo: 'Running', foco: 'running', enfasis: '', bloques: [
    { nombre: 'Carrera', formato: 'Por tiempo', detalle: '40-60 min', ejercicios: ['Ritmo cómodo, podés hablar'] }] },
];

export async function sembrarEntrenos() {
  if (S.entrenos.length) return;
  try { if (localStorage.getItem('il-ent-seed')) return; } catch { /* sin storage */ }
  const r = await sb.from('entrenos').insert(SEED).select();
  if (r.error) return;
  S.entrenos = r.data;
  try { localStorage.setItem('il-ent-seed', '1'); } catch { /* sin storage */ }
}

// Texto para pegar en WhatsApp (negritas con *, cursiva con _)
export function textoWpp(e, f) {
  if (!e) return '';
  const d = f ? parse(f) : null;
  const L1 = d ? `*ENTRENO · ${DIAS[d.getDay()].toUpperCase()} ${d.getDate()}/${d.getMonth() + 1}*` : '*ENTRENO*';
  const sub = [FOCOS[e.foco] || e.foco, e.enfasis].filter(Boolean).join(' · ');
  const out = [L1, `*${e.titulo}*${sub ? ' — ' + sub : ''}`, ''];
  (e.bloques || []).forEach((b, i) => {
    const extra = [b.formato && b.formato !== 'Libre' ? b.formato : '', b.detalle].filter(Boolean).join(' · ');
    out.push(`*${i + 1}. ${b.nombre || 'Bloque'}*${extra ? ' (' + extra + ')' : ''}`);
    (b.ejercicios || []).filter(Boolean).forEach((x) => out.push(`• ${x}`));
    out.push('');
  });
  if (e.notas) out.push(`_${e.notas}_`);
  return out.join('\n').trim();
}

export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Copiado. Pegalo en WhatsApp'); return; } catch { /* sigue */ }
  modal('Copiá el texto', `<textarea rows="14" readonly>${esc(txt)}</textarea><p class="muted sm">Mantené apretado para seleccionar todo y copiar.</p>`, (m) => { const t = m.querySelector('textarea'); t.focus(); t.select(); });
}

export function bloquesHtml(e) {
  return `<div class="bloques-ent">${(e.bloques || []).map((b, i) => `<div class="b-ent"><div class="row sp"><b>${i + 1}. ${esc(b.nombre || 'Bloque')}</b><span class="muted sm">${esc([b.formato !== 'Libre' ? b.formato : '', b.detalle].filter(Boolean).join(' · '))}</span></div>
    <ul>${(b.ejercicios || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') || '<p class="muted sm">Sin bloques. Editala para sumar ejercicios.</p>'}
    ${e.notas ? `<p class="muted sm"><i>${esc(e.notas)}</i></p>` : ''}</div>`;
}

// ---------- Editor ----------
export function editarRutina(e, rerender, onSaved) {
  const nueva = !e;
  const w = nueva ? { titulo: '', foco: 'fuerza', enfasis: '', notas: '', bloques: [{ nombre: 'Entrada en calor', formato: 'Circuito', detalle: '', ejercicios: [] }] } : JSON.parse(JSON.stringify(e));
  const bloqueForm = (b, i) => `<fieldset class="b-edit" data-i="${i}">
    <div class="row sp"><b>Bloque ${i + 1}</b><span class="row g0"><button type="button" class="btn sm ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button type="button" class="btn sm ghost red" data-qb="${i}" aria-label="Quitar bloque">✕</button></span></div>
    <div class="row g"><label>Nombre<input name="bn" value="${esc(b.nombre || '')}" placeholder="Ej: Fuerza"></label>
    <label>Formato<select name="bf">${FORMATOS.map((x) => `<option ${x === b.formato ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label>Series / tiempo<input name="bd" value="${esc(b.detalle || '')}" placeholder="4 x 8 · 12 min"></label></div>
    <label>Ejercicios (uno por línea)<textarea name="be" rows="4" placeholder="Sentadilla con barra&#10;Press banca">${esc((b.ejercicios || []).join('\n'))}</textarea></label>
  </fieldset>`;
  modal(nueva ? 'Nueva rutina' : 'Editar rutina', `<form id="f-r" class="stack">
    <label>Nombre<input name="titulo" value="${esc(w.titulo)}" required placeholder="Ej: Pierna pesada"></label>
    <div class="row g"><label>Foco<select name="foco">${Object.entries(FOCOS).map(([k, l]) => `<option value="${k}" ${k === w.foco ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Énfasis<select name="enfasis">${ENFASIS.map((x) => `<option value="${x}" ${x === (w.enfasis || '') ? 'selected' : ''}>${x || '—'}</option>`).join('')}</select></label></div>
    <div id="bls"></div>
    <button type="button" class="btn" id="b-addb">+ Bloque</button>
    <label>Notas (salen al final del mensaje)<input name="notas" value="${esc(w.notas || '')}" placeholder="Ej: descanso 90 s entre series"></label>
    <div class="row sp"><button class="btn primary">Guardar</button><button type="button" class="btn ghost" id="b-prev">Ver texto WhatsApp</button></div></form>`, (m) => {
    const f = m.querySelector('#f-r'); const box = m.querySelector('#bls');
    const leer = () => {
      w.titulo = f.titulo.value.trim(); w.foco = f.foco.value; w.enfasis = f.enfasis.value || null; w.notas = f.notas.value.trim() || null;
      w.bloques = [...box.querySelectorAll('.b-edit')].map((x) => ({ nombre: x.querySelector('[name=bn]').value.trim(), formato: x.querySelector('[name=bf]').value,
        detalle: x.querySelector('[name=bd]').value.trim(), ejercicios: x.querySelector('[name=be]').value.split('\n').map((s) => s.trim()).filter(Boolean) }));
    };
    const pintar = () => {
      box.innerHTML = w.bloques.map(bloqueForm).join('');
      box.querySelectorAll('[data-qb]').forEach((b) => b.onclick = () => { leer(); w.bloques.splice(Number(b.dataset.qb), 1); pintar(); });
      box.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { leer(); const i = Number(b.dataset.up); [w.bloques[i - 1], w.bloques[i]] = [w.bloques[i], w.bloques[i - 1]]; pintar(); });
    };
    pintar();
    m.querySelector('#b-addb').onclick = () => { leer(); w.bloques.push({ nombre: '', formato: 'Series x reps', detalle: '', ejercicios: [] }); pintar(); };
    m.querySelector('#b-prev').onclick = () => { leer(); copiar(textoWpp(w)); };
    f.onsubmit = async (ev) => {
      ev.preventDefault(); leer();
      const row = { titulo: w.titulo, foco: w.foco, enfasis: w.enfasis, notas: w.notas, bloques: w.bloques };
      const r = nueva ? await sb.from('entrenos').insert(row).select().single() : await sb.from('entrenos').update(row).eq('id', e.id).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (nueva) S.entrenos.push(r.data); else Object.assign(e, row);
      cerrarModal(); toast('Rutina guardada'); onSaved?.(nueva ? r.data : e); rerender();
    };
  });
}

// ---------- Calendario ----------
export async function asignar(f, entrenoId) {
  const ya = planDel(f);
  if (!entrenoId) {
    if (!ya) return true;
    const r = await sb.from('entreno_plan').delete().eq('id', ya.id);
    if (r.error) { toast(errorMsg(r.error), true); return false; }
    S.entPlan = S.entPlan.filter((p) => p.id !== ya.id); return true;
  }
  const r = ya ? await sb.from('entreno_plan').update({ entreno_id: entrenoId }).eq('id', ya.id).select().single()
    : await sb.from('entreno_plan').insert({ fecha: f, entreno_id: entrenoId }).select().single();
  if (r.error) { toast(errorMsg(r.error), true); return false; }
  if (ya) ya.entreno_id = entrenoId; else S.entPlan.push(r.data);
  return true;
}

// Marcar hecho también tilda el hábito "Entrenar" de ese día (así el XP no se duplica)
export async function toggleHecho(f) {
  const p = planDel(f); if (!p) return;
  const nuevo = !p.hecho;
  const r = await sb.from('entreno_plan').update({ hecho: nuevo }).eq('id', p.id);
  if (r.error) return toast(errorMsg(r.error), true);
  p.hecho = nuevo;
  if (p.hecho && f <= hoy()) {
    const h = S.habitos.find((x) => x.activo !== false && /entren/i.test(x.nombre) && (x.dias || []).includes(parse(f).getDay()));
    if (h && !L.hecho(h.id, f)) {
      const r2 = await sb.from('habito_log').insert({ habito_id: h.id, fecha: f }).select().single();
      if (!r2.error) { S.log.push(r2.data); toast(`💪 Entreno hecho · +${h.xp} XP Salud`); return; }
    }
    toast('💪 Entreno hecho');
  }
}

// Llena los días sin entreno de una semana según los bloques "Entreno: ..." de tu agenda
export async function llenarSemana(lunes) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const f = addD(lunes, i); if (planDel(f)) continue;
    const b = L.bloquesVista(f).find((x) => /entreno|running|boxeo|gym/i.test(x.titulo));
    if (!b) continue;
    const t = norm(b.titulo.replace(/^entreno:\s*/i, ''));
    const e = activos().find((x) => t.includes(norm(x.titulo)) || norm(x.titulo).includes(t.split(/\s[+(]/)[0].trim()));
    if (e && await asignar(f, e.id)) n++;
  }
  return n;
}
const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const mesTxt = (f) => { const d = parse(f); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; };
