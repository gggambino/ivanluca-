import { sb, S } from '../data.js';
import { esc, hoy, fecha, fechaLarga, addDias, parse, DIAS, DIAS_C } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal } from '../ui.js';
import * as E from './entrenos.js';

let tab = 'dia';
let sel = hoy();

const meta = () => Number(S.perfil?.meta_calorias) || 0;
const metaP = () => Number(S.perfil?.meta_proteina) || 0;
const regDel = (f) => S.salud.find((s) => s.fecha === f) || {};
const colorK = (k) => { const m = meta(); if (!m || !k) return 'var(--ink-3)'; return k > m * 1.1 ? 'var(--red)' : k >= m * 0.9 ? 'var(--green)' : 'var(--accent)'; };

export function html() {
  const tabs = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['rutinas', 'Rutinas']];
  return `
  <header class="top"><div><p class="muted up">Entreno, comidas y cuerpo</p><h1>Salud</h1></div>${pesoMini()}</header>
  <nav class="tabs">${tabs.map(([k, l]) => `<a href="javascript:void 0" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
  ${tab === 'dia' ? diaHtml() : tab === 'semana' ? semanaHtml() : tab === 'mes' ? mesHtml() : rutinasHtml()}`;
}

function pesoMini() {
  const P = S.perfil || {}; const pesos = S.salud.filter((s) => s.peso).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const actual = pesos.at(-1)?.peso ?? P.peso_inicial; const obj = Number(P.peso_objetivo) || 80;
  return `<div class="player sm-player"><div class="pl-info"><div class="row sp"><span>Peso</span><b>${actual ?? '—'} kg</b></div><div class="row sp sm"><span class="muted">meta ${obj} kg</span><span class="muted">faltan ${actual ? Math.max(0, actual - obj).toFixed(1) : '—'} kg</span></div></div></div>`;
}

function navFecha(txt, paso) {
  return `<div class="mes"><button class="btn sm ghost" data-nav="-${paso}" aria-label="Anterior">‹</button><b>${txt}</b><button class="btn sm ghost" data-nav="${paso}" aria-label="Siguiente">›</button>${sel !== hoy() ? '<button class="btn sm" data-hoy="1">Hoy</button>' : ''}</div>`;
}

// ---------- Día: registro completo y editable ----------
function diaHtml() {
  const f = sel; const p = E.planDel(f); const e = p && E.porId(p.entreno_id); const r = regDel(f);
  const k = L.kcalDel(f); const pr = L.protDel(f); const items = L.comidasDel(f); const m = meta(); const resto = m - k;
  const freq = {}; for (const c of S.comidas) { const key = c.descripcion.trim().toLowerCase(); (freq[key] ||= { n: 0, c }).n++; freq[key].c = c; }
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 8).map((x) => x.c);
  return `${navFecha(fechaLarga(f) + (f === hoy() ? ' · hoy' : ''), 1)}
  <div class="grid2">
    <section class="card">
      <div class="row sp"><h2>Entreno</h2>${p ? `<button class="btn sm ${p.hecho ? 'ok' : 'primary'}" data-hecho="${f}">${p.hecho ? '✓ Hecho' : 'Marcar hecho'}</button>` : ''}</div>
      <div class="row g"><select id="s-ent" aria-label="Rutina del día"><option value="">— Descanso / sin entreno —</option>${E.activos().map((x) => `<option value="${x.id}" ${x.id === p?.entreno_id ? 'selected' : ''}>${esc(x.titulo)}</option>`).join('')}</select>
      <button class="btn sm" id="b-newr">+ Nueva</button></div>
      ${e ? `<div class="row sp ent-h"><span>${chipFoco(e)}</span><span class="row g0"><button class="btn sm" data-wpp="${f}">Copiar WhatsApp</button><button class="btn sm ghost" data-er="${e.id}" aria-label="Editar rutina">✎</button></span></div>
        ${E.bloquesHtml(e)}
        <label class="sm">Notas del entreno de este día<input id="i-entn" value="${esc(p.notas || '')}" placeholder="Ej: subí a 80 kg en sentadilla"></label>` : `<p class="muted sm">Elegí una rutina para este día o dejalo como descanso.</p>`}
    </section>
    <section class="card">
      <h2>Registro</h2>
      <form id="f-s" class="stack">
        <label>Peso (kg)<input name="peso" type="number" step="0.1" inputmode="decimal" value="${r.peso ?? ''}"></label>
        <label>Notas del día<textarea name="notas" rows="3" placeholder="Cómo me sentí, sueño, energía...">${esc(r.notas || '')}</textarea></label>
        <button class="btn primary">Guardar</button>
      </form>
    </section>
  </div>
  <section class="card">
    <div class="row sp"><h2>Comidas</h2><button class="btn sm ghost" id="b-meta">Meta: ${m || '—'} kcal · ${metaP() || '—'} g prot</button></div>
    <div class="kcal"><b>${k}</b><span class="muted">/ ${m || '—'} kcal</span><span class="sm ${resto < 0 ? 'red' : 'muted'}">${m ? (resto >= 0 ? `quedan ${resto}` : `te pasaste ${-resto}`) : ''}</span><span class="sm muted">· proteína ${pr} / ${metaP() || '—'} g</span></div>
    ${bar(m ? (k / m) * 100 : 0, colorK(k))}
    <ul class="list">${items.map((c) => `<li><span class="t">${esc(c.descripcion)}</span><span class="sm">${c.calorias} kcal${c.proteina ? ' · ' + c.proteina + ' g' : ''}</span><button class="btn sm ghost" data-edc="${c.id}" aria-label="Editar">✎</button><button class="btn sm ghost" data-delc="${c.id}" aria-label="Borrar">✕</button></li>`).join('') || vacio('Sin comidas cargadas este día.')}</ul>
    <form id="f-food" class="food-add">
      <input name="descripcion" placeholder="Qué comiste (ej: 3 huevos + pan)" required>
      <input name="calorias" type="number" inputmode="numeric" min="0" placeholder="kcal" required>
      <input name="proteina" type="number" inputmode="numeric" min="0" placeholder="prot g">
      <button class="btn primary">Sumar</button>
    </form>
    ${top.length ? `<p class="muted sm">Repetir con un toque:</p><div class="chips">${top.map((c) => `<button class="pick-btn btn sm" data-rep="${c.id}">${esc(c.descripcion)} · ${c.calorias}</button>`).join('')}</div>` : ''}
    <p class="muted sm">Cerrar el día dentro de ±10% de tu meta suma +10 XP en Salud. La meta inicial (2.300 kcal, 170 g) es una estimación: ajustala con tu nutricionista.</p>
  </section>`;
}

const chipFoco = (e) => `<span class="chip" style="--c:var(--red)">${esc(E.FOCOS[e.foco] || e.foco)}${e.enfasis ? ' · ' + esc(e.enfasis) : ''}</span>`;

// ---------- Semana ----------
function semanaHtml() {
  const lunes = L.inicioSemana(sel); const dias = Array.from({ length: 7 }, (_, i) => addDias(lunes, i));
  const hechos = dias.filter((f) => E.planDel(f)?.hecho).length; const plan = dias.filter((f) => E.planDel(f)).length;
  return `${navFecha(`${fecha(lunes)} – ${fecha(dias[6])}`, 7)}
  <div class="row sp"><p class="muted sm">${plan ? `${hechos} de ${plan} entrenos hechos.` : 'Sin entrenos asignados esta semana.'} Tocá un día para ver y editar su registro.</p><button class="btn sm" id="b-llenar">Llenar con mi agenda</button></div>
  <div class="sal-sem">${dias.map((f) => { const p = E.planDel(f); const e = p && E.porId(p.entreno_id); const k = L.kcalDel(f); const r = regDel(f);
    return `<section class="card sd ${f === hoy() ? 'hoy' : ''}">
      <button class="sd-h" data-ir="${f}"><b>${DIAS[parse(f).getDay()]}</b> <span class="muted">${fecha(f)}</span></button>
      <div class="sd-ent">${e ? `<span class="${p.hecho ? 'green' : ''}">${p.hecho ? '✓' : '○'} ${esc(e.titulo)}</span>` : '<span class="muted">Descanso</span>'}</div>
      <select data-asig="${f}" aria-label="Rutina del ${fecha(f)}"><option value="">— Descanso —</option>${E.activos().map((x) => `<option value="${x.id}" ${x.id === p?.entreno_id ? 'selected' : ''}>${esc(x.titulo)}</option>`).join('')}</select>
      <div class="row sp sm"><span>${k ? k + ' kcal' : '<span class="muted">sin comidas</span>'}</span>${r.peso ? `<span>${r.peso} kg</span>` : ''}</div>
      ${meta() ? bar(Math.min(100, (k / meta()) * 100), colorK(k)) : ''}
      <div class="row g0">${e ? `<button class="btn sm" data-wpp="${f}">WhatsApp</button>` : ''}<button class="btn sm ghost" data-ir="${f}">Abrir día →</button></div>
    </section>`; }).join('')}</div>`;
}

// ---------- Mes ----------
function mesHtml() {
  const ini = L.inicioMes(sel); const d0 = parse(ini); const dias = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const blancos = (d0.getDay() + 6) % 7; const fs = Array.from({ length: dias }, (_, i) => addDias(ini, i));
  const hechos = fs.filter((f) => E.planDel(f)?.hecho).length; const enMeta = fs.filter((f) => L.diasEnCalorias().includes(f)).length;
  const pesos = S.salud.filter((s) => s.peso).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return `${navFecha(E.mesTxt(ini), 'm')}
  <p class="muted sm">${hechos} entrenos hechos · ${enMeta} días dentro de la meta de calorías. Tocá un día para editarlo.</p>
  <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span class="cal-h">${x}</span>`).join('')}${'<span></span>'.repeat(blancos)}
    ${fs.map((f) => { const p = E.planDel(f); const e = p && E.porId(p.entreno_id); const k = L.kcalDel(f);
      return `<button class="cal-d ${f === hoy() ? 'hoy' : ''} ${f > hoy() ? 'fut' : ''}" data-ir="${f}" aria-label="${fechaLarga(f)}">
        <b>${parse(f).getDate()}</b>${e ? `<span class="cal-e ${p.hecho ? 'ok' : ''}" title="${esc(e.titulo)}">${p.hecho ? '✓' : '○'} <i>${esc(e.titulo)}</i></span>` : ''}
        ${k ? `<span class="cal-k" style="color:${colorK(k)}">${k}</span>` : ''}</button>`; }).join('')}</div>
  <p class="muted sm">✓ entreno hecho · ○ planificado · número = kcal del día (verde dentro de la meta, naranja abajo, rojo arriba).</p>
  ${pesoCard(pesos)}`;
}

