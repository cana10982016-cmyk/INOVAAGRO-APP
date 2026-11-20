/* INOVAAGRO: service worker. Guarda o app no celular para abrir sem internet.
   Dados do banco NÃO passam por aqui (ficam no IndexedDB, ver src/offline.js). */
const VERSAO = 'inovaagro-app-v5';
const MAPA = 'inovaagro-mapa';
const ESSENCIAIS = [
  './', './index.html', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './assets/logo.png', './assets/logo-escuro.png', './assets/favicon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => Promise.all(ESSENCIAIS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== MAPA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Busca na internet com limite de tempo; sem resposta, usa a cópia guardada.
async function redePrimeiro(req) {
  const c = await caches.open(VERSAO);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, f) => setTimeout(() => f(new Error('tempo')), 5000))]);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (e) {
    return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }
}
async function cacheMapa(req) {
  const c = await caches.open(MAPA);
  const hit = await c.match(req.url);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === 'opaque')) { c.put(req.url, r.clone()); aparar(c); }
    return r;
  } catch (e) { return Response.error(); }
}
let aparando = false;
async function aparar(c) { // limita o espaço das imagens de satélite
  if (aparando) return; aparando = true;
  try { const ks = await c.keys(); if (ks.length > 12000) for (const k of ks.slice(0, ks.length - 10000)) await c.delete(k); } finally { aparando = false; }
}
async function cacheDepoisRede(req) {
  const c = await caches.open(VERSAO);
  const hit = await c.match(req);
  const rede = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await rede) || Response.error();
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith('supabase.co')) return; // banco e login: sempre direto
  if (u.hostname === 'server.arcgisonline.com' || u.hostname === 'tile.openstreetmap.org') return e.respondWith(cacheMapa(req));
  if (u.origin === self.location.origin) return e.respondWith(redePrimeiro(req));
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) return e.respondWith(cacheDepoisRede(req));
});
