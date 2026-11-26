import { esc } from './util.js';
import { AREAS } from './config.js';

export function toast(msg, err = false) {
  const r = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  r.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}
export const xpToast = (xp, area) => toast(`+${xp} XP · ${AREAS[area]?.l || ''}`);
export const errorMsg = (e) => e?.message || String(e);

export function modal(titulo, html, onMount) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-bg" data-close="1"><div class="modal" role="dialog" aria-label="${esc(titulo)}">
    <div class="modal-h"><h3>${esc(titulo)}</h3><button class="x" data-close="1" aria-label="Cerrar">✕</button></div>
    <div class="modal-b">${html}</div></div></div>`;
  root.querySelector('.modal-bg').addEventListener('click', (e) => { if (e.target.dataset.close) cerrarModal(); });
  const first = root.querySelector('input,textarea,select');
  if (first) setTimeout(() => first.focus(), 30);
  onMount?.(root.querySelector('.modal'));
}
export const cerrarModal = () => { document.getElementById('modal-root').innerHTML = ''; };

export const areaChip = (a) => { const A = AREAS[a]; return A ? `<span class="chip" style="--c:${A.c}">${A.ic} ${esc(A.l)}</span>` : ''; };
export const areaOpts = (sel) => Object.entries(AREAS).map(([k, A]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${A.l}</option>`).join('');
export const bar = (pct, c = 'var(--red)') => `<div class="bar"><span style="width:${Math.max(0, Math.min(100, pct))}%;background:${c}"></span></div>`;
export const vacio = (txt) => `<div class="vacio">${esc(txt)}</div>`;
export const formData = (form) => Object.fromEntries(new FormData(form).entries());