function pesoCard(pesos) {
  const P = S.perfil || {}; const ult = pesos.slice(-30); if (ult.length < 2) return '<section class="card"><h2>Peso</h2><p class="muted sm">Registrá tu peso unos días y acá vas a ver la curva.</p></section>';
  const obj = Number(P.peso_objetivo) || 80; const ini = Number(P.peso_inicial) || Number(ult[0].peso);
  const min = Math.min(obj, ...ult.map((x) => Number(x.peso))) - 1; const max = Math.max(ini, ...ult.map((x) => Number(x.peso))) + 1;
  const W = 600, H = 160; const pts = ult.map((x, i) => `${(i / (ult.length - 1)) * W},${H - ((x.peso - min) / (max - min)) * H}`).join(' ');
  const yObj = H - ((obj - min) / (max - min)) * H;
  return `<section class="card"><h2>Peso</h2><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Evolución del peso"><line x1="0" x2="${W}" y1="${yObj}" y2="${yObj}" class="obj"/><polyline points="${pts}"/></svg></section>`;
}

// ---------- Rutinas ----------
function rutinasHtml() {
  const P = S.perfil || {}; const xs = E.activos();
  const usos = (id) => S.entPlan.filter((p) => p.entreno_id === id && p.hecho).length;
  return `<div class="row sp"><p class="muted sm">Tu biblioteca. Armá cada rutina por bloques (entrada en calor, fuerza, circuito...) y copiala lista para WhatsApp.</p><button class="btn primary" id="b-newr">+ Nueva rutina</button></div>
  <div class="rutinas">${xs.map((e) => `<section class="card">
    <div class="row sp"><h2>${esc(e.titulo)}</h2>${chipFoco(e)}</div>
    ${E.bloquesHtml(e)}
    <div class="row sp"><span class="muted sm">${usos(e.id) ? `Hecha ${usos(e.id)} ${usos(e.id) === 1 ? 'vez' : 'veces'}` : 'Todavía no la hiciste'}</span>
    <span class="row g0"><button class="btn sm" data-wppr="${e.id}">Copiar WhatsApp</button><button class="btn sm ghost" data-er="${e.id}" aria-label="Editar">✎</button><button class="btn sm ghost" data-dup="${e.id}">Duplicar</button><button class="btn sm ghost red" data-bor="${e.id}" aria-label="Borrar">✕</button></span></div>
  </section>`).join('') || vacio('Sin rutinas. Creá la primera.')}</div>
  <div class="grid2">
    <section class="card"><h2>Plan de entreno</h2><textarea id="t-ent" rows="6">${esc(P.plan_entreno || '')}</textarea></section>
    <section class="card"><h2>Plan de dieta y suplementos</h2><textarea id="t-die" rows="6">${esc(P.plan_dieta || '')}</textarea>
    <p class="muted sm">Ojo: el Lipo 6 Black es un quemador con estimulantes. Con doble turno y poco sueño, vale la pena revisarlo con un médico.</p></section>
  </div>`;
}

