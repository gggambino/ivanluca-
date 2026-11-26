// Hoy > Mes: el mes entero de un vistazo (misiones, tareas, entreno y gasto por día)
import { S } from '../data.js';
import { hoy, money, sum } from '../util.js';
import * as L from '../logic.js';
import { tabsHoy } from './hoy.js';
import { irA } from './semana.js';
import * as C from './cal.js';
import { planDel } from './entrenos.js';

const st = Object.assign(C.estado('Mes'), { vista: 'mes' });

export function html() {
  const fs = C.diasMes(st); const pas = fs.filter((f) => f <= hoy());
  const ini0 = (S.perfil?.creado || '').slice(0, 10); const jug = pas.filter((f) => !ini0 || f >= ini0); const ganados = jug.filter((f) => L.pctDia(f) >= 70).length;
  const ts = S.tareas.filter((t) => !t.es_bloque && fs.includes(t.fecha));
  const gasto = sum(S.movs.filter((m) => m.tipo === 'gasto' && m.estado === 'hecho' && fs.includes(m.fecha)), (m) => m.monto);
  return `
  <header class="top"><div><p class="muted up">Tu mes de un vistazo</p><h1>Mes</h1></div>${C.nav(st)}</header>
  ${tabsHoy('mes')}
  <div class="stats4">
    <div class="card stat"><span>Días ganados</span><b>${ganados}</b><small>de ${jug.length} jugados</small></div>
    <div class="card stat"><span>Tareas</span><b>${ts.filter((t) => t.hecho).length}/${ts.length}</b><small>hechas en el mes</small></div>
    <div class="card stat"><span>Entrenos</span><b>${fs.filter((f) => planDel(f)?.hecho).length}</b><small>hechos</small></div>
    <div class="card stat"><span>Gastado</span><b class="red">${money(gasto)}</b><small>día a día</small></div>
  </div>
  ${C.mes(st, (f) => { const ini = (S.perfil?.creado || '').slice(0, 10); const p = f <= hoy() && (!ini || f >= ini) ? L.pctDia(f) : null; const t = L.tareasDel(f); const e = planDel(f);
    const g = sum(S.movs.filter((m) => m.fecha === f && m.tipo === 'gasto' && m.estado === 'hecho'), (m) => m.monto);
    return `${p !== null && L.habitosDelDia(f).length ? `<span class="cal-e ${p >= 70 ? 'ok' : ''}">${p >= 70 ? '🔥' : '·'} ${p}%</span>` : ''}
      ${t.length ? `<span class="cal-k">☐ ${t.filter((x) => x.hecho).length}/${t.length}</span>` : ''}
      ${e ? `<span class="cal-e ${e.hecho ? 'ok' : ''}">${e.hecho ? '✓' : '○'} <i>entreno</i></span>` : ''}
      ${g ? `<span class="cal-k red">${money(g)}</span>` : ''}`; })}
  <p class="muted sm">🔥 día ganado (70% de misiones) · ☐ tareas hechas / total · ✓ entreno hecho · en rojo lo que gastaste. Tocá un día para armarlo en la Semana.</p>`;
}

export function mount(v, rerender) {
  C.mount(v, st, rerender);
  // en esta vista, tocar un día lleva a armar esa semana
  v.querySelectorAll('[data-cir]').forEach((b) => b.onclick = () => irA(b.dataset.cir));
}
