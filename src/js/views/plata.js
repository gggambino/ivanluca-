import { sb, S, bb, bbSesion, sincronizarBB } from '../data.js';
import { CAT_GASTO, CAT_INGRESO } from '../config.js';
import { esc, hoy, money, fecha, fechaLarga, MESES, DIAS, parse, addDias, sum } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal } from '../ui.js';
import { revisarAutomaticos } from './objetivos.js';
import * as Deseos from './deseos.js';

let tab = 'dia';
let sel = hoy();

const PALETA = ['#FF6B2C', '#2563EB', '#16A34A', '#C2559F', '#F59E0B', '#0EA5A4', '#7E57C2', '#E5484D', '#0B1F3A', '#8A9AB0', '#A3722B', '#3F7AC8'];
export const catsGasto = () => (S.perfil?.categorias_gasto?.length ? S.perfil.categorias_gasto : CAT_GASTO);
const colorCat = (c) => { if (c === 'Gastos fijos') return '#0B1F3A'; const i = catsGasto().indexOf(c); return PALETA[(i < 0 ? catsGasto().length + (c || '').length : i) % PALETA.length]; };
const mesDe = (f) => f.slice(0, 7);
const mesLabel = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const movsEntre = (a, b) => S.movs.filter((m) => m.fecha >= a && m.fecha <= b);
const gastosDe = (xs) => xs.filter((m) => m.tipo === 'gasto' && m.estado === 'hecho');
const ingresosDe = (xs) => xs.filter((m) => m.tipo === 'ingreso' && m.estado === 'hecho');
const bbEntre = (a, b) => S.ingBB.filter((x) => x.fecha >= a && x.fecha <= b);
const porCat = (xs) => Object.entries(xs.reduce((o, m) => { const k = m.categoria || 'Otros'; o[k] = (o[k] || 0) + Number(m.monto); return o; }, {})).sort((a, b) => b[1] - a[1]);

// Cuentas a pagar entre dos fechas: gastos "a pagar" con fecha en el rango (o vencidos) + fijos que vencen en el rango y no están pagados
function cuentasEntre(a, b) {
  const pend = S.movs.filter((m) => m.tipo === 'gasto' && m.estado === 'pendiente' && m.fecha <= b).map((m) => ({ k: 'm', id: m.id, f: m.fecha, t: m.detalle || m.categoria, monto: Number(m.monto), venc: m.fecha < hoy() }));
  const fijos = [];
  for (let f = a; f <= b; f = addDias(f, 1)) {
    const d = parse(f).getDate(); const mes = mesDe(f);
    S.fijos.filter((x) => x.activo && x.dia_vto === d).forEach((x) => { if (!S.fijosPagos.some((p) => p.fijo_id === x.id && p.mes === mes)) fijos.push({ k: 'f', id: x.id, mes, f, t: x.concepto, monto: Number(x.monto), venc: f < hoy() }); });
  }
  // fijos ya vencidos del mes en curso que siguen sin pagar
  if (a <= hoy() && hoy() <= b) L.fijosPorVencer(0).filter((x) => x.vencido).forEach((x) => { if (!fijos.some((y) => y.id === x.id)) fijos.push({ k: 'f', id: x.id, mes: mesDe(hoy()), f: `${mesDe(hoy())}-${String(x.dia_vto).padStart(2, '0')}`, t: x.concepto, monto: Number(x.monto), venc: true }); });
  return [...pend, ...fijos].sort((x, y) => (x.f < y.f ? -1 : 1));
}