// ---------- Eventos ----------
export function mount(v, rerender) {
  const on = (sel_, fn) => v.querySelectorAll(sel_).forEach((b) => b.onclick = (ev) => fn(b, ev));
  on('[data-tab]', (b) => { tab = b.dataset.tab; rerender(); });
  on('[data-nav]', (b) => { const n = b.dataset.nav;
    if (n.endsWith('m')) { const d = parse(sel); d.setDate(1); d.setMonth(d.getMonth() + (n.startsWith('-') ? -1 : 1)); sel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
    else sel = addDias(sel, Number(n)); rerender(); });
  on('[data-hoy]', () => { sel = hoy(); rerender(); });
  on('[data-ir]', (b) => { sel = b.dataset.ir; tab = 'dia'; rerender(); window.scrollTo(0, 0); });
  on('[data-wpp]', (b) => { const p = E.planDel(b.dataset.wpp); E.copiar(E.textoWpp(E.porId(p.entreno_id), b.dataset.wpp)); });
  on('[data-wppr]', (b) => E.copiar(E.textoWpp(E.porId(b.dataset.wppr))));
  on('[data-er]', (b) => E.editarRutina(E.porId(b.dataset.er), rerender));
  on('#b-newr', () => E.editarRutina(null, rerender, async (nueva) => { if (tab === 'dia' && await E.asignar(sel, nueva.id)) rerender(); }));
  on('[data-hecho]', async (b) => { await E.toggleHecho(b.dataset.hecho); rerender(); });
  on('[data-dup]', async (b) => { const e = E.porId(b.dataset.dup);
    const r = await sb.from('entrenos').insert({ titulo: e.titulo + ' (copia)', foco: e.foco, enfasis: e.enfasis, notas: e.notas, bloques: e.bloques }).select().single();
    if (r.error) return toast(errorMsg(r.error), true); S.entrenos.push(r.data); E.editarRutina(r.data, rerender); });
  on('[data-bor]', (b) => { const e = E.porId(b.dataset.bor);
    modal('Borrar rutina', `<p>¿Borrar <b>${esc(e.titulo)}</b>? Los días donde ya la hiciste quedan en tu historial.</p><div class="row sp"><button class="btn ghost" data-close="1">Cancelar</button><button class="btn red-bg" id="b-ok">Borrar</button></div>`, (m) => {
      m.querySelector('#b-ok').onclick = async () => { const r = await sb.from('entrenos').update({ activo: false }).eq('id', e.id);
        if (r.error) return toast(errorMsg(r.error), true); e.activo = false; cerrarModal(); rerender(); }; }); });
  const s = v.querySelector('#s-ent'); if (s) s.onchange = async () => { if (await E.asignar(sel, s.value || null)) rerender(); };
  v.querySelectorAll('[data-asig]').forEach((x) => x.onchange = async () => { if (await E.asignar(x.dataset.asig, x.value || null)) rerender(); });
  on('#b-llenar', async () => { const n = await E.llenarSemana(L.inicioSemana(sel)); toast(n ? `Asigné ${n} entrenos según tu agenda` : 'No encontré días para completar'); rerender(); });
  const ni = v.querySelector('#i-entn'); if (ni) ni.onchange = async () => { const p = E.planDel(sel);
    const r = await sb.from('entreno_plan').update({ notas: ni.value || null }).eq('id', p.id); if (r.error) return toast(errorMsg(r.error), true); p.notas = ni.value || null; toast('Nota guardada'); };

  // comidas del día seleccionado
  const ff = v.querySelector('#f-food'); if (ff) ff.onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const row = { fecha: sel, descripcion: f.descripcion.value.trim(), calorias: Number(f.calorias.value) || 0, proteina: f.proteina.value ? Number(f.proteina.value) : null };
    const r = await sb.from('comidas').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.comidas.push(r.data); toast(`+${row.calorias} kcal`); rerender();
  };
  on('[data-rep]', async (b) => { const c = S.comidas.find((x) => x.id === b.dataset.rep);
    const r = await sb.from('comidas').insert({ fecha: sel, descripcion: c.descripcion, calorias: c.calorias, proteina: c.proteina }).select().single();
    if (r.error) return toast(errorMsg(r.error), true); S.comidas.push(r.data); toast(`+${c.calorias} kcal`); rerender(); });
  on('[data-delc]', async (b) => { const r = await sb.from('comidas').delete().eq('id', b.dataset.delc);
    if (r.error) return toast(errorMsg(r.error), true); S.comidas = S.comidas.filter((x) => x.id !== b.dataset.delc); rerender(); });
  on('[data-edc]', (b) => { const c = S.comidas.find((x) => x.id === b.dataset.edc);
    modal('Editar comida', `<form id="f-ec" class="stack"><label>Qué<input name="d" value="${esc(c.descripcion)}" required></label>
      <div class="row g"><label>kcal<input name="k" type="number" inputmode="numeric" min="0" value="${c.calorias}" required></label><label>Proteína (g)<input name="p" type="number" inputmode="numeric" min="0" value="${c.proteina ?? ''}"></label></div>
      <label>Día<input name="f" type="date" value="${c.fecha}" required></label><button class="btn primary">Guardar</button></form>`, (m) => {
      m.querySelector('#f-ec').onsubmit = async (ev) => { ev.preventDefault(); const f = ev.target;
        const row = { descripcion: f.d.value.trim(), calorias: Number(f.k.value) || 0, proteina: f.p.value ? Number(f.p.value) : null, fecha: f.f.value };
        const r = await sb.from('comidas').update(row).eq('id', c.id); if (r.error) return toast(errorMsg(r.error), true);
        Object.assign(c, row); cerrarModal(); rerender(); }; }); });
  on('#b-meta', () => modal('Tu meta diaria', `<form id="f-mc" class="stack">
      <div class="row g"><label>Calorías<input name="k" type="number" inputmode="numeric" value="${S.perfil.meta_calorias ?? ''}"></label>
      <label>Proteína (g)<input name="p" type="number" inputmode="numeric" value="${S.perfil.meta_proteina ?? ''}"></label></div>
      <button class="btn primary">Guardar</button></form>`, (m) => {
    m.querySelector('#f-mc').onsubmit = async (e) => { e.preventDefault();
      const row = { meta_calorias: e.target.k.value ? Number(e.target.k.value) : null, meta_proteina: e.target.p.value ? Number(e.target.p.value) : null };
      const r = await sb.from('perfil').update(row).eq('user_id', S.user.id); if (r.error) return toast(errorMsg(r.error), true);
      Object.assign(S.perfil, row); cerrarModal(); rerender(); }; }));
  const fs = v.querySelector('#f-s'); if (fs) fs.onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const prev = regDel(sel);
    const row = { fecha: sel, peso: f.peso.value === '' ? null : Number(f.peso.value), entreno: prev.entreno || null, notas: f.notas.value || null };
    const r = await sb.from('salud_log').upsert(row, { onConflict: 'user_id,fecha' }).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.salud = [r.data, ...S.salud.filter((s) => s.fecha !== row.fecha)].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)); toast('Guardado'); rerender();
  };
  const guardarPlan = (campo, el) => el && el.addEventListener('change', async () => {
    const r = await sb.from('perfil').update({ [campo]: el.value }).eq('user_id', S.user.id);
    if (r.error) return toast(errorMsg(r.error), true); S.perfil[campo] = el.value; toast('Plan guardado'); });
  guardarPlan('plan_entreno', v.querySelector('#t-ent'));
  guardarPlan('plan_dieta', v.querySelector('#t-die'));
  void DIAS_C;
}
