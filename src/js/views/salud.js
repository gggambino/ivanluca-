import { sb, S } from '../data.js';
import { esc, hoy, fecha } from '../util.js';
import { toast, errorMsg, vacio, bar } from '../ui.js';

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
        <div class="row g"><label>Peso (kg)<input name="peso" type="number" step="0.1" inputmode="decimal" value="${hoyReg.peso ?? ''}"></label>
        <label>Calorías<input name="calorias" type="number" inputmode="numeric" value="${hoyReg.calorias ?? ''}"></label>
        <label>Proteína (g)<input name="proteina" type="number" inputmode="numeric" value="${hoyReg.proteina ?? ''}"></label></div>
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
    <ul class="list">${S.salud.slice(0, 20).map((s) => `<li><span class="muted sm">${fecha(s.fecha)}</span><span class="t">${s.peso ? s.peso + ' kg' : ''}${s.calorias ? ' · ' + s.calorias + ' kcal' : ''}${s.proteina ? ' · ' + s.proteina + ' g prot' : ''}${s.entreno ? ' · ' + esc(s.entreno) : ''}</span><span class="muted sm">${esc(s.notas || '')}</span></li>`).join('') || vacio('Sin registros.')}</ul>
  </section>`;
}

export function mount(v, rerender) {
  v.querySelector('#f-s').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const num = (x) => (x.value === '' ? null : Number(x.value));
    const row = { fecha: hoy(), peso: num(f.peso), calorias: num(f.calorias), proteina: num(f.proteina), entreno: f.entreno.value || null, notas: f.notas.value || null };
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
