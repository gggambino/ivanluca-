import { sb, S } from '../data.js';
import { esc, hoy, fecha, addDias } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal } from '../ui.js';

export function html() {
  const P = S.perfil || {};
  const pesos = S.salud.filter((s) => s.peso).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const actual = pesos.at(-1)?.peso ?? P.peso_inicial;
  const ini = Number(P.peso_inicial) || Number(pesos[0]?.peso) || actual;
  const obj = Number(P.peso_objetivo) || 80;
  const pct = ini > obj ? ((ini - actual) / (ini - obj)) * 100 : 0;
  const hoyReg = S.salud.find((s) => s.fecha === hoy()) || {};
  const ult = pesos.slice(-30);
  const min = Math.min(obj, ...ult.map((x) => Number(x.peso))) - 1; const max = Math.max(ini, ...ult.map((x) => Number(x.peso))) + 1;
  const W = 600, H = 160;
  const pts = ult.map((x, i) => `${ult.length === 1 ? W / 2 : (i / (ult.length - 1)) * W},${H - ((x.peso - min) / (max - min)) * H}`).join(' ');
  const yObj = H - ((obj - min) / (max - min)) * H;
  return `
  <header class="top"><div><p class="muted up">Entreno, dieta y cuerpo</p><h1>Salud</h1></div></header>
  ${caloriasHtml()}
  <div class="grid2">
    <section class="card">
      <h2>Peso</h2>
      <div class="row sp"><b class="huge">${actual ?? '—'} kg</b><span class="muted">meta ${obj} kg · faltan ${actual ? Math.max(0, (actual - obj)).toFixed(1) : '—'} kg</span></div>
      ${bar(pct, 'var(--green)')}
      ${ult.length > 1 ? `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Evolución del peso"><line x1="0" x2="${W}" y1="${yObj}" y2="${yObj}" class="obj"/><polyline points="${pts}"/></svg>` : '<p class="muted sm">Registrá tu peso unos días y acá vas a ver la curva.</p>'}
    </section>
    <section class="card">
      <h2>Registro de hoy</h2>
      <form id="f-s" class="stack">
        <label>Peso (kg)<input name="peso" type="number" step="0.1" inputmode="decimal" value="${hoyReg.peso ?? ''}"></label>
        <label>Entreno de hoy<input name="entreno" value="${esc(hoyReg.entreno || '')}" placeholder="Ej: básicos barra + 30 min cardio"></label>
        <label>Notas<input name="notas" value="${esc(hoyReg.notas || '')}" placeholder="Cómo me sentí, qué comí de más..."></label>
        <button class="btn primary">Guardar</button>
      </form>
    </section>
  </div>
  <div class="grid2">
    <section class="card"><h2>Plan de entreno</h2><textarea id="t-ent" rows="6">${esc(P.plan_entreno || '')}</textarea></section>
    <section class="card"><h2>Plan de dieta y suplementos</h2><textarea id="t-die" rows="6">${esc(P.plan_dieta || '')}</textarea>
    <p class="muted sm">Ojo: el Lipo 6 Black es un quemador con estimulantes. Con doble turno y poco sueño, vale la pena revisarlo con un médico.</p></section>
  </div>
  <section class="card"><h2>Historial</h2>
    <ul class="list">${S.salud.slice(0, 20).map((s) => `<li><span class="muted sm">${fecha(s.fecha)}</span><span class="t">${s.peso ? s.peso + ' kg' : ''}${L.kcalDel(s.fecha) ? ' · ' + L.kcalDel(s.fecha) + ' kcal' : ''}${s.entreno ? ' · ' + esc(s.entreno) : ''}</span><span class="muted sm">${esc(s.notas || '')}</span></li>`).join('') || vacio('Sin registros.')}</ul>
  </section>`;
}

function caloriasHtml() {
  const P = S.perfil || {}; const meta = Number(P.meta_calorias) || 0; const metaP = Number(P.meta_proteina) || 0;
  const k = L.kcalDel(); const pr = L.protDel(); const items = L.comidasDel();
  const resto = meta - k; const pct = meta ? (k / meta) * 100 : 0;
  const color = !meta ? 'var(--accent)' : pct > 110 ? 'var(--red)' : pct >= 90 ? 'var(--green)' : 'var(--accent)';
  // comidas frecuentes para cargar con un toque
  const freq = {}; for (const c of S.comidas) { const key = c.descripcion.trim().toLowerCase(); (freq[key] ||= { n: 0, c }).n++; freq[key].c = c; }
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 8).map((x) => x.c);
  const semana = Array.from({ length: 7 }, (_, i) => addDias(hoy(), i - 6)).map((f) => ({ f, k: L.kcalDel(f) }));
  const maxK = Math.max(meta, ...semana.map((x) => x.k), 1);
  return `<section class="card">
    <div class="row sp"><h2>Calorías de hoy</h2><button class="btn sm ghost" id="b-meta">Meta: ${meta || '—'} kcal · ${metaP || '—'} g prot</button></div>
    <div class="kcal"><b>${k}</b><span class="muted">/ ${meta || '—'} kcal</span><span class="sm ${resto < 0 ? 'red' : 'muted'}">${meta ? (resto >= 0 ? `te quedan ${resto}` : `te pasaste ${-resto}`) : ''}</span>
      <span class="sm muted">· proteína ${pr} / ${metaP || '—'} g</span></div>
    ${bar(pct, color)}
    <form id="f-food" class="food-add">
      <input name="descripcion" placeholder="Qué comiste (ej: 3 huevos + pan)" required>
      <input name="calorias" type="number" inputmode="numeric" min="0" placeholder="kcal" required>
      <input name="proteina" type="number" inputmode="numeric" min="0" placeholder="prot g">
      <button class="btn primary">Sumar</button>
    </form>
    ${top.length ? `<p class="muted sm">Repetir con un toque:</p><div class="chips">${top.map((c) => `<button class="pick-btn btn sm" data-rep="${c.id}">${esc(c.descripcion)} · ${c.calorias}</button>`).join('')}</div>` : ''}
    <ul class="list">${items.map((c) => `<li><span class="t">${esc(c.descripcion)}</span><span class="sm">${c.calorias} kcal${c.proteina ? ' · ' + c.proteina + ' g' : ''}</span><button class="btn sm ghost" data-delc="${c.id}" aria-label="Borrar">✕</button></li>`).join('') || vacio('Todavía no cargaste nada hoy.')}</ul>
    <h3 class="muted up">Últimos 7 días</h3>
    <div class="semana">${semana.map((x) => `<div class="dia-k" title="${x.k} kcal"><span style="height:${Math.round((x.k / maxK) * 100)}%;background:${meta && x.k >= meta * 0.9 && x.k <= meta * 1.1 ? 'var(--green)' : x.k > meta * 1.1 && meta ? 'var(--red)' : 'var(--accent)'}"></span><small>${fecha(x.f).split(' ')[0]}</small></div>`).join('')}</div>
    <p class="muted sm">Si cerrás el día dentro de ±10% de tu meta, sumás +10 XP en Salud. La meta inicial (2.300 kcal y 170 g de proteína) es una estimación para bajar de 86 a 80 kg con tu nivel de actividad. Ajustala con tu nutricionista.</p>
  </section>`;
}

export function mount(v, rerender) {
  v.querySelector('#f-food').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const row = { fecha: hoy(), descripcion: f.descripcion.value.trim(), calorias: Number(f.calorias.value) || 0, proteina: f.proteina.value ? Number(f.proteina.value) : null };
    const r = await sb.from('comidas').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.comidas.push(r.data); toast(`+${row.calorias} kcal`); rerender();
  };
  v.querySelectorAll('[data-rep]').forEach((b) => b.onclick = async () => {
    const c = S.comidas.find((x) => x.id === b.dataset.rep);
    const r = await sb.from('comidas').insert({ fecha: hoy(), descripcion: c.descripcion, calorias: c.calorias, proteina: c.proteina }).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.comidas.push(r.data); toast(`+${c.calorias} kcal`); rerender();
  });
  v.querySelectorAll('[data-delc]').forEach((b) => b.onclick = async () => {
    const r = await sb.from('comidas').delete().eq('id', b.dataset.delc);
    if (r.error) return toast(errorMsg(r.error), true);
    S.comidas = S.comidas.filter((x) => x.id !== b.dataset.delc); rerender();
  });
  v.querySelector('#b-meta').onclick = () => modal('Tu meta diaria', `<form id="f-mc" class="stack">
      <div class="row g"><label>Calorías<input name="k" type="number" inputmode="numeric" value="${S.perfil.meta_calorias ?? ''}"></label>
      <label>Proteína (g)<input name="p" type="number" inputmode="numeric" value="${S.perfil.meta_proteina ?? ''}"></label></div>
      <button class="btn primary">Guardar</button></form>`, (m) => {
    m.querySelector('#f-mc').onsubmit = async (e) => {
      e.preventDefault();
      const row = { meta_calorias: e.target.k.value ? Number(e.target.k.value) : null, meta_proteina: e.target.p.value ? Number(e.target.p.value) : null };
      const r = await sb.from('perfil').update(row).eq('user_id', S.user.id);
      if (r.error) return toast(errorMsg(r.error), true);
      Object.assign(S.perfil, row); cerrarModal(); rerender();
    };
  });
  v.querySelector('#f-s').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const num = (x) => (x.value === '' ? null : Number(x.value));
    const row = { fecha: hoy(), peso: num(f.peso), entreno: f.entreno.value || null, notas: f.notas.value || null };
    const r = await sb.from('salud_log').upsert(row, { onConflict: 'user_id,fecha' }).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.salud = [r.data, ...S.salud.filter((s) => s.fecha !== row.fecha)];
    toast('Guardado'); rerender();
  };
  const guardarPlan = (campo, el) => el.addEventListener('change', async () => {
    const r = await sb.from('perfil').update({ [campo]: el.value }).eq('user_id', S.user.id);
    if (r.error) return toast(errorMsg(r.error), true);
    S.perfil[campo] = el.value; toast('Plan guardado');
  });
  guardarPlan('plan_entreno', v.querySelector('#t-ent'));
  guardarPlan('plan_dieta', v.querySelector('#t-die'));
}
