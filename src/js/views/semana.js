import { S } from '../data.js';
import { esc, hoy, addDias, fecha, DIAS, parse } from '../util.js';
import * as L from '../logic.js';
import { planHtml, mountPlan } from './plan.js';
import { tabsHoy } from './hoy.js';

let desde = L.inicioSemana();
export function irA(f) { desde = L.inicioSemana(f); location.hash = '#/semana'; }

export function html() {
  const dias = Array.from({ length: 7 }, (_, i) => addDias(desde, i));
  const ts = S.tareas.filter((t) => !t.es_bloque && t.fecha >= desde && t.fecha <= dias[6]);
  const hechas = ts.filter((t) => t.hecho).length;
  return `
  <header class="top"><div><p class="muted up">Armá tus días</p><h1>Semana</h1></div>
    <div class="mes"><button class="btn sm ghost" data-sem="-1" aria-label="Semana anterior">‹</button><b>${fecha(desde)} – ${fecha(dias[6])}</b><button class="btn sm ghost" data-sem="1" aria-label="Semana siguiente">›</button></div></header>
  ${tabsHoy('semana')}
  <p class="muted sm">${ts.length ? `${hechas} de ${ts.length} tareas hechas esta semana. ` : ''}Cada día arranca con tu semana tipo como base. Tocá ✎ en cualquier bloque para cambiarlo, moverlo de día o borrarlo: ese día pasa a ser 100% tuyo y la plantilla no se toca. Sumá tareas (se tildan) o bloques (agenda) con o sin hora.</p>
  <div class="semana-grid">${dias.map((f) => `<section class="card dia ${f === hoy() ? 'hoy' : ''} ${f < hoy() ? 'pasado' : ''}">
      <div class="row sp"><h2>${DIAS[parse(f).getDay()]} <small class="muted">${fecha(f)}</small></h2>${f === hoy() ? '<span class="chip" style="--c:var(--accent)">hoy</span>' : ''}</div>
      ${planHtml(f, { compacto: true })}</section>`).join('')}</div>`;
}

export function mount(v, rerender) {
  v.querySelectorAll('[data-sem]').forEach((b) => b.onclick = () => { desde = addDias(desde, 7 * Number(b.dataset.sem)); rerender(); });
  mountPlan(v, rerender);
  void esc;
}