export function html() {
  const tabs = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['cuentas', 'Cuentas'], ['deseos', 'Deseos']];
  return `
  <header class="top"><div><p class="muted up">Ingresos, gastos y resultado</p><h1>Plata</h1></div>
    <div class="row g"><button class="btn primary" data-nuevo="gasto">+ Gasto</button><button class="btn" data-nuevo="ingreso">+ Ingreso</button></div></header>
  <nav class="tabs">${tabs.map(([k, l]) => `<a href="javascript:void 0" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
  ${tab === 'dia' ? diaHtml() : tab === 'semana' ? semanaHtml() : tab === 'mes' ? mesHtml() : tab === 'deseos' ? Deseos.html() : cuentasHtml()}`;
}

const navFecha = (txt, paso) => `<div class="mes"><button class="btn sm ghost" data-nav="${paso === 'm' ? '-m' : -paso}" aria-label="Anterior">‹</button><b>${txt}</b><button class="btn sm ghost" data-nav="${paso}" aria-label="Siguiente">›</button>${sel !== hoy() && paso !== 'm' ? '<button class="btn sm" data-hoy="1">Hoy</button>' : ''}</div>`;

const movLi = (m, conFecha) => `<li><span class="dot" style="background:${m.tipo === 'ingreso' ? 'var(--green)' : colorCat(m.categoria)}"></span>${conFecha ? `<span class="muted sm">${fecha(m.fecha)}</span>` : ''}
  <span class="t">${esc(m.detalle || m.categoria || '')}${m.detalle ? ` <small class="muted">· ${esc(m.categoria || '')}</small>` : ''}${m.estado === 'pendiente' ? ` <small class="chip" style="--c:var(--amber)">${m.tipo === 'gasto' ? 'a pagar' : 'a cobrar'}</small>` : ''}</span>
  <b class="${m.tipo === 'ingreso' ? 'green' : ''}">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</b>
  ${m.estado === 'pendiente' ? `<button class="btn sm" data-ok="${m.id}">${m.tipo === 'ingreso' ? 'Cobrado' : 'Pagado'}</button>` : ''}
  <button class="btn sm ghost" data-edm="${m.id}" aria-label="Editar">✎</button></li>`;

const cuentaLi = (c) => `<li><span class="ic">${c.k === 'f' ? '📌' : '💸'}</span><span class="t">${esc(c.t)} <small class="muted">${c.venc ? '<b class="red">vencido</b> · ' : ''}${fecha(c.f)}</small></span><b>${money(c.monto)}</b>
  <button class="btn sm ok" ${c.k === 'f' ? `data-pagafijo="${c.id}" data-mes="${c.mes}"` : `data-ok="${c.id}"`}>Pagar</button></li>`;

function catBars(xs, total) {
  const max = xs[0]?.[1] || 1;
  return xs.map(([k, v]) => `<div class="cat"><div class="row sp sm"><span><span class="dot" style="background:${colorCat(k)}"></span> ${esc(k)}</span><b>${money(v)} <small class="muted">${total ? Math.round((v / total) * 100) : 0}%</small></b></div>${bar((v / max) * 100, colorCat(k))}</div>`).join('');
}

// ---------- Día ----------
function diaHtml() {
  const f = sel; const xs = movsEntre(f, f); const g = gastosDe(xs); const tg = sum(g, (m) => m.monto);
  const ti = sum(ingresosDe(xs), (m) => m.monto); const gymDia = sum(bbEntre(f, f), (x) => x.monto);
  const lunes = L.inicioSemana(f); const tSem = sum(gastosDe(movsEntre(lunes, f)), (m) => m.monto);
  const tMes = sum(gastosDe(movsEntre(mesDe(f) + '-01', f)), (m) => m.monto);
  const cuentas = cuentasEntre(f, f);
  return `${navFecha(fechaLarga(f) + (f === hoy() ? ' · hoy' : ''), 1)}
  <div class="stats4">
    <div class="card stat"><span>Gastaste este día</span><b class="red">${money(tg)}</b><small>${g.length} ${g.length === 1 ? 'gasto' : 'gastos'}</small></div>
    <div class="card stat"><span>Entró este día</span><b class="green">${money(ti)}</b><small>${gymDia ? `+ el gym cobró ${money(gymDia)} (bruto)` : 'sin contar el gym'}</small></div>
    <div class="card stat"><span>Acumulado semana</span><b>${money(tSem)}</b><small>desde el lunes ${fecha(lunes)}</small></div>
    <div class="card stat"><span>Acumulado mes</span><b>${money(tMes)}</b><small>gastos del día a día</small></div>
  </div>
  <div class="grid2">
    <section class="card">
      <h2>Anotar gasto rápido</h2>
      <form id="f-rapido" class="stack">
        <div class="row g"><input name="monto" type="number" inputmode="decimal" min="0" step="any" placeholder="Monto" required class="big"><input name="detalle" placeholder="Detalle (ej: Coto, corte de pelo)"></div>
        <div class="chips">${catsGasto().map((c, i) => `<label class="pick"><input type="radio" name="categoria" value="${esc(c)}" ${i === 0 ? 'checked' : ''}><span style="--c:${colorCat(c)}">${esc(c)}</span></label>`).join('')}</div>
        <button class="btn primary">Guardar gasto del ${f === hoy() ? 'día' : fecha(f)}</button>
      </form>
    </section>
    <section class="card">
      <h2>Cuentas a pagar este día</h2>
      <ul class="list">${cuentas.map(cuentaLi).join('') || vacio('Nada para pagar este día.')}</ul>
      ${tg ? `<h3 class="muted up mt">En qué se fue</h3>${catBars(porCat(g), tg)}` : ''}
    </section>
  </div>
  <section class="card"><div class="row sp"><h2>Movimientos del día</h2><b>${money(ti - tg)}</b></div>
    <ul class="list movs">${xs.map((m) => movLi(m)).join('') || vacio('Sin movimientos este día.')}</ul></section>`;
}

// ---------- Semana ----------
function semanaHtml() {
  const lunes = L.inicioSemana(sel); const dom = addDias(lunes, 6); const dias = Array.from({ length: 7 }, (_, i) => addDias(lunes, i));
  const xs = movsEntre(lunes, dom); const g = gastosDe(xs); const tg = sum(g, (m) => m.monto);
  const ti = sum(ingresosDe(xs), (m) => m.monto); const gymSem = sum(bbEntre(lunes, dom), (x) => x.monto);
  const prev = sum(gastosDe(movsEntre(addDias(lunes, -7), addDias(lunes, -1))), (m) => m.monto);
  const porDia = dias.map((f) => ({ f, g: sum(gastosDe(movsEntre(f, f)), (m) => m.monto), cats: porCat(gastosDe(movsEntre(f, f))) }));
  const max = Math.max(...porDia.map((x) => x.g), 1); const cuentas = cuentasEntre(lunes, dom);
  const diff = prev ? Math.round(((tg - prev) / prev) * 100) : null;
  return `${navFecha(`${fecha(lunes)} – ${fecha(dom)}`, 7)}
  <div class="stats4">
    <div class="card stat"><span>Gastos de la semana</span><b class="red">${money(tg)}</b><small>${diff === null ? 'sin semana anterior para comparar' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs semana pasada`}</small></div>
    <div class="card stat"><span>Entró en la semana</span><b class="green">${money(ti)}</b><small>${gymSem ? `+ el gym cobró ${money(gymSem)} (bruto)` : 'sin contar el gym'}</small></div>
    <div class="card stat"><span>Promedio por día</span><b>${money(tg / 7)}</b><small>si seguís así: ${money((tg / 7) * 30)} / mes</small></div>
    <div class="card stat"><span>A pagar esta semana</span><b>${money(sum(cuentas, (c) => c.monto))}</b><small>${cuentas.length} cuentas</small></div>
  </div>
  <section class="card"><h2>Gasto por día</h2>
    <div class="barras">${porDia.map((x) => `<button class="barra ${x.f === hoy() ? 'hoy' : ''}" data-ir="${x.f}" aria-label="${fechaLarga(x.f)}: ${money(x.g)}">
      <small>${x.g ? money(x.g).replace('$', '') : ''}</small><span class="pila" style="height:${(x.g / max) * 100}%">${x.cats.map(([k, v]) => `<i style="flex:${v};background:${colorCat(k)}"></i>`).join('')}</span><b>${DIAS[parse(x.f).getDay()].slice(0, 3)}</b></button>`).join('')}</div>
    <p class="muted sm">Cada color es una categoría. Tocá un día para ver el detalle y editarlo.</p>
  </section>
  <div class="grid2">
    <section class="card"><h2>Por categoría</h2>${catBars(porCat(g), tg) || vacio('Sin gastos esta semana.')}</section>
    <section class="card"><h2>Cuentas a pagar</h2><ul class="list">${cuentas.map(cuentaLi).join('') || vacio('Nada para pagar esta semana.')}</ul></section>
  </div>
  <section class="card"><h2>Movimientos de la semana</h2><ul class="list movs">${xs.map((m) => movLi(m, true)).join('') || vacio('Sin movimientos.')}</ul></section>`;
}

