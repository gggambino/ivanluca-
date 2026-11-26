// Vistas de calendario compartidas (Día / Semana / Mes) para sumarlas a cualquier sección sin tocar su vista original
import { esc, hoy, fecha, fechaLarga, addDias, parse, DIAS, MESES } from '../util.js';
import * as L from '../logic.js';

export const estado = (lista = 'Lista') => ({ vista: 'lista', sel: hoy(), lista });

export function tabs(st, vistas = ['dia', 'semana', 'mes']) {
  const nombres = { lista: st.lista, dia: 'Día', semana: 'Semana', mes: 'Mes' };
  return `<nav class="tabs">${['lista', ...vistas].map((k) => `<a href="javascript:void 0" data-vista="${k}" class="${st.vista === k ? 'on' : ''}">${nombres[k]}</a>`).join('')}</nav>`;
}

export const dias7 = (st) => { const l = L.inicioSemana(st.sel); return Array.from({ length: 7 }, (_, i) => addDias(l, i)); };
export const diasMes = (st) => { const ini = L.inicioMes(st.sel); const d0 = parse(ini); const n = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => addDias(ini, i)); };

export function nav(st) {
  let txt; let paso;
  if (st.vista === 'dia') { txt = fechaLarga(st.sel) + (st.sel === hoy() ? ' · hoy' : ''); paso = '1'; }
  else if (st.vista === 'semana') { const d = dias7(st); txt = `${fecha(d[0])} – ${fecha(d[6])}`; paso = '7'; }
  else { const d = parse(st.sel); txt = `${MESES[d.getMonth()]} ${d.getFullYear()}`; paso = 'm'; }
  return `<div class="mes"><button class="btn sm ghost" data-cnav="-${paso}" aria-label="Anterior">‹</button><b>${txt}</b><button class="btn sm ghost" data-cnav="${paso}" aria-label="Siguiente">›</button>${st.sel !== hoy() ? '<button class="btn sm" data-choy="1">Hoy</button>' : ''}</div>`;
}

// Grilla semanal: una tarjeta por día con el contenido que arme cada sección
export function semana(st, card) {
  return `<div class="sal-sem">${dias7(st).map((f) => `<section class="card sd ${f === hoy() ? 'hoy' : ''}">
    <button class="sd-h" data-cir="${f}"><b>${DIAS[parse(f).getDay()]}</b> <span class="muted">${fecha(f)}</span></button>
    ${card(f)}</section>`).join('')}</div>`;
}

// Calendario mensual: cada celda muestra lo que arme cada sección; tocar un día abre la vista Día
export function mes(st, celda) {
  const fs = diasMes(st); const blancos = (parse(fs[0]).getDay() + 6) % 7;
  return `<div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span class="cal-h">${x}</span>`).join('')}${'<span></span>'.repeat(blancos)}
    ${fs.map((f) => `<button class="cal-d ${f === hoy() ? 'hoy' : ''} ${f > hoy() ? 'fut' : ''}" data-cir="${f}" aria-label="${esc(fechaLarga(f))}"><b>${parse(f).getDate()}</b>${celda(f)}</button>`).join('')}</div>`;
}

export function mount(v, st, rerender) {
  v.querySelectorAll('[data-vista]').forEach((b) => b.onclick = () => { st.vista = b.dataset.vista; rerender(); });
  v.querySelectorAll('[data-cnav]').forEach((b) => b.onclick = () => {
    const n = b.dataset.cnav;
    if (n.endsWith('m')) { const d = parse(st.sel); d.setDate(1); d.setMonth(d.getMonth() + (n.startsWith('-') ? -1 : 1)); st.sel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
    else st.sel = addDias(st.sel, Number(n));
    rerender();
  });
  v.querySelectorAll('[data-choy]').forEach((b) => b.onclick = () => { st.sel = hoy(); rerender(); });
  v.querySelectorAll('[data-cir]').forEach((b) => b.onclick = () => { st.sel = b.dataset.cir; st.vista = 'dia'; rerender(); window.scrollTo(0, 0); });
}
