// Plata > Deseos: lo que quiero comprar o invertir, mes a mes, con vista del año. Se pasa al mes siguiente con un toque.
import { sb, S } from '../data.js';
import { esc, hoy, money, MESES, sum } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal } from '../ui.js';

let anio = Number(hoy().slice(0, 4));
const mesHoy = () => hoy().slice(0, 7);
const mesLabel = (m) => (m ? `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : 'Algún día');
const mesSig = (m) => { const y = Number(m.slice(0, 4)); const n = Number(m.slice(5)); return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`; };
const mesesAnio = (y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
const PRIO = { 1: ['Alta', 'var(--red)'], 2: ['Media', 'var(--amber)'], 3: ['Baja', 'var(--ink-3, #8A9AB0)'] };
const vivos = () => S.deseos.filter((d) => d.estado !== 'descartado');
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const montoD = (d) => Number(d.monto) || 0;

const itemLi = (d) => {
  const ok = d.estado === 'comprado'; const [pl, pc] = PRIO[d.prioridad] || PRIO[2];
  return `<li class="deseo ${ok ? 'hecho' : ''}"><span class="dot" style="background:${pc}" title="Prioridad ${pl}"></span>
  <span class="t">${esc(d.titulo)} ${d.tipo === 'inversion' ? '<small class="chip" style="--c:var(--blue, #2563EB)">inversión</small>' : ''}${d.movido ? ` <small class="${d.movido >= 3 ? 'red' : 'muted'}">· pasado ${d.movido} ${d.movido === 1 ? 'vez' : 'veces'}${d.movido >= 3 && !ok ? ': ¿lo querés de verdad o lo sacamos?' : ''}</small>` : ''}${d.nota ? `<br><small class="muted">${esc(d.nota)}</small>` : ''}</span>
  <b>${d.monto ? money(d.monto) : '<span class="muted">$ ?</span>'}</b>
  ${ok ? '<span class="chip" style="--c:var(--green)">✓ comprado</span>' : `<button class="btn sm ok" data-dcomprar="${d.id}" aria-label="Ya lo compré">✓</button>${d.mes ? `<button class="btn sm" data-dpasar="${d.id}" title="Pasar al mes siguiente">→ ${MESES[Number(mesSig(d.mes).slice(5)) - 1].slice(0, 3)}</button>` : ''}`}
  <button class="btn sm ghost" data-ded="${d.id}" aria-label="Editar">✎</button></li>`;
};

export function html() {
  const meses = mesesAnio(anio); const xs = vivos().filter((d) => d.mes && d.mes.startsWith(String(anio)));
  const plan = sum(xs, montoD); const comp = sum(xs.filter((d) => d.estado === 'comprado'), montoD);
  const inv = sum(xs.filter((d) => d.tipo === 'inversion'), montoD);
  const atras = vivos().filter((d) => d.estado === 'pendiente' && d.mes && d.mes < mesHoy());
  const sinMes = vivos().filter((d) => !d.mes && d.estado === 'pendiente');
  const porMes = meses.map((m) => [m, sum(xs.filter((d) => d.mes === m), montoD)]); const max = Math.max(1, ...porMes.map((x) => x[1]));
  const mh = mesHoy(); const R = L.resumenMes(mh);
  const pendMes = sum(vivos().filter((d) => d.mes === mh && d.estado === 'pendiente'), montoD);
  return `<div class="mes"><button class="btn sm ghost" data-danio="-1" aria-label="Año anterior">‹</button><b>${anio}</b><button class="btn sm ghost" data-danio="1" aria-label="Año siguiente">›</button></div>
  <div class="stats4">
    <div class="card stat"><span>Planeado en ${anio}</span><b>${money(plan)}</b><small>${xs.length} cosas</small></div>
    <div class="card stat"><span>Ya comprado</span><b class="green">${money(comp)}</b><small>${plan ? Math.round((comp / plan) * 100) : 0}% del plan</small></div>
    <div class="card stat"><span>Falta</span><b>${money(plan - comp)}</b><small>pendiente</small></div>
    <div class="card stat"><span>En inversiones</span><b>${money(inv)}</b><small>${plan ? Math.round((inv / plan) * 100) : 0}% del total</small></div>
  </div>
  ${anio === Number(mh.slice(0, 4)) && pendMes ? `<section class="card veredicto ${R.resultado >= pendMes ? 'ok' : 'mal'}"><div><span class="up">Este mes</span>
    <h2>Querés gastar ${money(pendMes)} en tu lista</h2>
    <p class="sm">${R.resultado >= pendMes ? `Hoy el mes viene ${money(R.resultado)} a favor, así que te da. Igual priorizá lo de prioridad alta.` : `Hoy el mes viene ${R.resultado >= 0 ? money(R.resultado) + ' a favor' : money(-R.resultado) + ' en rojo'}. No te da para todo: elegí lo importante y pasá el resto al mes que viene.`}</p></div><b class="huge">${R.resultado >= pendMes ? '👍' : '✋'}</b></section>` : ''}
  ${atras.length ? `<section class="card aviso"><div class="row sp"><span>⏳ Quedaron <b>${atras.length}</b> ${atras.length === 1 ? 'cosa' : 'cosas'} de meses anteriores sin comprar (${money(sum(atras, montoD))}).</span><button class="btn sm primary" id="d-traer">Pasar todo a ${esc(MESES[Number(mh.slice(5)) - 1])}</button></div></section>` : ''}
  <section class="card">
    <h2>Agregar a la lista</h2>
    <form id="f-deseo" class="row g wrap">
      <input name="titulo" placeholder="Ej: zapatillas, curso, cámara, plazo fijo" required>
      <input name="monto" type="number" inputmode="decimal" min="0" step="any" placeholder="$ aprox.">
      <select name="mes">${meses.map((m) => `<option value="${m}" ${m === (anio === Number(mh.slice(0, 4)) ? mh : meses[0]) ? 'selected' : ''}>${MESES[Number(m.slice(5)) - 1]}</option>`).join('')}<option value="">Algún día</option></select>
      <select name="tipo"><option value="compra">Compra</option><option value="inversion">Inversión</option></select>
      <button class="btn primary">Agregar</button>
    </form>
  </section>
  <section class="card"><h2>Tu ${anio} mes a mes</h2>
    <div class="anio-bars">${porMes.map(([m, v]) => { const c = sum(xs.filter((d) => d.mes === m && d.estado === 'comprado'), montoD);
      return `<a href="#d-${m}" class="ab ${m === mh ? 'hoy' : ''}" title="${esc(mesLabel(m))}: ${money(v)}"><span class="ab-c"><i style="height:${(v / max) * 100}%"></i><i class="ok" style="height:${(c / max) * 100}%"></i></span><small>${MESES[Number(m.slice(5)) - 1].slice(0, 1)}</small></a>`; }).join('')}</div>
    <p class="muted sm">Barra clara: lo que planeás. Verde: lo que ya compraste. Tocá un mes para ir a su lista.</p>
  </section>
  <div class="grid2">${meses.map((m) => { const ds = xs.filter((d) => d.mes === m); if (!ds.length && m !== mh) return '';
    const t = sum(ds, montoD); const c = sum(ds.filter((d) => d.estado === 'comprado'), montoD);
    return `<section class="card" id="d-${m}"><div class="row sp"><h2>${esc(cap(MESES[Number(m.slice(5)) - 1]))}${m === mh ? ' <small class="chip" style="--c:var(--orange, #FF6B2C)">este mes</small>' : ''}</h2><b>${money(t)}</b></div>
      ${t ? bar((c / t) * 100, 'var(--green)') : ''}
      <ul class="list">${ds.map(itemLi).join('') || vacio('Nada anotado para este mes.')}</ul></section>`; }).join('')}
    <section class="card"><div class="row sp"><h2>Algún día</h2><b>${money(sum(sinMes, montoD))}</b></div><p class="muted sm">Lo que querés pero todavía no tiene mes. Cuando lo decidas, editalo y ponele uno.</p>
      <ul class="list">${sinMes.map(itemLi).join('') || vacio('Vacío.')}</ul></section>
  </div>`;
}

async function guardar(d, row) {
  const r = await sb.from('deseos').update(row).eq('id', d.id).select().single();
  if (r.error) { toast(errorMsg(r.error), true); return false; }
  Object.assign(d, row); return true;
}

function comprar(d, rerender) {
  modal(`Compraste: ${d.titulo}`, `<form id="f-dc" class="stack">
    <div class="row g"><label>Monto final<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${d.monto ?? ''}"></label><label>Día<input name="fecha" type="date" value="${hoy()}"></label></div>
    <label class="row g"><input type="checkbox" name="mov" checked> Anotarlo también como gasto en Plata</label>
    <label>Categoría del gasto<input name="categoria" value="${esc(d.categoria || (d.tipo === 'inversion' ? 'Inversión' : 'Compras'))}"></label>
    <button class="btn primary">Listo, comprado</button></form>`, (md) => {
    md.querySelector('#f-dc').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target; const monto = f.monto.value ? Number(f.monto.value) : null;
      if (f.mov.checked) {
        if (!(monto > 0)) return toast('Poné el monto para anotarlo como gasto', true);
        const r = await sb.from('movimientos').insert({ tipo: 'gasto', monto, fecha: f.fecha.value, detalle: d.titulo, categoria: f.categoria.value.trim() || 'Compras', medio: 'Transferencia', estado: 'hecho' }).select().single();
        if (r.error) return toast(errorMsg(r.error), true);
        S.movs.unshift(r.data); S.movs.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      }
      if (!(await guardar(d, { estado: 'comprado', comprado_fecha: f.fecha.value, monto, categoria: f.categoria.value.trim() || null }))) return;
      cerrarModal(); toast('¡Tachado de la lista! 🏆'); rerender();
    };
  });
}