// ---------- Mes: estado de resultados ----------
function donut(parts, total) {
  let acc = 0;
  const segs = parts.filter(([, v]) => v > 0).map(([k, v]) => { const p = (v / total) * 100; const s = `<circle r="15.915" cx="21" cy="21" fill="none" stroke="${colorCat(k)}" stroke-width="6" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${25 - acc}"><title>${esc(k)}: ${money(v)}</title></circle>`; acc += p; return s; }).join('');
  return `<svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Gastos por sección"><circle r="15.915" cx="21" cy="21" fill="none" stroke="var(--surface-2)" stroke-width="6"/>${segs}
    <text x="21" y="20" text-anchor="middle" class="d1">${money(total)}</text><text x="21" y="25.5" text-anchor="middle" class="d2">gastado</text></svg>`;
}

function curva(mes) {
  const ini = mes + '-01'; const d0 = parse(ini); const n = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const R = L.resumenMes(mes); const fs = Array.from({ length: n }, (_, i) => addDias(ini, i)); const hasta = mes === mesDe(hoy()) ? parse(hoy()).getDate() : n;
  let ai = 0, ag = 0; const I = [], G = [];
  fs.forEach((f) => {
    ai += sum(ingresosDe(movsEntre(f, f)), (m) => m.monto) + sum(bbEntre(f, f), (x) => x.monto);
    ag += sum(gastosDe(movsEntre(f, f)), (m) => m.monto) + sum(S.fijosPagos.filter((p) => p.mes === mes && S.fijos.find((x) => x.id === p.fijo_id)?.dia_vto === parse(f).getDate()), (p) => p.monto);
    I.push(ai); G.push(ag);
  });
  // los fijos pagados sin día de vencimiento se suman al día 1
  const sinDia = sum(S.fijosPagos.filter((p) => p.mes === mes && !S.fijos.find((x) => x.id === p.fijo_id)?.dia_vto), (p) => p.monto);
  // costos del gym: fijos al día 1, el resto en su fecha
  const gym = R.gym; const fijosGym = gym.tFijos;
  for (let i = 0; i < G.length; i++) G[i] += sinDia + fijosGym + sum(gym.otros.filter((g) => g.fecha <= fs[i]), (g) => g.monto);
  const max = Math.max(...I, ...G, R.gastos, 1); const W = 600, H = 170;
  const pts = (A) => A.slice(0, hasta).map((v, i) => `${(i / (n - 1)) * W},${H - (v / max) * H}`).join(' ');
  return `<svg viewBox="0 -6 ${W} ${H + 12}" class="chart dos" role="img" aria-label="Ingresos y gastos acumulados del mes"><polyline points="${pts(I)}" class="pi"/><polyline points="${pts(G)}" class="pg"/></svg>
  <div class="row g sm"><span><span class="dot" style="background:var(--green)"></span> Entró acumulado (con cobros del gym)</span><span><span class="dot" style="background:var(--red)"></span> Salió acumulado (con costos del gym)</span></div>`;
}

