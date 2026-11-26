import { sb, S, bb, bbSesion, sincronizarBB } from '../data.js';
import { CAT_GASTO, CAT_INGRESO } from '../config.js';
import { esc, hoy, money, fecha, MESES, parse } from '../util.js';
import * as L from '../logic.js';
import { toast, errorMsg, vacio, bar, modal, cerrarModal } from '../ui.js';

let mes = hoy().slice(0, 7);
let tipo = 'gasto';

const mesLabel = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mover = (m, n) => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function html() {
  const R = L.resumenMes(mes);
  const sync = localStorage.getItem('il-bb-sync');
  const cats = tipo === 'gasto' ? CAT_GASTO : CAT_INGRESO;
  const maxCat = R.porCategoria[0]?.[1] || 1;
  return `
  <header class="top"><div><p class="muted up">Ingresos, gastos y ahorro</p><h1>Plata</h1></div>
    <div class="mes"><button class="btn sm ghost" data-mes="-1" aria-label="Mes anterior">‹</button><b>${esc(mesLabel(mes))}</b><button class="btn sm ghost" data-mes="1" aria-label="Mes siguiente">›</button></div></header>

  <div class="stats4">
    <div class="card stat"><span>Entró</span><b class="green">${money(R.ingresos)}</b><small>Gym ${money(R.bb)} · otros ${money(R.manual)}</small></div>
    <div class="card stat"><span>Salió</span><b class="red">${money(R.gastos)}</b><small>Fijos ${money(R.fijosPagados)} · día a día ${money(R.gastosVar)}</small></div>
    <div class="card stat"><span>Te quedó</span><b class="${R.resultado >= 0 ? 'green' : 'red'}">${money(R.resultado)}</b><small>${R.ingresos ? Math.round((R.resultado / R.ingresos) * 100) : 0}% de lo que entró</small></div>
    <div class="card stat"><span>Pendiente</span><b>${money(R.aCobrar)} <i class="muted">a cobrar</i></b><small>${money(R.aPagar)} a pagar</small></div>
  </div>

  <section class="card">
    <h2>Anotar</h2>
    <div class="seg"><button data-tipo="gasto" class="${tipo === 'gasto' ? 'on' : ''}">Gasto</button><button data-tipo="ingreso" class="${tipo === 'ingreso' ? 'on' : ''}">Ingreso</button></div>
    <form id="f-mov" class="stack">
      <input name="monto" type="number" inputmode="decimal" min="0" step="any" placeholder="Monto" required class="big">
      <div class="chips">${cats.map((c, i) => `<label class="pick"><input type="radio" name="categoria" value="${esc(c)}" ${i === 0 ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div>
      <div class="row g"><input name="detalle" placeholder="Detalle (opcional)"><input name="fecha" type="date" value="${hoy()}"></div>
      <div class="row g"><select name="medio"><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option></select>
      <select name="estado"><option value="hecho">${tipo === 'gasto' ? 'Pagado' : 'Cobrado'}</option><option value="pendiente">${tipo === 'gasto' ? 'A pagar' : 'A cobrar'}</option></select></div>
      <button class="btn primary">Guardar ${tipo}</button>
    </form>
  </section>

  <div class="grid2">
    <section class="card">
      <div class="row sp"><h2>Gastos fijos</h2><span class="muted sm">${money(R.totalFijos)} / mes</span><button class="btn sm primary" id="b-fijo-new">+ Agregar</button></div>
      <ul class="list">${S.fijos.filter((f) => f.activo).map((f) => { const p = R.pagadoFijo(f);
        return `<li><span class="t">${esc(f.concepto)}${f.dia_vto ? ` <small class="muted">vence el ${f.dia_vto}</small>` : ''}</span><span>${money(p?.monto ?? f.monto)}</span>
        <button class="btn sm ${p ? 'ok' : ''}" data-fijo="${f.id}">${p ? '✓ Pagado' : 'Pagar'}</button><button class="btn sm ghost" data-fijo-edit="${f.id}" aria-label="Editar ${esc(f.concepto)}">✎</button></li>`; }).join('') || vacio('Sin gastos fijos. Agregá el primero.')}</ul>
    </section>
    <section class="card">
      <h2>¿En qué se me va?</h2>
      ${R.porCategoria.map(([k, v]) => `<div class="cat"><div class="row sp sm"><span>${esc(k)}</span><b>${money(v)}</b></div>${bar((v / maxCat) * 100, 'var(--amber)')}</div>`).join('') || vacio('Todavía no anotaste gastos del día a día este mes.')}
      <h2 class="mt">¿De dónde entra?</h2>
      ${R.porFuente.map(([k, v]) => `<div class="row sp sm cat"><span>${esc(k)}</span><b class="green">${money(v)}</b></div>`).join('') || vacio('Sin ingresos este mes.')}
    </section>
  </div>

  <section class="card">
    <h2>Movimientos de ${esc(mesLabel(mes))}</h2>
    <ul class="list movs">${R.movs.map((m) => `<li><span class="muted sm">${fecha(m.fecha)}</span><span class="t">${esc(m.categoria || '')}${m.detalle ? ` · <small>${esc(m.detalle)}</small>` : ''}</span>
      <b class="${m.tipo === 'ingreso' ? 'green' : ''}">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</b>
      ${m.estado === 'pendiente' ? `<button class="btn sm" data-ok="${m.id}">${m.tipo === 'ingreso' ? 'Cobrado' : 'Pagado'}</button>` : ''}
      <button class="btn sm ghost" data-del="${m.id}" aria-label="Borrar">✕</button></li>`).join('') || vacio('Sin movimientos.')}</ul>
  </section>

  <section class="card">
    <div class="row sp"><h2>Ingresos del gym (Base Bambino)</h2><span class="muted sm">solo lectura</span></div>
    <p class="sm">${S.bbUser ? `Conectado como ${esc(S.bbUser.email)}. ${sync ? 'Última actualización: ' + new Date(sync).toLocaleString('es-AR') : ''}` : 'No conectado. Entrá con tu usuario de Base Bambino para traer tus cobros automáticamente. No se modifica nada allá.'}</p>
    <div class="row g">${S.bbUser ? '<button class="btn sm" id="bb-sync">Actualizar ahora</button><button class="btn sm ghost" id="bb-out">Desconectar</button>' : '<button class="btn sm primary" id="bb-in">Conectar Base Bambino</button>'}</div>
  </section>`;
}

export function mount(v, rerender) {
  v.querySelectorAll('[data-mes]').forEach((b) => b.onclick = () => { mes = mover(mes, Number(b.dataset.mes)); rerender(); });
  v.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => { tipo = b.dataset.tipo; rerender(); });
  v.querySelector('#f-mov').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const row = { tipo, monto: Number(f.monto.value), categoria: f.categoria.value, detalle: f.detalle.value.trim() || null, fecha: f.fecha.value || hoy(), medio: f.medio.value, estado: f.estado.value };
    if (!(row.monto > 0)) return toast('Poné un monto', true);
    const r = await sb.from('movimientos').insert(row).select().single();
    if (r.error) return toast(errorMsg(r.error), true);
    S.movs.unshift(r.data); S.movs.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    toast(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} guardado. +2 XP`); rerender();
  };
  v.querySelectorAll('[data-fijo]').forEach((b) => b.onclick = async () => {
    const f = S.fijos.find((x) => x.id === b.dataset.fijo);
    const p = S.fijosPagos.find((x) => x.fijo_id === f.id && x.mes === mes);
    if (p) {
      const r = await sb.from('fijos_pagos').delete().eq('id', p.id);
      if (r.error) return toast(errorMsg(r.error), true);
      S.fijosPagos = S.fijosPagos.filter((x) => x.id !== p.id); return rerender();
    }
    modal(`Pagar ${f.concepto}`, `<form id="f-fp" class="stack"><label>Monto pagado este mes<input name="monto" type="number" inputmode="decimal" value="${f.monto}" required></label><button class="btn primary">Marcar pagado</button></form>`, (m) => {
      m.querySelector('#f-fp').onsubmit = async (e) => {
        e.preventDefault();
        const r = await sb.from('fijos_pagos').insert({ fijo_id: f.id, mes, monto: Number(e.target.monto.value) }).select().single();
        if (r.error) return toast(errorMsg(r.error), true);
        S.fijosPagos.push(r.data); cerrarModal(); toast('Pagado. +5 XP'); rerender();
      };
    });
  });
  const editarFijo = (f) => modal(f ? 'Editar gasto fijo' : 'Nuevo gasto fijo', `<form id="f-fe" class="stack">
      <label>Concepto<input name="concepto" value="${esc(f?.concepto || '')}" placeholder="Ej: Internet, monotributo, gimnasio" required></label>
      <div class="row g"><label>Monto por mes<input name="monto" type="number" inputmode="decimal" min="0" step="any" value="${f?.monto ?? ''}" required></label>
      <label>Día de vencimiento<input name="dia_vto" type="number" inputmode="numeric" min="1" max="31" value="${f?.dia_vto ?? ''}" placeholder="1 a 31"></label></div>
      <p class="muted sm">Con el día de vencimiento te aviso en Hoy y en el mail de las 7 AM.</p>
      <div class="row sp"><button class="btn primary">Guardar</button>${f ? '<button type="button" class="btn ghost red" id="b-fe-del">Dar de baja</button>' : ''}</div></form>`, (m) => {
    const form = m.querySelector('#f-fe');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const row = { concepto: form.concepto.value.trim(), monto: Number(form.monto.value), dia_vto: form.dia_vto.value ? Number(form.dia_vto.value) : null };
      if (row.dia_vto !== null && (row.dia_vto < 1 || row.dia_vto > 31)) return toast('El día tiene que ser entre 1 y 31', true);
      const r = f ? await sb.from('gastos_fijos').update(row).eq('id', f.id).select().single()
        : await sb.from('gastos_fijos').insert({ ...row, orden: S.fijos.length }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      if (f) Object.assign(f, r.data); else S.fijos.push(r.data);
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
  v.querySelector('#b-fijo-new').onclick = () => editarFijo();
  v.querySelectorAll('[data-fijo-edit]').forEach((b) => b.onclick = () => editarFijo(S.fijos.find((x) => x.id === b.dataset.fijoEdit)));
  v.querySelectorAll('[data-ok]').forEach((b) => b.onclick = async () => {
    const r = await sb.from('movimientos').update({ estado: 'hecho' }).eq('id', b.dataset.ok);
    if (r.error) return toast(errorMsg(r.error), true);
    S.movs.find((m) => m.id === b.dataset.ok).estado = 'hecho'; rerender();
  });
  v.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '¿Borrar?'; return; }
    const r = await sb.from('movimientos').delete().eq('id', b.dataset.del);
    if (r.error) return toast(errorMsg(r.error), true);
    S.movs = S.movs.filter((m) => m.id !== b.dataset.del); rerender();
  });
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
