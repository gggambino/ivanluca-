import { sb, S, cargarTodo, sembrarSiHaceFalta, sembrarObjetivos, bbSesion, sincronizarBB } from './data.js';
import { esc } from './util.js';
import { toast, errorMsg, modal, cerrarModal } from './ui.js';
import * as L from './logic.js';
import * as Hoy from './views/hoy.js';
import * as Objetivos from './views/objetivos.js';
import * as Cabeza from './views/cabeza.js';
import * as Plata from './views/plata.js';
import * as Proyectos from './views/proyectos.js';
import * as Salud from './views/salud.js';
import * as Perfil from './views/perfil.js';

const app = document.getElementById('app');
const NAV = [
  { k: 'hoy', l: 'Hoy', ic: '◎', v: Hoy },
  { k: 'objetivos', l: 'Objetivos', ic: '⚑', v: Objetivos },
  { k: 'cabeza', l: 'Cabeza', ic: '☁', v: Cabeza },
  { k: 'plata', l: 'Plata', ic: '$', v: Plata },
  { k: 'proyectos', l: 'Proyectos', ic: '◆', v: Proyectos },
  { k: 'salud', l: 'Salud', ic: '❤', v: Salud },
  { k: 'perfil', l: 'Perfil', ic: '★', v: Perfil },
];
const ruta = () => (location.hash.replace(/^#\/?/, '').split('/')[0] || 'hoy');

function shell() {
  const r = ruta();
  const ev = L.eventosXP(); const g = L.nivelGeneral(L.xpTotal(ev));
  return `<div class="layout">
    <aside class="side">
      <a class="brand" href="#/hoy">IVAN <b>LUCA</b></a>
      <div class="lvl"><span>Nivel ${g.n}</span>${'<div class="bar sm"><span style="width:' + g.pct + '%"></span></div>'}</div>
      <nav>${NAV.map((n) => `<a href="#/${n.k}" class="${n.k === r ? 'on' : ''}"><i>${n.ic}</i><span>${n.l}</span></a>`).join('')}</nav>
    </aside>
    <main id="view"></main>
    <button class="fab" id="fab-cabeza" aria-label="Anotar algo que tengo en la cabeza">+ Cabeza</button>
  </div>`;
}

export function render() {
  const r = ruta(); const n = NAV.find((x) => x.k === r) || NAV[0];
  app.innerHTML = shell();
  const v = document.getElementById('view');
  try { v.innerHTML = n.v.html(); n.v.mount?.(v, render); }
  catch (e) { console.error(e); v.innerHTML = `<div class="card">Error: ${esc(errorMsg(e))}</div>`; }
  document.getElementById('fab-cabeza').onclick = abrirCabezaRapida;
}
window.addEventListener('il:render', render);

export function abrirCabezaRapida() {
  modal('¿Qué tenés en la cabeza?', `<form id="f-cab" class="stack">
      <textarea name="texto" rows="4" placeholder="Escribilo como te salga. Fecha y hora se guardan solas." required></textarea>
      <button class="btn primary">Sacarlo de la cabeza</button></form>`, (m) => {
    m.querySelector('#f-cab').onsubmit = async (e) => {
      e.preventDefault();
      const texto = e.target.texto.value.trim(); if (!texto) return;
      const r = await sb.from('cabeza').insert({ texto }).select().single();
      if (r.error) return toast(errorMsg(r.error), true);
      S.cabeza.unshift(r.data); cerrarModal(); toast('Anotado. +5 XP Bienestar'); render();
    };
  });
}

function login(msg = '') {
  app.innerHTML = `<div class="login"><form class="card" id="f-login">
    <h1 class="brand">IVAN <b>LUCA</b></h1><p class="muted sm">Centro de operaciones personal</p>
    ${msg ? `<p class="aviso">${esc(msg)}</p>` : ''}
    <label>Mail<input name="email" type="email" autocomplete="email" required></label>
    <label>Contraseña<input name="pass" type="password" autocomplete="current-password" minlength="6" required></label>
    <button class="btn primary" name="go" value="in">Entrar</button>
    <button class="btn ghost" name="go" value="up" type="submit">Primera vez: crear mi cuenta</button>
  </form></div>`;
  const f = document.getElementById('f-login');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const modo = e.submitter?.value; const email = f.email.value.trim(); const password = f.pass.value;
    const r = modo === 'up' ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } }) : await sb.auth.signInWithPassword({ email, password });
    if (r.error) return login(r.error.message === 'Invalid login credentials' ? 'Mail o contraseña incorrectos.' : r.error.message);
    if (modo === 'up' && !r.data.session) return login('Te mandé un mail para confirmar la cuenta. Confirmalo y volvé a entrar.');
  };
}

async function arrancar(user) {
  S.user = user;
  app.innerHTML = '<div class="boot">Cargando tu partida…</div>';
  try {
    await cargarTodo();
    if (await sembrarSiHaceFalta()) { await cargarTodo(); toast('Cargué tus datos iniciales de las planillas'); }
    await sembrarObjetivos();
    await Objetivos.revisarAutomaticos();
    render();
    if (await bbSesion()) sincronizarBB().then(async (r) => { if (r.ok) { await Objetivos.revisarAutomaticos(); render(); } });
  } catch (e) { console.error(e); app.innerHTML = `<div class="login"><div class="card">No pude cargar: ${esc(errorMsg(e))}</div></div>`; }
}

window.addEventListener('hashchange', () => { if (S.user) render(); });
let arrancado = null;
sb.auth.onAuthStateChange((_ev, session) => {
  const u = session?.user || null;
  if (u && arrancado !== u.id) { arrancado = u.id; arrancar(u); }
  if (!u) { arrancado = null; S.user = null; login(); }
});