function mesHtml() {
  const mes = mesDe(sel); const R = L.resumenMes(mes); const P = L.resumenMes(mesDe(addDias(mes + '-01', -1)));
  const g = gastosDe(R.movs); const cats = porCat(g);
  const fijosPag = S.fijos.filter((f) => f.activo && R.pagadoFijo(f)).map((f) => [f.concepto, Number(R.pagadoFijo(f).monto ?? f.monto)]);
  const secciones = [...(R.fijosPagados ? [['Gastos fijos', R.fijosPagados]] : []), ...cats];
  const gano = R.resultado >= 0; const pctAhorro = R.ingresos ? Math.round((R.resultado / R.ingresos) * 100) : 0;
  const vs = (a, b) => (b ? `${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))}% vs ${MESES[Number(mesDe(addDias(mes + '-01', -1)).slice(5)) - 1]}` : '');
  const pres = Number(S.perfil?.presupuesto_mes) || 0;
  return `${navFecha(mesLabel(mes), 'm')}
  <section class="card veredicto ${gano ? 'ok' : 'mal'}">
    <div><span class="up">${gano ? 'Mes ganado' : 'Mes en rojo'}</span><h2>${gano ? `Te quedó ${money(R.resultado)} a favor` : `Gastaste ${money(-R.resultado)} más de lo que entró`}</h2>
    <p class="sm">${!R.ingresos ? 'Todavía no registraste ingresos este mes.' : gano ? `Ahorraste el ${pctAhorro}% de lo que entró.` : `Saliste ${-pctAhorro}% por encima de lo que entró.`} ${R.aCobrar ? `Te faltan cobrar ${money(R.aCobrar)}.` : ''} ${R.aPagar ? `Quedan ${money(R.aPagar)} por pagar.` : ''}</p></div>
    <b class="huge">${gano ? '🏆' : '⚠️'}</b>
  </section>
  ${pres ? `<section class="card"><div class="row sp"><h2>Presupuesto del día a día</h2><span class="sm">${money(R.gastosVar)} de ${money(pres)}</span></div>${bar((R.gastosVar / pres) * 100, R.gastosVar > pres ? 'var(--red)' : 'var(--green)')}<p class="muted sm">${R.gastosVar > pres ? `Te pasaste ${money(R.gastosVar - pres)}.` : `Te quedan ${money(pres - R.gastosVar)} para el resto del mes.`}</p></section>` : ''}
  <div class="grid2">
    <section class="card">
      <h2>Estado de resultados</h2>
      <table class="eerr">
        <tr class="h"><td>Ingresos</td><td class="green">${money(R.ingresos)}</td></tr>
        ${R.porFuente.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>${k.startsWith('Gym neto') ? `<tr class="muted sub"><td>Cobros ${money(R.bb)} − costos del gym ${money(R.gym.total)}</td><td></td></tr>` : ''}`).join('') || '<tr><td class="muted">Sin ingresos</td><td></td></tr>'}
        <tr class="h"><td>Gastos fijos</td><td class="red">−${money(R.fijosPagados)}</td></tr>
        ${fijosPag.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('')}
        ${R.fijosPend.length ? `<tr class="muted"><td>Sin pagar todavía (${R.fijosPend.length})</td><td>${money(sum(R.fijosPend, (f) => f.monto))}</td></tr>` : ''}
        <tr class="h"><td>Gastos del día a día</td><td class="red">−${money(R.gastosVar)}</td></tr>
        ${cats.map(([k, v]) => `<tr><td><span class="dot" style="background:${colorCat(k)}"></span> ${esc(k)}</td><td>${money(v)}</td></tr>`).join('')}
        <tr class="tot ${gano ? 'green' : 'red'}"><td>Resultado</td><td>${money(R.resultado)}</td></tr>
      </table>
      <p class="muted sm">${vs(R.ingresos, P.ingresos) ? `Ingresos ${vs(R.ingresos, P.ingresos)} · ` : ''}${vs(R.gastos, P.gastos) ? `Gastos ${vs(R.gastos, P.gastos)}` : ''}</p>
    </section>
    <section class="card">
      <div class="row sp"><h2>¿En qué se me fue?</h2><button class="btn sm ghost" id="b-pres">${pres ? 'Presupuesto: ' + money(pres) : 'Poner presupuesto'}</button></div>
      ${R.gastos ? `<div class="donut-w">${donut(secciones, R.gastos)}<div class="leyenda">${secciones.map(([k, v]) => `<div class="row sp sm"><span><span class="dot" style="background:${colorCat(k)}"></span> ${esc(k)}</span><b>${Math.round((v / R.gastos) * 100)}%</b></div>`).join('')}</div></div>` : vacio('Sin gastos este mes.')}
    </section>
  </div>
  <section class="card"><h2>Cómo viene el mes</h2>${curva(mes)}</section>
  <section class="card"><h2>Todos los movimientos de ${esc(mesLabel(mes))}</h2><ul class="list movs">${R.movs.map((m) => movLi(m, true)).join('') || vacio('Sin movimientos.')}</ul></section>`;
}

// ---------- Fijos y cuentas ----------
function cuentasHtml() {
  const mes = mesDe(hoy()); const R = L.resumenMes(mes); const sync = (() => { try { return localStorage.getItem('il-bb-sync'); } catch { return null; } })();
  const pend = S.movs.filter((m) => m.estado === 'pendiente').sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return `<div class="grid2">
    <section class="card">
      <div class="row sp"><h2>Gastos fijos · ${esc(mesLabel(mes))}</h2><button class="btn sm primary" id="b-fijo-new">+ Agregar</button></div>
      <p class="muted sm">${money(R.totalFijos)} por mes · ${money(R.fijosPagados)} pagados</p>
      <ul class="list">${S.fijos.filter((f) => f.activo).map((f) => { const p = R.pagadoFijo(f);
        return `<li><span class="t">${esc(f.concepto)}${f.dia_vto ? ` <small class="muted">vence el ${f.dia_vto}</small>` : ''}</span><span>${money(p?.monto ?? f.monto)}</span>
        <button class="btn sm ${p ? 'ok' : ''}" data-fijo="${f.id}">${p ? '✓ Pagado' : 'Pagar'}</button><button class="btn sm ghost" data-fijo-edit="${f.id}" aria-label="Editar ${esc(f.concepto)}">✎</button></li>`; }).join('') || vacio('Sin gastos fijos. Agregá el primero.')}</ul>
    </section>
    <section class="card">
      <h2>Pendientes</h2>
      <ul class="list movs">${pend.map((m) => movLi(m, true)).join('') || vacio('Nada pendiente de pagar ni cobrar.')}</ul>
    </section>
  </div>
  <section class="card">
    <h2>Categorías de gastos</h2>
    <p class="muted sm">Son las secciones en las que se divide tu plata. Agregá, renombrá o borrá las que quieras (separadas por coma).</p>
    <form id="f-cats" class="row g"><input name="c" value="${esc(catsGasto().join(', '))}"><button class="btn sm primary">Guardar</button></form>
    <div class="chips mt">${catsGasto().map((c) => `<span class="chip" style="--c:${colorCat(c)}">${esc(c)}</span>`).join('')}</div>
  </section>
  ${gymHtml(sync)}`;
}

// ---------- Gym: cobros de Base Bambino menos costos del gym = lo que te queda ----------
let mesGym = null;
function gymHtml(sync) {
  const mes = mesGym || mesDe(hoy()); const R = L.resumenMes(mes); const G = L.costosGym(mes, true);
  const vig = S.gymFijos.filter((f) => L.fijoGymVigente(f, mes));
  const navG = `<div class="mes"><button class="btn sm ghost" data-gmes="-1" aria-label="Mes anterior">‹</button><b>${esc(mesLabel(mes))}</b><button class="btn sm ghost" data-gmes="1" aria-label="Mes siguiente">›</button></div>`;
  return `<section class="card" id="gym">
    <div class="row sp wrap"><h2>Gym: lo que te queda (neto)</h2>${navG}</div>
    <p class="sm">${S.bbUser ? `Base Bambino conectado como ${esc(S.bbUser.email)}. ${sync ? 'Última actualización: ' + new Date(sync).toLocaleString('es-AR') + '.' : ''}` : 'Base Bambino no está conectado. Entrá con tu usuario para traer los cobros solos. No se modifica nada allá.'}</p>
    <div class="row g">${S.bbUser ? '<button class="btn sm" id="bb-sync">Actualizar ahora</button><button class="btn sm ghost" id="bb-out">Desconectar</button>' : '<button class="btn sm primary" id="bb-in">Conectar Base Bambino</button>'}</div>
    <table class="eerr mt">
      <tr class="h"><td>Cobros del gym <small class="muted">(Base Bambino)</small></td><td class="green">${money(R.bb)}</td></tr>
      <tr class="h"><td>Costos fijos del gym</td><td class="red">−${money(G.tFijos)}</td></tr>
      ${G.fijos.map((x) => `<tr><td>${esc(x.f.concepto)}${x.ajuste ? ' <small class="muted">(ajustado este mes)</small>' : ''}</td><td>${money(x.monto)}</td></tr>`).join('')}
      <tr class="h"><td>Otros gastos del gym</td><td class="red">−${money(G.tOtros)}</td></tr>
      <tr class="tot ${R.bb - G.total >= 0 ? 'green' : 'red'}"><td>Neto del gym</td><td>${money(R.bb - G.total)}</td></tr>
    </table>
    <p class="muted sm">Este neto es lo que entra como ingreso en tu estado de resultados del mes. Base Bambino solo tiene los cobros, así que los costos del gym se cargan acá.</p>
  </section>
  <div class="grid2">
    <section class="card">
      <div class="row sp"><h2>Costos fijos del gym</h2><button class="btn sm primary" id="b-gf-new">+ Agregar</button></div>
      <p class="muted sm">Alquiler, sueldos, luz, internet, sistema… Se descuentan solos cada mes. Si un mes fue distinto, tocá "Este mes".</p>
      <ul class="list">${vig.map((f) => { const x = G.fijos.find((y) => y.f.id === f.id);
        return `<li><span class="t">${esc(f.concepto)}${x?.ajuste ? ` <small class="muted">este mes ${money(x.monto)}</small>` : ''}</span><b>${money(f.monto)}</b>
        <button class="btn sm" data-gf-mes="${f.id}">Este mes</button><button class="btn sm ghost" data-gf-ed="${f.id}" aria-label="Editar ${esc(f.concepto)}">✎</button></li>`; }).join('') || vacio('Sin costos fijos cargados. Agregá el alquiler, sueldos y servicios del gym.')}</ul>
    </section>
    <section class="card">
      <h2>Otros gastos del gym · ${esc(mesLabel(mes))}</h2>
      <form id="f-gg" class="row g wrap"><input name="concepto" placeholder="Ej: equipamiento, limpieza, arreglo" required><input name="monto" type="number" inputmode="decimal" min="0" step="any" placeholder="Monto" required><input name="fecha" type="date" value="${mes === mesDe(hoy()) ? hoy() : mes + '-01'}" required><button class="btn sm primary">Agregar</button></form>
      <ul class="list mt">${G.otros.map((g) => `<li><span class="muted sm">${fecha(g.fecha)}</span><span class="t">${esc(g.concepto)}</span><b>${money(g.monto)}</b><button class="btn sm ghost" data-gg-ed="${g.id}" aria-label="Editar">✎</button></li>`).join('') || vacio('Sin otros gastos del gym este mes.')}</ul>
    </section>
  </div>`;
}

function editarGymFijo(f, rerender) {
  modal(f ? 'Editar costo fijo del gym' : 'Nuevo costo fijo del gym', `<form id="f-gf" class="stack">
    <label>Concepto<input name="concepto" value="${esc(f?.concepto || '')}" placeholder="Ej: alquiler, sueldo profe, luz" required></label>
    <div class="row g"><label>Monto por mes<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${f?.monto ?? ''}" required></label>
    <label>Desde<input name="desde" type="month" value="${f?.desde || mesDe(hoy())}"></label></div>
    <p class="muted sm">Si cambia el monto (por ejemplo, aumenta el alquiler), editalo acá: se aplica a todos los meses. Para un solo mes usá "Este mes".</p>
    <div class="row sp"><button class="btn primary">Guardar</button>${f ? '<button type="button" class="btn ghost red" id="b-gf-baja">Dar de baja</button>' : ''}</div></form>`, (md) => {
    const form = md.querySelector('#f-gf');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const row = { concepto: form.concepto.value.trim(), monto: Number(form.monto.value), desde: form.desde.value || null };
      const r = f ? await sb.from('gym_fijos').update(row).eq('id', f.id).select().single() : await sb.from('gym_fijos').insert({ ...row, orden: S.gymFijos.length }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (f) Object.assign(f, row); else S.gymFijos.push(r.data);
      cerrarModal(); toast('Guardado'); rerender();
    };
    const baja = md.querySelector('#b-gf-baja');
    if (baja) baja.onclick = async () => {
      if (baja.dataset.armed !== '1') { baja.dataset.armed = '1'; baja.textContent = '¿Seguro? Deja de contar desde el mes que viene'; return; }
      const hasta = mesDe(hoy());
      const r = await sb.from('gym_fijos').update({ hasta }).eq('id', f.id);
      if (r.error) return toast(errorMsg(r.error), true);
      f.hasta = hasta; cerrarModal(); toast('Dado de baja. Los meses anteriores no cambian'); rerender();
    };
  });
}

function ajustarGymMes(f, mes, rerender) {
  const aj = S.gymGastos.find((g) => g.fijo_id === f.id && mesDe(g.fecha) === mes);
  modal(`${f.concepto} · ${mesLabel(mes)}`, `<form id="f-ga" class="stack">
    <label>¿Cuánto fue este mes?<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${aj ? aj.monto : f.monto}" required></label>
    <p class="muted sm">Solo cambia ${esc(mesLabel(mes))}. El resto de los meses sigue en ${money(f.monto)}.</p>
    <div class="row sp"><button class="btn primary">Guardar</button>${aj ? '<button type="button" class="btn ghost" id="b-ga-reset">Volver al monto normal</button>' : ''}</div></form>`, (md) => {
    md.querySelector('#f-ga').onsubmit = async (e) => {
      e.preventDefault(); const monto = Number(e.target.monto.value);
      const r = aj ? await sb.from('gym_gastos').update({ monto }).eq('id', aj.id).select().single()
        : await sb.from('gym_gastos').insert({ fijo_id: f.id, concepto: f.concepto, monto, fecha: mes + '-01' }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (aj) aj.monto = monto; else S.gymGastos.unshift(r.data);
      cerrarModal(); rerender();
    };
    const rs = md.querySelector('#b-ga-reset');
    if (rs) rs.onclick = async () => {
      const r = await sb.from('gym_gastos').delete().eq('id', aj.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.gymGastos = S.gymGastos.filter((x) => x.id !== aj.id); cerrarModal(); rerender();
    };
  });
}

function editarGymGasto(g, rerender) {
  modal('Editar gasto del gym', `<form id="f-ge" class="stack">
    <label>Concepto<input name="concepto" value="${esc(g.concepto)}" required></label>
    <div class="row g"><label>Monto<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${g.monto}" required></label><label>Día<input name="fecha" type="date" value="${g.fecha}" required></label></div>
    <div class="row sp"><button class="btn primary">Guardar</button><button type="button" class="btn ghost red" id="b-ge-del">Borrar</button></div></form>`, (md) => {
    const form = md.querySelector('#f-ge');
    form.onsubmit = async (e) => {
      e.preventDefault(); const row = { concepto: form.concepto.value.trim(), monto: Number(form.monto.value), fecha: form.fecha.value };
      const r = await sb.from('gym_gastos').update(row).eq('id', g.id);
      if (r.error) return toast(errorMsg(r.error), true);
      Object.assign(g, row); cerrarModal(); rerender();
    };
    const del = md.querySelector('#b-ge-del');
    del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Seguro? Tocá de nuevo'; return; }
      const r = await sb.from('gym_gastos').delete().eq('id', g.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.gymGastos = S.gymGastos.filter((x) => x.id !== g.id); cerrarModal(); rerender();
    };
  });
}

// ---------- Editor de movimientos ----------
function editarMov(m, tipo, rerender) {
  const t = m?.tipo || tipo; const existe = !!m?.id; const cats = t === 'gasto' ? catsGasto() : CAT_INGRESO;
  const catAct = m?.categoria || cats[0];
  modal(existe ? 'Editar movimiento' : t === 'gasto' ? 'Nuevo gasto' : 'Nuevo ingreso', `<form id="f-m" class="stack">
    <div class="seg"><button type="button" data-t="gasto" class="${t === 'gasto' ? 'on' : ''}">Gasto</button><button type="button" data-t="ingreso" class="${t === 'ingreso' ? 'on' : ''}">Ingreso</button></div>
    <div class="row g"><label>Monto<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${m?.monto ?? ''}" required class="big"></label><label>Día<input name="fecha" type="date" value="${m?.fecha || sel}" required></label></div>
    <label>Detalle<input name="detalle" value="${esc(m?.detalle || '')}" placeholder="${t === 'gasto' ? 'Ej: Coto, corte de pelo, Uber al centro' : 'Ej: clase particular de Juan'}"></label>
    <label>Categoría<input name="categoria" list="dl-cats" value="${esc(catAct)}" required></label>
    <datalist id="dl-cats">${[...new Set([...cats, ...S.movs.filter((x) => x.tipo === t).map((x) => x.categoria).filter(Boolean)])].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="row g"><label>Medio<select name="medio">${['Transferencia', 'Efectivo', 'Tarjeta', 'Mercado Pago'].map((x) => `<option ${x === m?.medio ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label>Estado<select name="estado"><option value="hecho">${t === 'gasto' ? 'Pagado' : 'Cobrado'}</option><option value="pendiente" ${m?.estado === 'pendiente' ? 'selected' : ''}>${t === 'gasto' ? 'A pagar' : 'A cobrar'}</option></select></label></div>
    <div class="row sp"><button class="btn primary">Guardar</button>${existe ? '<button type="button" class="btn ghost red" id="b-mdel">Borrar</button>' : ''}</div></form>`, (md) => {
    const f = md.querySelector('#f-m');
    md.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
      if (b.dataset.t === t) return;
      editarMov({ ...(m || {}), tipo: b.dataset.t, monto: f.monto.value, fecha: f.fecha.value, detalle: f.detalle.value, categoria: '', estado: f.estado.value }, b.dataset.t, rerender);
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const row = { tipo: t, monto: Number(f.monto.value), fecha: f.fecha.value, detalle: f.detalle.value.trim() || null, categoria: f.categoria.value.trim() || 'Otros', medio: f.medio.value, estado: f.estado.value };
      if (!(row.monto > 0)) return toast('Poné un monto', true);
      const orig = existe && S.movs.find((x) => x.id === m.id);
      const r = orig ? await sb.from('movimientos').update(row).eq('id', orig.id).select().single() : await sb.from('movimientos').insert(row).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (orig) Object.assign(orig, row); else S.movs.unshift(r.data);
      S.movs.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      await revisarAutomaticos(); cerrarModal(); toast(orig ? 'Actualizado' : `${t === 'gasto' ? 'Gasto' : 'Ingreso'} guardado. +2 XP`); rerender();
    };
    const del = md.querySelector('#b-mdel');
    if (del) del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Seguro? Tocá de nuevo'; return; }
      const r = await sb.from('movimientos').delete().eq('id', m.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.movs = S.movs.filter((x) => x.id !== m.id); cerrarModal(); rerender();
    };
  });
}