function editar(d, rerender) {
  const opts = [...mesesAnio(anio - 1), ...mesesAnio(anio), ...mesesAnio(anio + 1)];
  if (d.mes && !opts.includes(d.mes)) opts.push(d.mes);
  modal('Editar', `<form id="f-de" class="stack">
    <label>Qué<input name="titulo" value="${esc(d.titulo)}" required></label>
    <div class="row g"><label>Monto aprox.<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${d.monto ?? ''}"></label>
    <label>Mes<select name="mes">${opts.map((m) => `<option value="${m}" ${m === d.mes ? 'selected' : ''}>${esc(mesLabel(m))}</option>`).join('')}<option value="" ${!d.mes ? 'selected' : ''}>Algún día</option></select></label></div>
    <div class="row g"><label>Tipo<select name="tipo"><option value="compra">Compra</option><option value="inversion" ${d.tipo === 'inversion' ? 'selected' : ''}>Inversión</option></select></label>
    <label>Prioridad<select name="prioridad">${[1, 2, 3].map((p) => `<option value="${p}" ${p === d.prioridad ? 'selected' : ''}>${PRIO[p][0]}</option>`).join('')}</select></label>
    <label>Estado<select name="estado">${[['pendiente', 'Pendiente'], ['comprado', 'Comprado'], ['descartado', 'Ya no lo quiero']].map(([k, l]) => `<option value="${k}" ${k === d.estado ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label>Nota<input name="nota" value="${esc(d.nota || '')}" placeholder="Link, modelo, dónde comprarlo, para qué"></label>
    <div class="row sp"><button class="btn primary">Guardar</button><button type="button" class="btn ghost red" id="b-ddel">Borrar</button></div></form>`, (md) => {
    md.querySelector('#f-de').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const row = { titulo: f.titulo.value.trim(), monto: f.monto.value ? Number(f.monto.value) : null, mes: f.mes.value || null, tipo: f.tipo.value, prioridad: Number(f.prioridad.value), estado: f.estado.value, nota: f.nota.value.trim() || null };
      if (row.estado !== 'comprado') row.comprado_fecha = null;
      if (!(await guardar(d, row))) return; cerrarModal(); toast('Guardado'); rerender();
    };
    const del = md.querySelector('#b-ddel');
    del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '¿Seguro? Tocá de nuevo'; return; }
      const r = await sb.from('deseos').delete().eq('id', d.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.deseos = S.deseos.filter((x) => x.id !== d.id); cerrarModal(); rerender();
    };
  });
}

export function mount(v, rerender) {
  const on = (s, fn) => v.querySelectorAll(s).forEach((b) => b.onclick = (e) => fn(b, e));
  const busca = (id) => S.deseos.find((x) => x.id === id);
  on('[data-danio]', (b) => { anio += Number(b.dataset.danio); rerender(); });
  on('.ab', (b, e) => { e.preventDefault(); v.querySelector(b.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const f = v.querySelector('#f-deseo'); if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const row = { titulo: f.titulo.value.trim(), monto: f.monto.value ? Number(f.monto.value) : null, mes: f.mes.value || null, tipo: f.tipo.value };
    if (!row.titulo) return;
    const r = await sb.from('deseos').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.deseos.push(r.data); toast(`Anotado para ${mesLabel(row.mes)}`); rerender();
  };
  on('[data-dcomprar]', (b) => comprar(busca(b.dataset.dcomprar), rerender));
  on('[data-ded]', (b) => editar(busca(b.dataset.ded), rerender));
  on('[data-dpasar]', async (b) => { const d = busca(b.dataset.dpasar); const m = mesSig(d.mes);
    if (await guardar(d, { mes: m, movido: (d.movido || 0) + 1 })) { toast(`Pasado a ${mesLabel(m)}`); rerender(); } });
  on('#d-traer', async () => {
    const xs = vivos().filter((d) => d.estado === 'pendiente' && d.mes && d.mes < mesHoy());
    for (const d of xs) if (!(await guardar(d, { mes: mesHoy(), movido: (d.movido || 0) + 1 }))) return rerender();
    toast(`${xs.length} pasadas a ${mesLabel(mesHoy())}`); rerender();
  });
}