async function pagarFijo(f, mes, rerender) {
  modal(`Pagar ${f.concepto}`, `<form id="f-fp" class="stack"><label>Monto pagado en ${esc(mesLabel(mes))}<input name="monto" type="number" inputmode="decimal" value="${f.monto}" required></label><button class="btn primary">Marcar pagado</button></form>`, (m) => {
    m.querySelector('#f-fp').onsubmit = async (e) => {
      e.preventDefault();
      const r = await sb.from('fijos_pagos').insert({ fijo_id: f.id, mes, monto: Number(e.target.monto.value) }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      S.fijosPagos.push(r.data); cerrarModal(); toast('Pagado. +5 XP'); rerender();
    };
  });
}

export function mount(v, rerender) {
  const on = (s, fn) => v.querySelectorAll(s).forEach((b) => b.onclick = () => fn(b));
  on('[data-tab]', (b) => { tab = b.dataset.tab; rerender(); });
  if (tab === 'deseos') Deseos.mount(v, rerender);
  on('[data-nav]', (b) => { const n = b.dataset.nav;
    if (n.endsWith('m')) { const d = parse(mesDe(sel) + '-01'); d.setMonth(d.getMonth() + (n.startsWith('-') ? -1 : 1)); sel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
    else sel = addDias(sel, Number(n)); rerender(); });
  on('[data-hoy]', () => { sel = hoy(); rerender(); });
  on('[data-ir]', (b) => { sel = b.dataset.ir; tab = 'dia'; rerender(); window.scrollTo(0, 0); });
  on('[data-nuevo]', (b) => editarMov(null, b.dataset.nuevo, rerender));
  on('[data-edm]', (b) => editarMov(S.movs.find((x) => x.id === b.dataset.edm), null, rerender));
  on('[data-ok]', async (b) => {
    const r = await sb.from('movimientos').update({ estado: 'hecho' }).eq('id', b.dataset.ok);
    if (r.error) return toast(errorMsg(r.error), true);
    S.movs.find((m) => m.id === b.dataset.ok).estado = 'hecho'; toast('Listo'); rerender();
  });
  on('[data-pagafijo]', (b) => pagarFijo(S.fijos.find((x) => x.id === b.dataset.pagafijo), b.dataset.mes, rerender));
  const fr = v.querySelector('#f-rapido'); if (fr) fr.onsubmit = async (e) => {
    e.preventDefault();
    const row = { tipo: 'gasto', monto: Number(fr.monto.value), categoria: fr.categoria.value, detalle: fr.detalle.value.trim() || null, fecha: sel, medio: 'Efectivo', estado: 'hecho' };
    if (!(row.monto > 0)) return toast('Poné un monto', true);
    const r = await sb.from('movimientos').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.movs.unshift(r.data); S.movs.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    await revisarAutomaticos(); toast(`−${money(row.monto)} en ${row.categoria}. +2 XP`); rerender();
  };
  on('#b-pres', () => modal('Presupuesto mensual', `<form id="f-pr" class="stack"><label>¿Cuánto querés gastar como máximo en el día a día por mes? (sin contar fijos)<input name="p" type="number" inputmode="decimal" min="0" value="${S.perfil?.presupuesto_mes ?? ''}"></label>
    <p class="muted sm">Dejalo vacío para no usar presupuesto.</p><button class="btn primary">Guardar</button></form>`, (m) => {
    m.querySelector('#f-pr').onsubmit = async (e) => { e.preventDefault(); const val = e.target.p.value ? Number(e.target.p.value) : null;
      const r = await sb.from('perfil').update({ presupuesto_mes: val }).eq('user_id', S.user.id); if (r.error) return toast(errorMsg(r.error), true);
      S.perfil.presupuesto_mes = val; cerrarModal(); rerender(); }; }));
  const fc = v.querySelector('#f-cats'); if (fc) fc.onsubmit = async (e) => {
    e.preventDefault(); const xs = [...new Set(fc.c.value.split(',').map((s) => s.trim()).filter(Boolean))];
    if (!xs.length) return toast('Dejá al menos una categoría', true);
    const r = await sb.from('perfil').update({ categorias_gasto: xs }).eq('user_id', S.user.id);
    if (r.error) return toast(errorMsg(r.error), true); S.perfil.categorias_gasto = xs; toast('Categorías guardadas'); rerender();
  };
  on('[data-fijo]', async (b) => {
    const f = S.fijos.find((x) => x.id === b.dataset.fijo); const mes = mesDe(hoy());
    const p = S.fijosPagos.find((x) => x.fijo_id === f.id && x.mes === mes);
    if (!p) return pagarFijo(f, mes, rerender);
    const r = await sb.from('fijos_pagos').delete().eq('id', p.id);
    if (r.error) return toast(errorMsg(r.error), true);
    S.fijosPagos = S.fijosPagos.filter((x) => x.id !== p.id); rerender();
  });
  const editarFijo = (f) => modal(f ? 'Editar gasto fijo' : 'Nuevo gasto fijo', `<form id="f-fe" class="stack">
      <label>Concepto<input name="concepto" value="${esc(f?.concepto || '')}" placeholder="Ej: Internet, monotributo, gimnasio" required></label>
      <div class="row g"><label>Monto por mes<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${f?.monto ?? ''}" required></label>
      <label>Día de vencimiento<input name="dia_vto" type="number" inputmode="numeric" min="1" max="31" value="${f?.dia_vto ?? ''}" placeholder="1 a 31"></label></div>
      <p class="muted sm">Con el día de vencimiento te aviso en Hoy, en Plata y en el mail de las 7 AM.</p>
      <div class="row sp"><button class="btn primary">Guardar</button>${f ? '<button type="button" class="btn ghost red" id="b-fe-del">Dar de baja</button>' : ''}</div></form>`, (m) => {
    const form = m.querySelector('#f-fe');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const row = { concepto: form.concepto.value.trim(), monto: Number(form.monto.value), dia_vto: form.dia_vto.value ? Number(form.dia_vto.value) : null };
      if (row.dia_vto !== null && (row.dia_vto < 1 || row.dia_vto > 31)) return toast('El día tiene que ser entre 1 y 31', true);
      const r = f ? await sb.from('gastos_fijos').update(row).eq('id', f.id).select().single()
        : await sb.from('gastos_fijos').insert({ ...row, orden: S.fijos.length }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (f) Object.assign(f, row); else S.fijos.push(r.data);
      cerrarModal(); toast(f ? 'Gasto fijo actualizado' : 'Gasto fijo agregado'); rerender();
    };
    const del = m.querySelector('#b-fe-del');
    if (del) del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Seguro? Tocá de nuevo'; return; }
      const r = await sb.from('gastos_fijos').update({ activo: false }).eq('id', f.id);
      if (r.error) return toast(errorMsg(r.error), true);
      f.activo = false; cerrarModal(); toast('Dado de baja. Lo podés reactivar en Perfil > Gastos fijos'); rerender();
    };
  });
  on('#b-fijo-new', () => editarFijo());
  on('[data-gmes]', (b) => { const d = parse((mesGym || mesDe(hoy())) + '-01'); d.setMonth(d.getMonth() + Number(b.dataset.gmes)); mesGym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; rerender(); });
  on('#b-gf-new', () => editarGymFijo(null, rerender));
  on('[data-gf-ed]', (b) => editarGymFijo(S.gymFijos.find((x) => x.id === b.dataset.gfEd), rerender));
  on('[data-gf-mes]', (b) => ajustarGymMes(S.gymFijos.find((x) => x.id === b.dataset.gfMes), mesGym || mesDe(hoy()), rerender));
  on('[data-gg-ed]', (b) => editarGymGasto(S.gymGastos.find((x) => x.id === b.dataset.ggEd), rerender));
  const fgg = v.querySelector('#f-gg'); if (fgg) fgg.onsubmit = async (e) => {
    e.preventDefault(); const row = { concepto: fgg.concepto.value.trim(), monto: Number(fgg.monto.value), fecha: fgg.fecha.value };
    if (!(row.monto > 0)) return toast('Poné un monto', true);
    const r = await sb.from('gym_gastos').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.gymGastos.unshift(r.data); toast('Gasto del gym anotado'); rerender();
  };
  on('[data-fijo-edit]', (b) => editarFijo(S.fijos.find((x) => x.id === b.dataset.fijoEdit)));
  const sy = v.querySelector('#bb-sync'); if (sy) sy.onclick = async () => { sy.disabled = true; const r = await sincronizarBB(); toast(r.ok ? `Listo: ${r.n} cobros leídos` : 'No pude leer: ' + r.motivo, !r.ok); rerender(); };
  const out = v.querySelector('#bb-out'); if (out) out.onclick = async () => { await bb.auth.signOut(); S.bbUser = null; rerender(); };
  const inn = v.querySelector('#bb-in'); if (inn) inn.onclick = () => modal('Conectar Base Bambino', `<form id="f-bb" class="stack">
      <p class="sm muted">Entrá con el mismo usuario que usás en Base Bambino. Solo se leen tus cobros, no se cambia nada allá.</p>
      <label>Mail<input name="email" type="email" required></label><label>Contraseña<input name="pass" type="password" required></label>
      <button class="btn primary">Conectar</button></form>`, (m) => {
    m.querySelector('#f-bb').onsubmit = async (e) => {
      e.preventDefault();
      const r = await bb.auth.signInWithPassword({ email: e.target.email.value.trim(), password: e.target.pass.value });
      if (r.error) return toast('No pude entrar a Base Bambino: ' + r.error.message, true);
      await bbSesion(); cerrarModal(); const s = await sincronizarBB();
      toast(s.ok ? `Conectado. ${s.n} cobros leídos` : 'Conecté, pero no pude leer: ' + s.motivo, !s.ok); rerender();
    };
  });
}
