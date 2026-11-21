/* INOVAAGRO — Modo campo (celular).
   Tela própria para o trabalho no campo: mapa em tela cheia, seletor de fazenda e talhão, GPS,
   atividades por grupo, visita com amostras e pontos georreferenciados (foto, vídeo, áudio, anexo, anotação),
   histórico, notificações, feed, clima e sincronização. Usa os dados e o armazenamento do app (window.INOVA). */
window.Campo = (function () {
  'use strict';
  // iPhone: quando o teclado fecha, o iOS às vezes deixa a página rolada e o app fica deslocado. Volta para o lugar.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    // impede o zoom automático do iPhone ao tocar num campo (o zoom com dois dedos continua funcionando no iOS)
    const vp = document.querySelector('meta[name=viewport]');
    if (vp && !/maximum-scale/.test(vp.content)) vp.content += ', maximum-scale=1';
    const ajeitar = () => setTimeout(() => {
      const a = document.activeElement;
      if (a && a.matches && a.matches('input, textarea, select, [contenteditable]')) return;
      if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }
    }, 150);
    document.addEventListener('focusout', ajeitar);
    window.addEventListener('orientationchange', ajeitar);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', ajeitar);
  }
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const LS = 'inovaagro.campo.v1';
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const LIMA = '#b1d243', AZUL = '#3b8ee8';

  let pref = { faz: null, base: 'sat', nomes: true, pontos: true, pluv: true, calor: null, calorDias: 90, recentes: [], rotaDias: 15, rotaNunca: false };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem(LS, JSON.stringify(pref)); } catch (e) { } };

  let root = null, map = null, bases = {}, baseAtual = null, lyTal, lyLbl, lyPts, lyPluv, lyGps, lyCalor, lyRota;
  let selTal = null, pane = 'inicio', fila = new Set(), nMidia = 0, faixaFechada = -1;
  const gps = { pos: null, watch: null, seguir: false };
  const movidas = new Map(); // seções do site exibidas dentro do modo campo
  const urlMidia = new Map(); // id da mídia -> URL local (prévia antes de enviar)

  // ---------- Ícones (traço simples, 24x24) ----------
  const P = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    rota: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
    cotesia: '<ellipse cx="12" cy="14.5" rx="3" ry="5"/><circle cx="12" cy="7" r="2"/><path d="M9.5 11.5 4 8.5M14.5 11.5l5.5-3M9 15H5M15 15h4M12 19.5V22"/>',
    semaforo: '<rect x="8" y="2.5" width="8" height="19" rx="3"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>',
    gps: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
    camadas: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    navegar: '<path d="M12 3 5 21l7-4 7 4z"/>',
    chuva: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    inicio: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    historico: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l3 2"/>',
    sino: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    feed: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    voltar: '<path d="m15 5-7 7 7 7"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    seta: '<path d="m6 9 6 6 6-6"/>',
    foto: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    anexo: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
    video: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="m15 11 6-3v8l-6-3z"/>',
    audio: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    nota: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    opcoes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    clima: '<path d="M7 17a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.5 10 3.5 3.5 0 0 1 17 17z"/><path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2"/>',
    suporte: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19a3 3 0 0 1-3 3h-3"/>',
    sair: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    tela: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    lupa: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 6 6"/><path d="M8 10.5h5M10.5 8v5"/>',
    pulv: '<path d="M3 15h10v-5H6l-3 3z"/><circle cx="6" cy="17.5" r="2"/><circle cx="11" cy="17.5" r="2"/><path d="M13 12h8M15 15l-1 3M18 15l-.5 3M21 15v3"/>',
    plantio: '<path d="M12 21v-8"/><path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6zM12 11c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M5 21h14"/>',
    avanco: '<path d="M4 20h16M4 16h10M4 12h6"/><path d="m16 9 3 3-3 3"/><path d="M12 12h7"/>',
    trator: '<circle cx="7" cy="16" r="4"/><circle cx="18" cy="17.5" r="2.5"/><path d="M7 12V5h6l2 5h4v5M11 12h4"/>',
    colheita: '<path d="M12 21V8M12 8c-2-1-3-3-3-5 2 0 3 2 3 5zM12 8c2-1 3-3 3-5-2 0-3 2-3 5zM12 13c-2-1-3-3-3-5 2 0 3 2 3 5zM12 13c2-1 3-3 3-5-2 0-3 2-3 5z"/><path d="M6 21h12"/>',
    perdas: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 6 6"/><circle cx="9" cy="9.5" r=".8"/><circle cx="12" cy="11" r=".8"/><circle cx="10" cy="12.5" r=".8"/>',
    adubo: '<path d="M6 7h12l-1 13H7z"/><path d="M8 7V4h8v3M9 12h6M9 15h6"/>',
    regua: '<path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
    solo: '<path d="M3 18c3-2 6-2 9 0s6 2 9 0M3 13c3-2 6-2 9 0s6 2 9 0"/><path d="M12 3v6M9 6l3 3 3-3"/>',
    pluv: '<path d="M8 3h8v14a4 4 0 0 1-8 0z"/><path d="M8 8h3M8 11h3M8 14h3"/>',
    lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    expandir: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

  // ---------- Atividades ----------
  const ATIV = [
    ['Aplicações', [['Ordem de aplicação', 'pulv', t => ordem(t, 'Pulverização')]]],
    ['Visita', [['Visita', 'lupa', t => novaVisita(t)]]],
    ['Plantio', [['Ordem de plantio', 'plantio', t => ordem(t, 'Plantio')], ['Avanço do plantio', 'avanco', t => avanco(t, 'Plantio')], ['Controle de plantio', 'regua', t => controle(t, 'Falhas de plantio')]]],
    ['Trabalho', [['Ordem de trabalho', 'trator', t => ordem(t, 'Tratos culturais')], ['Preparo de solo', 'solo', t => ordem(t, 'Preparo de solo')]]],
    ['Colheita', [['Ordem de colheita', 'colheita', t => ordem(t, 'Colheita')], ['Controle das perdas na colheita', 'perdas', t => controle(t, 'Perda na colheita')], ['Avanço da colheita', 'avanco', t => avanco(t, 'Colheita')]]],
    ['Fertilização', [['Ordem de fertilização', 'adubo', t => ordem(t, 'Fertilização')]]],
    ['Controle biológico', [['Liberação de Cotesia', 'cotesia', t => cotesiaNova(t)]]],
    ['Clima', [['Registrar chuva', 'pluv', () => chuva()]]],
  ];

  // ---------- Utilidades ----------
  const esc = s => I().esc(s);
  const email = () => (I().SB.user && I().SB.user.email) || '';
  const agoraISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };
  const fmtDH = s => s ? I().fmtDate(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : '—';
  const tal = id => I().get('talhoes', id);
  const faz = id => I().get('fazendas', id);
  const fazAtual = () => pref.faz ? faz(pref.faz) : null;
  // Caixa e centro de cada talhão calculados uma vez só (antes era refeito a cada toque e a cada movimento do mapa).
  const caixas = new WeakMap();
  function caixa(t) {
    if (!t || !t.geometry) return null;
    let c = caixas.get(t); if (c && c.g === t.geometry) return c;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const g = t.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) for (const [x, y] of p[0] || []) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    c = x0 === Infinity ? { g, vazio: true } : { g, x0, y0, x1, y1, lat: (y0 + y1) / 2, lng: (x0 + x1) / 2 };
    caixas.set(t, c); return c;
  }
  function centroTal(t) {
    if (!window.L) return null;
    const c = caixa(t); return c && !c.vazio ? L.latLng(c.lat, c.lng) : null;
  }
  function centroFaz(f) { const c = f && I().centroFaz ? I().centroFaz(f) : null; return c ? L.latLng(c[0], c[1]) : null; }
  function dentro(ll, t) {
    const g = t.geometry; if (!g) return false;
    const [y, x] = [ll.lat, ll.lng];
    const bx = caixa(t); if (!bx || bx.vazio || x < bx.x0 || x > bx.x1 || y < bx.y0 || y > bx.y1) return false;
    const anel = ring => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    return polys.some(p => anel(p[0]));
  }
  const talhaoEm = ll => I().S.data.talhoes.find(t => dentro(ll, t)) || null;
  function ultimaVisita(t) {
    const l = (I().S.monPorTal.get(String(t.id)) || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    return l[0] || null;
  }
  const SEM = { Verde: 'var(--ok)', Amarelo: 'var(--warn)', Vermelho: 'var(--bad)' };

  // ---------- Montagem ----------
  function montar() {
    root = $('#v-campo');
    root.classList.add('cp');
    root.innerHTML = `
      <div class="cp-pane cp-inicio" data-pane="inicio">
        <div id="cp-map" role="application" aria-label="Mapa dos talhões"></div>
        <button class="cp-round cp-menu-btn" data-cp="menu" aria-label="Abrir menu">${ic('menu')}</button>
        <button class="cp-pick" data-cp="pick" aria-label="Escolher fazenda e talhão"><span id="cp-faz">Fazenda</span><i></i><span id="cp-tal">Talhões</span>${ic('seta')}</button>
        <div class="cp-tools">
          <button class="cp-round" data-cp="gps" aria-label="Minha localização" title="Minha localização">${ic('gps')}</button>
          <button class="cp-round" data-cp="camadas" aria-label="Camadas do mapa" title="Camadas">${ic('camadas')}</button>
          <button class="cp-round" data-cp="rota" aria-label="Rota de visitas do dia" title="Rota do dia">${ic('rota')}</button>
          <button class="cp-round" data-cp="navegar" aria-label="Navegar até o talhão" title="Navegar até o talhão">${ic('navegar')}</button>
          <button class="cp-round" data-cp="chuva" aria-label="Registrar chuva no pluviômetro" title="Pluviômetro">${ic('pluv')}</button>
        </div>
        <div class="cp-card" id="cp-card" hidden></div>
        <button class="cp-fab" data-cp="atividades">${ic('mais')}<span>Atividade</span></button>
      </div>
      <div class="cp-pane cp-lista" data-pane="historico" hidden></div>
      <div class="cp-pane cp-host" data-pane="notificacoes" hidden><header class="cp-bar"><span></span><h1>Notificações</h1><span></span></header><div class="cp-host-in"></div></div>
      <div class="cp-pane cp-host" data-pane="feed" hidden><header class="cp-bar"><span></span><h1>Feed</h1><span></span></header><div class="cp-host-in"></div></div>
      <div class="cp-pane cp-host" data-pane="clima" hidden><header class="cp-bar"><button class="cp-ib" data-cp="tab" data-p="inicio" aria-label="Voltar">${ic('voltar')}</button><h1>Clima</h1><span></span></header><div class="cp-host-in"></div></div>
      <div class="cp-faixa" id="cp-faixa" hidden></div>
      <nav class="cp-tabs" aria-label="Seções do campo">
        <button data-cp="tab" data-p="inicio">${ic('inicio')}<span>Início</span></button>
        <button data-cp="tab" data-p="historico">${ic('historico')}<span>Histórico</span></button>
        <button data-cp="tab" data-p="notificacoes">${ic('sino')}<span>Notificações</span><b class="cp-badge" id="cp-bnot" hidden></b></button>
        <button data-cp="tab" data-p="feed">${ic('feed')}<span>Feed</span></button>
      </nav>
      <div class="cp-scrim" data-cp="fechar-menu"></div>
      <aside class="cp-drawer" id="cp-drawer" aria-label="Menu"></aside>
      <div class="cp-screens" id="cp-screens"></div>
      <div class="cp-sheet-bg" id="cp-sheet-bg" hidden><div class="cp-sheet" id="cp-sheet" role="dialog" aria-modal="true"></div></div>
      <input type="file" id="cp-file" hidden>`;
    root.addEventListener('click', clique);
    $('#cp-sheet-bg').addEventListener('click', e => { if (e.target.id === 'cp-sheet-bg') fecharSheet(); });
    montarMapa();
  }

  // Satélite: guarda mais imagens em volta da tela (sem buracos ao arrastar) e não baixa no meio do zoom.
  const TILE = { keepBuffer: 4, updateWhenZooming: false, updateWhenIdle: true };
  function montarMapa() {
    map = L.map('cp-map', { zoomControl: false, preferCanvas: true, attributionControl: true, wheelPxPerZoomLevel: 90, bounceAtZoomLimits: false });
    map.attributionControl.setPrefix('');
    const img = L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri', ...TILE });
    const nomes = L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, ...TILE });
    const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', ...TILE });
    bases = { sat: [img], hib: [img, nomes], ruas: [ruas] };
    lyTal = L.featureGroup().addTo(map);
    lyCalor = L.layerGroup().addTo(map);
    lyLbl = L.layerGroup().addTo(map);
    lyPts = L.layerGroup();
    lyPluv = L.layerGroup();
    lyGps = L.layerGroup().addTo(map);
    lyRota = L.layerGroup().addTo(map);
    setBase(pref.base);
    map.on('zoomend moveend', rotulos);
    map.on('click', e => { const t = talhaoEm(e.latlng); if (t) selecionar(t, false); else { selTal = null; desenharCard(); estilos(); } });
    desenhar();
    const f = fazAtual();
    if (f) enquadrarFaz(f); else enquadrarTudo();
  }
  function setBase(b) {
    if (!bases[b]) b = 'sat';
    if (baseAtual) for (const l of bases[baseAtual]) map.removeLayer(l);
    for (const l of bases[b]) l.addTo(map).bringToBack();
    baseAtual = b; pref.base = b; salvarPref();
  }
  function estilo(t) {
    const sel = selTal && String(selTal) === String(t.id);
    const daFaz = pref.faz && String(t.fazenda_id) === String(pref.faz);
    const c = pref.calor ? calor.get(String(t.id)) : undefined;
    if (c != null) return { color: sel ? LIMA : '#ffffff', weight: sel ? 3.5 : daFaz ? 2 : 1.2, opacity: daFaz || !pref.faz || sel ? 1 : 0.55, fillColor: COR_CL[c], fillOpacity: sel ? 0.6 : 0.5 };
    return { color: sel ? LIMA : '#ffffff', weight: sel ? 3.5 : daFaz ? 2 : 1.2, opacity: daFaz || !pref.faz || sel ? 1 : 0.55, fillColor: sel ? LIMA : '#ffffff', fillOpacity: sel ? 0.18 : pref.calor ? 0 : 0.04 };
  }
  // Contorno mais leve só para desenhar: tira pontos que ficam a menos de 0,5 m da linha (invisível no mapa).
  // A área, o PDF e o "dentro do talhão" continuam usando o contorno original.
  const leves = new WeakMap();
  function simplificar(anel) {
    if (anel.length < 8) return anel;
    const lat = anel[0][1] * Math.PI / 180, sx = Math.cos(lat) * 111320, sy = 110540, eps = 0.25; // 0,5 m ao quadrado
    const P = anel.map(([x, y]) => [x * sx, y * sy]), manter = new Uint8Array(P.length); manter[0] = manter[P.length - 1] = 1;
    const pilha = [[0, P.length - 1]];
    while (pilha.length) {
      const [a, b] = pilha.pop(), [ax, ay] = P[a], dx = P[b][0] - ax, dy = P[b][1] - ay, L2 = dx * dx + dy * dy; let md = -1, mi = -1;
      for (let i = a + 1; i < b; i++) { const [px, py] = P[i]; let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey; if (d > md) { md = d; mi = i; } }
      if (md > eps) { manter[mi] = 1; pilha.push([a, mi], [mi, b]); }
    }
    const r = anel.filter((_, i) => manter[i]); return r.length >= 4 ? r : anel;
  }
  function assinatura(g) { // muda quando o contorno muda
    let n = 0, h = 0; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) for (const r of p) for (const c of r) { n++; h = (h + c[0] * 7.13 + c[1] * 3.71) % 1e6; }
    return g.type + n + ':' + h.toFixed(6);
  }
  function geoLeve(t) {
    const g = t.geometry; let c = leves.get(t); if (c && c.g === g) return c.l;
    let l = g;
    try {
      if (g.type === 'Polygon') l = { type: 'Polygon', coordinates: g.coordinates.map(simplificar) };
      else if (g.type === 'MultiPolygon') l = { type: 'MultiPolygon', coordinates: g.coordinates.map(p => p.map(simplificar)) };
    } catch (e) { l = g; }
    leves.set(t, { g, l }); return l;
  }
  const camadaTal = new Map();
  function desenhar() {
    calcCalor();
    // Reaproveita os contornos que não mudaram (antes o mapa inteiro era refeito a cada sincronização).
    const vivos = new Set();
    for (const t of I().S.data.talhoes) {
      if (!t.geometry) continue;
      const k = String(t.id); vivos.add(k);
      const v = camadaTal.get(k);
      const sg = assinatura(t.geometry);
      if (v && v._sig === sg) { v.setStyle(estilo(t)); continue; }
      if (v) lyTal.removeLayer(v);
      const l = L.geoJSON(geoLeve(t), { style: () => estilo(t), interactive: false, smoothFactor: 1.5 });
      l._sig = sg; l.addTo(lyTal); camadaTal.set(k, l);
    }
    for (const [k, l] of camadaTal) if (!vivos.has(k)) { lyTal.removeLayer(l); camadaTal.delete(k); }
    desenharPontos(); desenharPluv(); rotulos(); desenharCard(); topo();
  }
  function estilos() { for (const t of I().S.data.talhoes) { const l = camadaTal.get(String(t.id)); if (l) l.setStyle(estilo(t)); } rotulos(); }
  // Nomes dos talhões: reaproveita os que já estão na tela e só cria ou tira os que mudaram.
  const lblTal = new Map(); let lblPedido = 0;
  function rotulos() {
    if (!map || !map._loaded || lblPedido) return;
    lblPedido = requestAnimationFrame(() => { lblPedido = 0; rotulosAgora(); });
  }
  function rotulosAgora() {
    if (!map || !map._loaded) return;
    const quer = new Map();
    if (pref.nomes && map.getZoom() >= 14 && !(rotaAtual && lyRota.getLayers().length)) {
      const b = map.getBounds().pad(0.15), s = b.getSouth(), n = b.getNorth(), w = b.getWest(), e = b.getEast();
      for (const t of I().S.data.talhoes) {
        if (!camadaTal.has(String(t.id))) continue;
        const c = caixa(t); if (!c || c.vazio || c.lat < s || c.lat > n || c.lng < w || c.lng > e) continue;
        quer.set(String(t.id) + '|' + t.nome, c);
        if (quer.size >= 250) break;
      }
    }
    for (const [k, m] of lblTal) if (!quer.has(k)) { lyLbl.removeLayer(m); lblTal.delete(k); }
    for (const [k, c] of quer) if (!lblTal.has(k)) {
      const m = L.marker([c.lat, c.lng], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'cp-lbl', html: `<span>${esc(k.slice(k.indexOf('|') + 1))}</span>`, iconSize: null }) }).addTo(lyLbl);
      lblTal.set(k, m);
    }
  }
  // ---------- Mapa de calor da cana ----------
  let calor = new Map(); // id do talhão -> 0 verde, 1 amarelo, 2 vermelho (visita mais recente do período)
  const clSem = s => s === 'Vermelho' ? 2 : s === 'Amarelo' ? 1 : s === 'Verde' ? 0 : null;
  function calcCalor() {
    calor = new Map(); if (lyCalor) lyCalor.clearLayers();
    const id = pref.calor;
    if (!id || !CN()) { legenda(); return; }
    const lim = new Date(Date.now() - pref.calorDias * 864e5).toISOString().slice(0, 10);
    const aj = ajustes(), ult = new Map(), f = pref.faz;
    for (const m of I().S.data.monitoramentos) {
      if (!m.data || m.data < lim) continue;
      let cl = null;
      if (id === 'todas') { cl = clSem(m.semaforo); if (cl == null) { const p = pior(m); cl = p ? p.cl : null; } }
      else { const x = medias(m).find(x => x.item && x.item.id === id); cl = x ? x.cl : null; }
      if (cl == null) continue;
      const k = String(m.talhao_id), d = m.data + (m.hora || ''), u = ult.get(k);
      if (!u || d > u.d) ult.set(k, { d, cl });
      const t = tal(m.talhao_id); if (f && (!t || String(t.fazenda_id) !== String(f))) continue;
      for (const a of m.amostras_detalhe || []) {
        if (a.lat == null || a.lng == null) continue;
        const it = CN().daAmostra(a); if (!it || (id !== 'todas' && it.id !== id)) continue;
        const c = CN().classe(it, num(a.valor), aj); if (c == null) continue;
        L.circle([a.lat, a.lng], { radius: 25, stroke: false, fillColor: COR_CL[c], fillOpacity: 0.55, interactive: false }).addTo(lyCalor);
      }
    }
    for (const [k, u] of ult) calor.set(k, u.cl);
    legenda();
  }
  function legenda() {
    let el = $('#cp-leg');
    if (!el) { el = document.createElement('button'); el.id = 'cp-leg'; el.className = 'cp-leg'; el.dataset.cp = 'camadas'; const m = $('#cp-map'); if (!m) return; m.after(el); }
    if (!pref.calor) { el.hidden = true; return; }
    const it = pref.calor === 'todas' ? null : CN() && CN().get(pref.calor);
    el.hidden = false;
    el.innerHTML = `<b>${esc(it ? it.nome : 'Semáforo das visitas')}</b><small>últimos ${pref.calorDias} dias</small><span>${['Abaixo', 'Atenção', 'Controle'].map((l, i) => `<i style="background:${COR_CL[i]}"></i>${l}`).join('')}</span>`;
  }

  function desenharPontos() {
    lyPts.clearLayers();
    const f = pref.faz;
    for (const m of I().S.data.monitoramentos) {
      if (!m.pontos || !m.pontos.length) continue;
      const t = tal(m.talhao_id); if (f && (!t || String(t.fazenda_id) !== String(f))) continue;
      for (const p of m.pontos) if (p.lat != null && p.lng != null) L.circleMarker([p.lat, p.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#fab219', fillOpacity: 1 }).bindTooltip(esc((p.obs || p.tipo || 'Ponto') + ' · ' + fmtDH(p.data))).on('click', ev => { L.DomEvent.stopPropagation(ev); abrirVisita(m); }).addTo(lyPts);
    }
    if (pref.pontos) lyPts.addTo(map); else map.removeLayer(lyPts);
  }
  function desenharPluv() {
    lyPluv.clearLayers();
    for (const p of I().S.data.pluviometros || []) if (p.lat != null && p.lng != null) L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'cp-pluv', html: ic('pluv'), iconSize: [30, 30] }) }).bindTooltip(esc(p.nome)).on('click', () => chuva(p)).addTo(lyPluv);
    if (pref.pluv) lyPluv.addTo(map); else map.removeLayer(lyPluv);
  }
  function enquadrarFaz(f) {
    let b = null;
    for (const t of I().S.talPorFaz.get(String(f.id)) || []) { const l = camadaTal.get(String(t.id)); if (l) b = b ? b.extend(l.getBounds()) : L.latLngBounds(l.getBounds().getSouthWest(), l.getBounds().getNorthEast()); }
    if (b) map.fitBounds(b, { padding: [40, 40], maxZoom: 16 }); else { const c = centroFaz(f); if (c) map.setView(c, 14); }
  }
  function enquadrarTudo() {
    let b = null;
    for (const t of I().S.data.talhoes) { const c = caixa(t); if (!c || c.vazio) continue; const cb = L.latLngBounds([c.y0, c.x0], [c.y1, c.x1]); b = b ? b.extend(cb) : cb; }
    if (b) map.fitBounds(b, { padding: [30, 30] }); else map.setView([-15.8, -47.9], 4);
  }
  function topo() {
    const f = fazAtual(), t = selTal ? tal(selTal) : null;
    $('#cp-faz').textContent = f ? f.nome : 'Fazenda';
    $('#cp-tal').textContent = t ? t.nome : 'Talhões';
  }
  function selecionar(t, enquadrar) {
    selTal = t.id;
    if (!pref.faz || String(pref.faz) !== String(t.fazenda_id)) { pref.faz = t.fazenda_id; salvarPref(); desenharPontos(); }
    estilos(); desenharCard(); topo();
    const l = camadaTal.get(String(t.id));
    if (enquadrar && l) map.fitBounds(l.getBounds(), { padding: [60, 60], maxZoom: 17 });
  }
  function desenharCard() {
    const el = $('#cp-card'); if (!el) return;
    const t = selTal ? tal(selTal) : null;
    if (!t) { el.hidden = true; return; }
    const f = faz(t.fazenda_id), c = I().culturaAtual(t), v = ultimaVisita(t);
    el.hidden = false;
    el.innerHTML = `<button class="cp-ib cp-card-x" data-cp="fechar-card" aria-label="Fechar">${ic('fechar')}</button>
      <div class="cp-card-t"><b>${esc(t.nome)}</b><span>${esc(f ? f.nome : '')} · ${I().fmtHa(t.area_ha)} ha</span></div>
      <div class="cp-card-i">${c ? `<span>${esc(c.cultura || '')}${c.variedade ? ' · ' + esc(c.variedade) : ''}${c.safra ? ' · ' + esc(c.safra) : ''}</span>` : '<span class="cp-mut">Sem safra cadastrada</span>'}
        <span>${v ? `Última visita: ${esc(I().fmtDate(v.data))}${v.semaforo ? ` <i class="cp-dot" style="background:${SEM[v.semaforo] || 'var(--muted)'}"></i>` : ''}` : '<span class="cp-mut">Sem visitas</span>'}</span></div>
      <div class="cp-card-b"><button class="cp-btn pri" data-cp="visita-nova">${ic('lupa')}Nova visita</button><button class="cp-btn" data-cp="atividades">${ic('mais')}Atividades</button><button class="cp-btn" data-cp="navegar">${ic('navegar')}Ir até o talhão</button><button class="cp-btn" data-cp="hist-tal">${ic('historico')}Histórico</button></div>`;
  }

  // ---------- Painéis inferiores ----------
  function abrirPane(p) {
    pane = p;
    devolverSecoes();
    $$('.cp-pane', root).forEach(el => el.hidden = el.dataset.pane !== p);
    $$('.cp-tabs button', root).forEach(b => b.toggleAttribute('aria-current', b.dataset.p === p));
    if (p === 'inicio') setTimeout(() => map.invalidateSize(), 30);
    if (p === 'historico') historico();
    if (p === 'notificacoes' || p === 'feed' || p === 'clima') embutir(p, $(`[data-pane="${p}"] .cp-host-in`, root));
    faixa();
  }
  function embutir(nome, host) {
    const sec = document.getElementById('v-' + nome); if (!sec) return;
    movidas.set(nome, sec.parentNode);
    host.appendChild(sec); sec.hidden = false;
    try { I().VIEWS[nome](true); } catch (e) { console.warn(e); }
  }
  function devolverSecoes() {
    for (const [nome, pai] of movidas) { const sec = document.getElementById('v-' + nome); if (sec && pai) { sec.hidden = true; pai.appendChild(sec); } }
    movidas.clear();
  }

  // ---------- Histórico ----------
  let filtroH = 'tudo', soFaz = true, histTal = null;
  const TIPOS_H = { tudo: 'Tudo', monitoramentos: 'Visitas', ordens: 'Ordens', avancos: 'Avanços', controles: 'Controles', chuvas: 'Chuvas' };
  function itensHistorico() {
    const S = I().S, out = [];
    const fz = soFaz && pref.faz ? String(pref.faz) : null;
    const okTal = id => { const t = tal(id); if (histTal) return String(id) === String(histTal); return !fz || (t && String(t.fazenda_id) === fz); };
    if (filtroH === 'tudo' || filtroH === 'monitoramentos') for (const m of S.data.monitoramentos) if (okTal(m.talhao_id)) out.push({ k: 'monitoramentos', r: m, d: (m.data || '') + (m.hora ? 'T' + m.hora : ''), t: 'Visita' + (m.alvo ? ' · ' + m.alvo : ''), s: nomeTalFaz(m.talhao_id), i: 'lupa', sem: m.semaforo });
    if (filtroH === 'tudo' || filtroH === 'ordens') for (const o of S.data.ordens) if (histTal ? (o.talhao_ids || []).map(String).includes(String(histTal)) : (!fz || String(o.fazenda_id) === fz)) out.push({ k: 'ordens', r: o, d: o.data_conclusao || o.data_prevista || o.atualizado_em || '', t: o.titulo || o.tipo || 'Ordem', s: (o.status || '') + ' · ' + (faz(o.fazenda_id)?.nome || ''), i: 'trator' });
    for (const k of ['avancos', 'controles']) if (filtroH === 'tudo' || filtroH === k) for (const a of S.data[k] || []) if (okTal(a.talhao_id)) out.push({ k, r: a, d: a.data || '', t: (k === 'avancos' ? 'Avanço · ' : 'Controle · ') + (a.tipo || ''), s: nomeTalFaz(a.talhao_id), i: k === 'avancos' ? 'avanco' : 'regua' });
    if ((filtroH === 'tudo' || filtroH === 'chuvas') && !histTal) for (const c of S.data.chuvas || []) { const p = I().get('pluviometros', c.pluviometro_id); if (fz && p && p.fazenda_id && String(p.fazenda_id) !== fz) continue; out.push({ k: 'chuvas', r: c, d: c.data || '', t: 'Chuva · ' + String(c.mm ?? '—').replace('.', ',') + ' mm', s: p ? p.nome : '', i: 'chuva' }); }
    return out.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  }
  const nomeTalFaz = id => { const t = tal(id); if (!t) return ''; const f = faz(t.fazenda_id); return t.nome + (f ? ' · ' + f.nome : ''); };
  let histLim = 40;
  function historico() {
    const el = $('[data-pane="historico"]', root);
    const itens = itensHistorico(), mostra = itens.slice(0, histLim);
    const tt = histTal ? tal(histTal) : null;
    el.innerHTML = `<header class="cp-bar"><span></span><h1>Histórico</h1><span></span></header>
      <div class="cp-chips">${Object.entries(TIPOS_H).map(([k, l]) => `<button class="cp-chip" data-cp="filtro-h" data-f="${k}" aria-pressed="${filtroH === k}">${l}</button>`).join('')}</div>
      <div class="cp-escopo">${tt ? `<span>Talhão <b>${esc(tt.nome)}</b></span><button class="cp-lnk" data-cp="hist-todos">Ver toda a fazenda</button>` : pref.faz ? `<label><input type="checkbox" data-cp="so-faz" ${soFaz ? 'checked' : ''}> Só ${esc(fazAtual()?.nome || 'esta fazenda')}</label>` : '<span class="cp-mut">Todas as fazendas</span>'}<span class="cp-mut">${I().fmtInt(itens.length)} registros</span></div>
      <ul class="cp-hist">${mostra.map(x => `<li><button data-cp="abrir-reg" data-k="${x.k}" data-id="${esc(x.r.id)}"><i class="cp-hi">${ic(x.i)}</i><span class="cp-ht"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="cp-hd">${esc(fmtDH(x.d))}${fila.has(x.k + ':' + x.r.id) ? '<em class="cp-pend">a enviar</em>' : ''}${x.sem ? `<i class="cp-dot" style="background:${SEM[x.sem]}"></i>` : ''}</span></button></li>`).join('') || '<li class="cp-vazio">Nada registrado ainda.</li>'}</ul>
      ${itens.length > mostra.length ? `<p style="text-align:center"><button class="cp-lnk" data-cp="hist-mais">Mostrar mais (${itens.length - mostra.length})</button></p>` : ''}`;
  }

  // ---------- Menu lateral ----------
  function menu() {
    const d = $('#cp-drawer'), I_ = I();
    const em = email(), pap = I_.PAPEIS[I_.S.papel]?.l || '';
    const n = I_.Sync.pend, off = !navigator.onLine || I_.Sync.offline;
    d.innerHTML = `<div class="cp-perfil"><div class="cp-av">${esc((em || 'IA').slice(0, 2).toUpperCase())}</div><div><b>${esc(em || 'INOVAAGRO')}</b><span>${esc(pap)}</span></div><button class="cp-ib" data-cp="fechar-menu" aria-label="Fechar menu">${ic('voltar')}</button></div>
      <section class="cp-syncbox"><h2>Sincronização</h2>
        <p>${n || nMidia ? `<b class="cp-warn">!</b> ${n ? n + ' alteraç' + (n > 1 ? 'ões' : 'ão') : ''}${n && nMidia ? ' e ' : ''}${nMidia ? nMidia + ' arquivo' + (nMidia > 1 ? 's' : '') : ''} para enviar` : 'Tudo enviado.'}${off ? ' Sem internet agora.' : ''}</p>
        <button class="cp-btn cp-btn-sync" data-cp="sync">${ic('sync')}Sincronizar agora</button>
        ${n || nMidia ? '<button class="cp-lnk cp-lnk-inv" data-cp="pendencias">Ver o que falta enviar</button>' : ''}
        ${Midia.semBucket ? '<p class="cp-aviso">As fotos estão guardadas no celular. Para enviá-las, o administrador precisa ativar o armazenamento de fotos no Supabase (arquivo supabase/03_fotos_campo.sql).</p>' : ''}
        <p class="cp-mut2">O app envia sozinho quando a internet volta.</p></section>
      <nav class="cp-mlinks">
        <button data-cp="opcoes">${ic('opcoes')}Opções</button>
        <button data-cp="rota">${ic('rota')}Rota de visitas do dia</button>
        <button data-cp="cot-lista">${ic('cotesia')}Liberações de Cotesia</button>
        <button data-cp="niveis">${ic('semaforo')}Níveis de controle da cana</button>
        <button data-cp="tab" data-p="clima">${ic('clima')}Clima</button>
        <button data-cp="suporte">${ic('suporte')}Centro de suporte</button>
        <button data-cp="completo">${ic('tela')}Versão completa do sistema</button>
        <button data-act="logout">${ic('sair')}Sair</button>
      </nav>`;
    root.classList.add('cp-menu-on');
  }
  const fecharMenu = () => root.classList.remove('cp-menu-on');

  // ---------- Folhas (bottom sheets) ----------
  function sheet(html, cls = '') {
    const s = $('#cp-sheet'); s.className = 'cp-sheet ' + cls; s.innerHTML = `<div class="cp-grip"></div>` + html;
    $('#cp-sheet-bg').hidden = false;
    return s;
  }
  function fecharSheet() { $('#cp-sheet-bg').hidden = true; $('#cp-sheet').innerHTML = ''; if (Rec.on) Rec.parar(true); }

  let pickTab = 'faz', pickCb = null;
  function picker(cb, titulo) {
    pickCb = cb || null; pickTab = pref.faz ? 'tal' : 'faz';
    sheet(`<header class="cp-sh-h"><h2>${esc(titulo || 'Fazenda e talhão')}</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="cp-seg" role="tablist"><button data-cp="pick-tab" data-t="faz">Fazenda</button><button data-cp="pick-tab" data-t="tal">Talhões</button></div>
      <input type="search" class="cp-busca" id="cp-pick-q" placeholder="Buscar" aria-label="Buscar">
      <ul class="cp-plist" id="cp-plist"></ul>`, 'alto');
    $('#cp-pick-q').addEventListener('input', listaPick);
    listaPick();
  }
  function listaPick() {
    const S = I().S, q = norm($('#cp-pick-q')?.value || '');
    $$('[data-cp="pick-tab"]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.t === pickTab));
    const ul = $('#cp-plist'); if (!ul) return;
    if (pickTab === 'faz') {
      const linhas = [];
      for (const p of S.data.produtores) {
        const fs = (S.fazPorProd.get(String(p.id)) || []).filter(f => !q || norm(f.nome + ' ' + p.nome).includes(q)).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        if (!fs.length) continue;
        linhas.push(`<li class="cp-pgrp">${esc(p.nome)}</li>`);
        for (const f of fs) { const ts = S.talPorFaz.get(String(f.id)) || []; linhas.push(`<li><button data-cp="pick-faz" data-id="${esc(f.id)}" ${String(f.id) === String(pref.faz) ? 'aria-current="true"' : ''}><b>${esc(f.nome)}</b><small>${ts.length} talhões · ${I().fmtHa(ts.reduce((s, t) => s + (Number(t.area_ha) || 0), 0))} ha</small></button></li>`); }
      }
      ul.innerHTML = (pref.faz ? '<li><button data-cp="pick-faz" data-id=""><b>Todas as fazendas</b></button></li>' : '') + (linhas.join('') || '<li class="cp-vazio">Nenhuma fazenda encontrada.</li>');
    } else {
      let ts = pref.faz ? (S.talPorFaz.get(String(pref.faz)) || []) : S.data.talhoes;
      ts = ts.filter(t => !q || norm(t.nome + ' ' + (faz(t.fazenda_id)?.nome || '')).includes(q)).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true })).slice(0, 300);
      ul.innerHTML = (pref.faz ? `<li class="cp-pgrp">${esc(fazAtual()?.nome || '')}</li>` : '<li class="cp-pgrp">Escolha uma fazenda para ver só os talhões dela</li>') +
        (ts.map(t => { const c = I().culturaAtual(t); return `<li><button data-cp="pick-tal" data-id="${esc(t.id)}" ${String(t.id) === String(selTal) ? 'aria-current="true"' : ''}><b>${esc(t.nome)}</b><small>${I().fmtHa(t.area_ha)} ha${c ? ' · ' + esc(c.cultura || '') + (c.variedade ? ' ' + esc(c.variedade) : '') : ''}${pref.faz ? '' : ' · ' + esc(faz(t.fazenda_id)?.nome || '')}</small></button></li>`; }).join('') || '<li class="cp-vazio">Nenhum talhão encontrado.</li>');
    }
  }
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function camadas() {
    sheet(`<header class="cp-sh-h"><h2>Camadas</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="cp-bases">${[['sat', 'Satélite'], ['hib', 'Satélite + nomes'], ['ruas', 'Mapa']].map(([k, l]) => `<button data-cp="base" data-b="${k}" aria-pressed="${pref.base === k}"><i class="cp-bthumb cp-b-${k}"></i>${l}</button>`).join('')}</div>
      <div class="cp-tg">${[['nomes', 'Nomes dos talhões'], ['pontos', 'Pontos das visitas'], ['pluv', 'Pluviômetros']].map(([k, l]) => `<label><span>${l}</span><input type="checkbox" role="switch" data-cp="tg" data-k="${k}" ${pref[k] ? 'checked' : ''}></label>`).join('')}</div>
      <h3 class="cp-h3 cp-h3s">Mapa de calor da cana</h3>
      <div class="cp-fs">
        <label class="cp-f cp-full"><span>Mostrar no mapa</span><select data-cp-calor="praga"><option value="">Desligado</option><option value="todas" ${pref.calor === 'todas' ? 'selected' : ''}>Semáforo das visitas (todas as pragas)</option>${CN() ? CN().GRUPOS.map(g => `<optgroup label="${g}">${CN().itens.filter(x => x.g === g).map(x => `<option value="${x.id}" ${pref.calor === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</optgroup>`).join('') : ''}</select></label>
        <label class="cp-f cp-full"><span>Período</span><select data-cp-calor="dias">${[30, 60, 90, 180, 365].map(d => `<option value="${d}" ${pref.calorDias === d ? 'selected' : ''}>Últimos ${d} dias</option>`).join('')}</select></label>
      </div>
      <p class="cp-mut">Cada talhão fica com a cor da visita mais recente do período. As bolinhas mostram cada amostra no ponto do GPS.</p>
      <button class="cp-btn" data-cp="baixar-mapa">${ic('download')}Salvar o mapa desta área para usar sem internet</button>`, 'alto');
  }

  // ---------- Telas (pilha) ----------
  const telas = [];
  function tela(html, opts = {}) {
    const el = document.createElement('section'); el.className = 'cp-tela ' + (opts.cls || ''); el.innerHTML = html;
    $('#cp-screens').appendChild(el); telas.push({ el, opts });
    root.classList.add('cp-tela-on');
    return el;
  }
  function voltarTela() {
    const t = telas.pop(); if (!t) return;
    if (t.opts.aoFechar) t.opts.aoFechar();
    t.el.remove();
    if (!telas.length) { root.classList.remove('cp-tela-on'); if (pane === 'inicio') { desenharCard(); setTimeout(() => map.invalidateSize(), 30); } if (pane === 'historico') historico(); }
  }
  function fecharTelas() { while (telas.length) voltarTela(); }

  function atividades(t) {
    const el = tela(`<header class="cp-bar"><button class="cp-ib" data-cp="voltar" aria-label="Voltar">${ic('voltar')}</button><h1>Atividades</h1><span></span></header>
      <div class="cp-ctx">${t ? `<b>${esc(t.nome)}</b> · ${esc(faz(t.fazenda_id)?.nome || '')}` : 'Escolha a atividade. Depois você escolhe o talhão.'}</div>
      <div class="cp-ativ">${ATIV.map(([g, l], gi) => `<details open><summary>${esc(g)}${ic('seta')}</summary><div class="cp-grid">${l.map(([n, i], ai) => `<button data-cp="ativ" data-g="${gi}" data-a="${ai}"><i>${ic(i)}</i><span>${esc(n)}</span></button>`).join('')}</div></details>`).join('')}</div>`);
    el._tal = t ? t.id : null;
  }
  function comTalhao(cb, titulo) {
    const t = selTal ? tal(selTal) : null;
    if (t) return cb(t);
    picker(tt => { fecharSheet(); cb(tt); }, titulo || 'Escolha o talhão');
  }
  const exigeEditar = () => { if (!I().podeEditar()) { I().toast('Seu acesso é só de consulta.'); return false; } return true; };
  function ordem(t, tipo) {
    I().openForm('ordens', null, { tipo, titulo: tipo + ' · ' + t.nome, status: 'Planejada', fazenda_id: t.fazenda_id, talhao_ids: [t.id], data_prevista: I().today(), responsavel: email(), criado_por: email(), criado_em: new Date().toISOString() });
  }
  function avanco(t, tipo) {
    const c = I().culturaAtual(t);
    I().openForm('avancos', null, { tipo, data: I().today(), talhao_id: t.id, safra: c ? c.safra : '', criado_por: email(), criado_em: new Date().toISOString() });
  }
  function controle(t, tipo) { I().openForm('controles', null, { tipo, data: I().today(), talhao_id: t.id, responsavel: email(), criado_por: email(), criado_em: new Date().toISOString() }); }
  function chuva(p) {
    if (!exigeEditar()) return;
    const S = I().S, pl = S.data.pluviometros || [];
    if (!p) {
      const ref = gps.pos ? L.latLng(gps.pos.lat, gps.pos.lng) : (selTal && centroTal(tal(selTal))) || (fazAtual() && centroFaz(fazAtual()));
      const cand = pl.filter(x => !pref.faz || !x.fazenda_id || String(x.fazenda_id) === String(pref.faz));
      if (ref) cand.sort((a, b) => dist(ref, a) - dist(ref, b));
      p = cand[0] || pl[0];
    }
    if (!p) {
      if (confirm('Nenhum pluviômetro cadastrado. Cadastrar um aqui, na sua localização?')) I().openForm('pluviometros', null, { fazenda_id: pref.faz || '', lat: gps.pos ? +gps.pos.lat.toFixed(6) : null, lng: gps.pos ? +gps.pos.lng.toFixed(6) : null });
      return;
    }
    I().openForm('chuvas', null, { data: I().today(), pluviometro_id: p.id, criado_por: email(), criado_em: new Date().toISOString() });
  }
  const dist = (ll, p) => p.lat == null ? 1e12 : ll.distanceTo([p.lat, p.lng]);

  // ---------- Liberação de Cotesia ----------
  function cotesiaNova(t) {
    I().openForm('controles', null, { tipo: I().COT, data: I().today(), talhao_id: t.id, area_ha: t.area_ha != null ? +(+t.area_ha).toFixed(2) : undefined, responsavel: email(), criado_por: email(), criado_em: new Date().toISOString() });
  }
  function cotesiaLista() {
    fecharSheet(); fecharMenu();
    const C = CN(), f0 = v => v == null ? '—' : I().fmtInt(Math.round(v));
    const rels = I().S.data.controles.filter(c => c.tipo === I().COT && (!pref.faz || String((tal(c.talhao_id) || {}).fazenda_id) === String(pref.faz)))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    tela(`<header class="cp-bar"><button class="cp-ib" data-cp="voltar" aria-label="Voltar">${ic('voltar')}</button><h1>Cotesia</h1><span></span></header>
      <div class="cp-ctx">${pref.faz ? `<b>${esc(fazAtual()?.nome || '')}</b> · ` : ''}Broca ≥ 1,5 cm (lagartas/ha) no levantamento antes e depois de cada liberação.</div>
      <div class="cp-lst">${rels.map(r => {
        const t = tal(r.talhao_id), e = C ? C.eficiencia(r, I().S.data.monitoramentos) : {}, vh = C ? C.vespasHa(r) : null;
        const cl = e.red == null ? '' : e.red > 0 ? 'c0' : e.red < 0 ? 'c2' : 'c1';
        return `<button class="cp-cot" data-cp="abrir-reg" data-k="controles" data-id="${esc(r.id)}"><span><b>${esc(t ? t.nome : 'Talhão')}</b><small>${esc(I().fmtDate(r.data))} · ${I().fmtHa(r.area_ha)} ha · ${r.copos == null ? '—' : I().fmtInt(r.copos)} copos${vh ? ' · ' + f0(vh) + ' vespas/ha' : ''}</small>
          <small>Antes: <b>${e.antes ? f0(e.antes.valor) : '—'}</b> · Depois: <b>${e.depois ? f0(e.depois.valor) : '—'}</b></small></span>
          ${e.red == null ? '<em class="cp-cl">Sem levantamento</em>' : `<em class="cp-cl ${cl}">${e.red > 0 ? 'Caiu' : e.red < 0 ? 'Subiu' : 'Igual'} ${I().fmtInt(Math.abs(Math.round(e.red)))}%</em>`}</button>`;
      }).join('') || '<p class="cp-mut cp-pad">Nenhuma liberação registrada. Use Atividade, "Liberação de Cotesia".</p>'}</div>
      ${I().podeEditar() ? `<button class="cp-btn pri cp-concluir" data-cp="cot-nova">${ic('mais')}Nova liberação</button>` : ''}`, { cls: 'cp-cotl' });
  }

  // ---------- Rota de visitas do dia ----------
  let rotaAtual = null;
  const diasDesde = d => Math.floor((Date.now() - new Date(String(d).slice(0, 10) + 'T12:00:00').getTime()) / 864e5);
  function rotaCalcular() {
    const S = I().S, dias = pref.rotaDias || 15, hoje = I().today();
    const ts = (pref.faz ? (S.talPorFaz.get(String(pref.faz)) || []) : S.data.talhoes).filter(t => t.geometry);
    const cand = [];
    for (const t of ts) {
      const v = ultimaVisita(t), c = centroTal(t); if (!c) continue;
      let m = null;
      if (v && v.data === hoje) continue; // já visitado hoje
      if (v && v.semaforo === 'Vermelho') m = { p: 0, txt: 'Vermelho', cl: 'c2' };
      else if (v && v.semaforo === 'Amarelo') m = { p: 1, txt: 'Amarelo', cl: 'c1' };
      else if (v && v.data && diasDesde(v.data) > dias) m = { p: 2, txt: `Sem visita há ${diasDesde(v.data)} dias`, cl: '' };
      else if (!v && pref.rotaNunca) m = { p: 3, txt: 'Nunca visitado', cl: '' };
      if (m) cand.push({ t, c, v, m });
    }
    // urgentes primeiro; dentro de cada grupo, sempre o talhão mais perto do anterior
    let pos = gps.pos ? L.latLng(gps.pos.lat, gps.pos.lng) : (fazAtual() && centroFaz(fazAtual())) || (cand[0] && cand[0].c);
    const ini = pos, out = [];
    for (const p of [0, 1, 2, 3]) {
      const g = cand.filter(x => x.m.p === p);
      while (g.length && out.length < 25) {
        let bi = 0; for (let i = 1; i < g.length; i++) if (pos.distanceTo(g[i].c) < pos.distanceTo(g[bi].c)) bi = i;
        const [x] = g.splice(bi, 1); x.km = pos.distanceTo(x.c) / 1000; out.push(x); pos = x.c;
      }
    }
    return { ini, paradas: out, total: cand.length, gps: !!gps.pos };
  }
  function rota() {
    fecharSheet(); fecharMenu(); ligarGps(false);
    const R = rotaAtual = rotaCalcular(), km = R.paradas.reduce((a, x) => a + x.km, 0);
    const el = tela(`<header class="cp-bar"><button class="cp-ib" data-cp="voltar" aria-label="Voltar">${ic('voltar')}</button><h1>Rota do dia</h1><span></span></header>
      <div class="cp-ctx">${pref.faz ? `<b>${esc(fazAtual()?.nome || '')}</b>` : '<b>Todas as fazendas</b> · escolha uma fazenda no mapa para uma rota menor'}<br>Talhões em vermelho primeiro, depois amarelo e depois os sem visita recente, sempre indo para o mais perto.</div>
      <div class="cp-rf">
        <label class="cp-f"><span>Sem visita há mais de</span><select data-cp-rota="dias">${[7, 15, 30, 60].map(d => `<option value="${d}" ${pref.rotaDias === d ? 'selected' : ''}>${d} dias</option>`).join('')}</select></label>
        <label class="cp-rtg"><input type="checkbox" data-cp-rota="nunca" ${pref.rotaNunca ? 'checked' : ''}><span>Incluir talhões nunca visitados</span></label>
      </div>
      <div class="cp-rsum"><b>${R.paradas.length} ${R.paradas.length === 1 ? 'parada' : 'paradas'}</b><span>cerca de ${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km em linha reta${R.gps ? ' a partir de você' : ''}${R.total > R.paradas.length ? ` · mostrando 25 de ${R.total}` : ''}</span></div>
      ${R.paradas.length ? `<div class="cp-racts"><button class="cp-btn" data-cp="rota-mapa">${ic('camadas')}Ver no mapa</button><button class="cp-btn pri" data-cp="rota-gmaps">${ic('navegar')}Abrir no Google Maps</button></div>` : ''}
      <ol class="cp-rl">${R.paradas.map((x, i) => `<li><i class="cp-rn ${x.m.cl}">${i + 1}</i><span><b>${esc(x.t.nome)}</b><small>${esc(faz(x.t.fazenda_id)?.nome || '')} · ${I().fmtHa(x.t.area_ha)} ha · ${x.km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</small><em class="cp-cl ${x.m.cl}">${esc(x.m.txt)}</em>${x.v ? `<small>Última visita: ${esc(I().fmtDate(x.v.data))}${x.v.alvo ? ' · ' + esc(x.v.alvo) : ''}</small>` : ''}</span>
        <span class="cp-rb"><button class="cp-ib" data-cp="rota-ir" data-id="${esc(x.t.id)}" aria-label="Navegar até ${esc(x.t.nome)}">${ic('navegar')}</button><button class="cp-ib" data-cp="rota-visita" data-id="${esc(x.t.id)}" aria-label="Nova visita em ${esc(x.t.nome)}">${ic('lupa')}</button></span></li>`).join('')}</ol>
      ${R.paradas.length ? '' : '<p class="cp-mut cp-pad">Nenhum talhão precisa de visita com esses filtros. Aumente o prazo ou inclua os talhões nunca visitados.</p>'}`, { cls: 'cp-rota' });
    return el;
  }
  function rotaMapa() {
    const R = rotaAtual; if (!R) return;
    fecharTelas(); lyRota.clearLayers();
    const pts = [R.ini, ...R.paradas.map(x => x.c)].filter(Boolean);
    L.polyline(pts, { color: '#ffffff', weight: 3, dashArray: '6 8', opacity: 0.9, interactive: false }).addTo(lyRota);
    R.paradas.forEach((x, i) => L.marker(x.c, { icon: L.divIcon({ className: 'cp-rmk ' + x.m.cl, html: `<span>${i + 1}</span>`, iconSize: [28, 28] }) }).on('click', () => selecionar(x.t, false)).addTo(lyRota));
    rotulos();
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 16 });
    let bar = $('#cp-rbar'); if (!bar) { bar = document.createElement('div'); bar.id = 'cp-rbar'; bar.className = 'cp-rbar'; $('#cp-map').after(bar); }
    bar.hidden = false;
    bar.innerHTML = `<span>${ic('rota')}<b>Rota</b> · ${R.paradas.length} ${R.paradas.length === 1 ? 'parada' : 'paradas'}</span><button class="cp-lnk" data-cp="rota">Lista</button><button class="cp-ib" data-cp="rota-limpar" aria-label="Tirar a rota do mapa">${ic('fechar')}</button>`;
  }
  function rotaGmaps() {
    const R = rotaAtual; if (!R || !R.paradas.length) return;
    const f = c => c.lat.toFixed(6) + ',' + c.lng.toFixed(6), p = R.paradas.slice(0, 10);
    const dest = p[p.length - 1], way = p.slice(0, -1);
    let u = `https://www.google.com/maps/dir/?api=1&destination=${f(dest.c)}&travelmode=driving`;
    if (R.gps && R.ini) u += `&origin=${f(R.ini)}`;
    if (way.length) u += `&waypoints=${encodeURIComponent(way.map(x => f(x.c)).join('|'))}`;
    if (R.paradas.length > 10) I().toast('O Google Maps aceita até 10 paradas. Abrindo as 10 primeiras.');
    window.open(u, '_blank', 'noopener');
  }

  // ---------- Levantamento da cana: médias, níveis e semáforo ----------
  const CN = () => window.CANA;
  const COR_CL = ['#22c55e', '#f59e0b', '#ef4444'];
  const ROT_CL = ['Abaixo do nível', 'Atenção', 'Nível de controle'];
  const ajustes = () => ((I().get('config', 'niveis_cana') || {}).itens) || {};
  const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const fmtN = v => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmtV = (it, v) => it && it.lt === 'pres' ? (v > 0 ? 'Sim' : 'Não') : fmtN(v);
  const chipCl = cl => cl == null ? '<em class="cp-cl">Sem nível definido</em>' : `<em class="cp-cl c${cl}">${ROT_CL[cl]}</em>`;
  function textoNiveis(it, aj) {
    const n = CN().niveis(it, aj || ajustes());
    if (it.lt === 'pres') return 'Presença confirmada = nível de controle';
    if (n.am == null && n.vm == null) return 'Sem nível de controle definido';
    return [n.am != null ? `atenção a partir de ${fmtN(n.am)}` : '', n.vm != null ? `controle a partir de ${fmtN(n.vm)}` : ''].filter(Boolean).join(' · ');
  }
  // médias da visita: por item do catálogo (ou por alvo + medida quando digitado)
  function medias(m) {
    const g = new Map();
    for (const a of m.amostras_detalhe || []) {
      const v = num(a.valor); if (v == null) continue;
      const it = CN() ? CN().daAmostra(a) : null;
      const k = it ? it.id : (a.alvo || '—') + '|' + (a.medida || '');
      if (!g.has(k)) g.set(k, { item: it, alvo: it ? it.nome : (a.alvo || '—'), medida: it ? it.un : (a.medida || ''), vals: [] });
      g.get(k).vals.push(v);
    }
    const aj = ajustes();
    return [...g.values()].map(x => {
      x.media = x.item && x.item.lt === 'pres' ? Math.max(...x.vals) : x.vals.reduce((s, y) => s + y, 0) / x.vals.length;
      x.cl = x.item ? CN().classe(x.item, x.media, aj) : null;
      return x;
    });
  }
  function pior(m) { let p = null; for (const x of medias(m)) if (x.cl != null && (!p || x.cl > p.cl)) p = x; return p; }
  // semáforo automático: a pior média em relação ao nível de controle (a não ser que o usuário tenha escolhido)
  function semAuto(m) {
    if (m.semaforo_manual || !CN()) return;
    const p = pior(m); if (!p) return;
    m.semaforo = CN().SEMAF[p.cl]; m.nivel = CN().NIVEL[p.cl]; m.alvo = p.item.nome; m.praga_id = p.item.id; m.tipo = CN().TIPO_MON[p.item.g];
  }

  // ---------- Visita ----------
  let V = null; // visita aberta: { m, salva, el, map, ly }
  function novaVisita(t) {
    if (!exigeEditar()) return;
    const c = I().culturaAtual(t);
    const m = { id: I().newId(), data: I().today(), hora: agoraISO().slice(11, 16), talhao_id: t.id, tipo: 'Outro', responsavel: email(), safra: c ? c.safra : undefined, pontos: [], amostras_detalhe: [], criado_por: email(), criado_em: new Date().toISOString() };
    abrirVisita(m, true);
  }
  function abrirVisita(m, nova) {
    fecharSheet();
    m = JSON.parse(JSON.stringify(m));
    m.pontos = m.pontos || []; m.amostras_detalhe = m.amostras_detalhe || [];
    const t = tal(m.talhao_id);
    const el = tela(`<header class="cp-bar"><button class="cp-ib" data-cp="voltar" aria-label="Voltar">${ic('voltar')}</button><h1>Visita</h1><button class="cp-ib" data-cp="v-mais" aria-label="Mais opções">${ic('editar')}</button></header>
      <div class="cp-vmap"><div id="cp-vmap"></div><div class="cp-tools cp-vtools"><button class="cp-round" data-cp="v-gps" aria-label="Minha localização">${ic('gps')}</button><button class="cp-round" data-cp="v-ir" aria-label="Navegar até o talhão">${ic('navegar')}</button><button class="cp-round" data-cp="v-exp" aria-label="Aumentar o mapa">${ic('expandir')}</button></div></div>
      <div class="cp-vbody">
        <div class="cp-vhead"><div><b>${esc(t ? t.nome : 'Talhão')}</b><span>${esc(faz(t?.fazenda_id)?.nome || '')}</span><small>${esc(fmtDH(m.data + (m.hora ? 'T' + m.hora : '')))}</small></div><button class="cp-btn pri" data-cp="v-amostra">${ic('mais')}Amostras</button></div>
        <div class="cp-gpsinfo" id="cp-vgps">Procurando GPS…</div>
        <h3 class="cp-h3">Adicionar pontos georreferenciados</h3>
        <div class="cp-wps">${[['foto', 'Foto'], ['anexo', 'Anexo'], ['video', 'Vídeo'], ['audio', 'Áudio'], ['nota', 'Anotação']].map(([k, l]) => `<button data-cp="wp" data-t="${k}"><i>${ic(k)}</i><span>${l}</span></button>`).join('')}</div>
        <div class="cp-box" id="cp-vam"></div>
        <div class="cp-box" id="cp-vmed"></div>
        <div class="cp-box" id="cp-vpts"></div>
        <div class="cp-box" id="cp-vdet"></div>
        <button class="cp-btn pri cp-concluir" data-cp="v-concluir">Concluir visita</button>
      </div>`, { cls: 'cp-visita', aoFechar: () => { if (V && V.map) V.map.remove(); V = null; } });
    V = { m, salva: !nova, el, map: null, ly: null };
    setTimeout(() => {
      const vm = L.map('cp-vmap', { zoomControl: false, attributionControl: false, preferCanvas: true });
      L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(vm);
      V.map = vm; V.ly = L.layerGroup().addTo(vm);
      if (t && t.geometry) { const g = L.geoJSON(t.geometry, { style: { color: '#fff', weight: 3, fillOpacity: 0.05, fillColor: '#fff' }, interactive: false }).addTo(vm); vm.fitBounds(g.getBounds(), { padding: [24, 24], maxZoom: 17 }); }
      else vm.setView(gps.pos ? [gps.pos.lat, gps.pos.lng] : [-15.8, -47.9], gps.pos ? 16 : 4);
      vPontosMapa(); ligarGps(false);
    }, 30);
    vRender();
  }
  function vSalvar(msg) {
    if (!V) return;
    const m = V.m; m.atualizado_por_app = 'campo';
    m.pontos_gps = m.pontos.filter(p => p.lat != null).length;
    m.fotos = m.pontos.filter(p => p.tipo === 'foto' || p.foto).length;
    const r = I().Store.save('monitoramentos', JSON.parse(JSON.stringify(m)));
    V.salva = true;
    if (msg) I().toast(msg);
    return r;
  }
  function vRender() {
    if (!V) return;
    const m = V.m;
    const am = m.amostras_detalhe;
    $('#cp-vam').innerHTML = `<div class="cp-row"><b>Amostras registradas</b><span class="cp-num">${am.length}</span></div>
      ${am.length ? `<details><summary>Lista de amostras ${ic('seta')}</summary><ul class="cp-mini">${am.map((a, i) => `<li><span><b>#${esc(a.amostra || i + 1)}</b> ${esc(a.alvo || '')} · ${esc(a.medida || '')}: <b>${esc(a.valor == null ? '—' : fmtV(CN() && CN().daAmostra(a), num(a.valor)))}</b>${a.nivel ? ` <em class="cp-niv ${a.nivel}">${esc(a.nivel)}</em>` : ''}${a.obs ? `<br><small>${esc(a.obs)}</small>` : ''}</span><button class="cp-ib" data-cp="v-del-am" data-i="${i}" aria-label="Apagar amostra">${ic('lixo')}</button></li>`).join('')}</ul></details>` : ''}`;
    // Médias da visita, comparadas com os níveis de controle da cana
    const md = medias(m);
    $('#cp-vmed').innerHTML = `<div class="cp-row"><b>Médias da visita</b></div>${md.length ? `<ul class="cp-meds">${md.map(x => `<li class="c${x.cl ?? 'n'}"><span><b>${esc(x.alvo)}</b><small>${esc(x.medida)} · ${x.vals.length} amostra${x.vals.length > 1 ? 's' : ''}${x.item ? ' · ' + esc(textoNiveis(x.item)) : ''}</small></span><span class="cp-medv"><b>${esc(fmtV(x.item, x.media))}</b>${chipCl(x.cl)}</span></li>`).join('')}</ul>` : '<p class="cp-mut">Registre amostras com valor para ver as médias.</p>'}`;
    $('#cp-vpts').innerHTML = `<div class="cp-row"><b>Pontos da visita</b><span class="cp-num">${m.pontos.length}</span></div>${m.pontos.length ? `<ul class="cp-pts">${m.pontos.map((p, i) => `<li>${miniatura(p)}<span><b>${i + 1}. ${esc(ROT[p.tipo] || 'Ponto')}</b>${p.obs ? ' · ' + esc(p.obs) : ''}<small>${esc(fmtDH(p.data))}${p.lat != null ? ` · ${(+p.lat).toFixed(5)}, ${(+p.lng).toFixed(5)}` : ' · sem GPS'}${p.midia_id && !p.foto && !(p.midia && p.midia.url) ? ' · <em class="cp-pend">arquivo a enviar</em>' : ''}</small></span><button class="cp-ib" data-cp="v-del-pt" data-i="${i}" aria-label="Apagar ponto">${ic('lixo')}</button></li>`).join('')}</ul>` : '<p class="cp-mut">Use os botões acima para marcar fotos, áudios, vídeos, anexos e anotações no local onde você está.</p>'}`;
    $$('img[data-mid]', $('#cp-vpts')).forEach(async img => { const u = await urlLocal(img.dataset.mid); if (u) img.src = u; });
    const sel = (k, l, opts) => { if (m[k] && !opts.includes(m[k])) opts = [m[k], ...opts]; return `<label class="cp-f"><span>${l}</span><select data-cp-f="${k}"><option value=""></option>${opts.map(o => `<option ${m[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`; };
    const p = pior(m);
    $('#cp-vdet').innerHTML = `<div class="cp-row"><b>Resultado da visita</b></div>
      <div class="cp-sem" role="radiogroup" aria-label="Semáforo da visita">${['Verde', 'Amarelo', 'Vermelho'].map(s => `<button data-cp="v-sem" data-s="${s}" aria-pressed="${m.semaforo === s}"><i style="background:${SEM[s]}"></i>${s}</button>`).join('')}</div>
      <p class="cp-semnota">${m.semaforo_manual ? `Semáforo escolhido por você. <button class="cp-lnk" data-cp="v-sem-auto">Usar o automático</button>` : p ? `Automático: <b>${esc(p.item.nome)}</b> está em ${ROT_CL[p.cl].toLowerCase()}. Toque numa cor para mudar.` : 'O semáforo fica automático quando você registra amostras de pragas, doenças ou daninhas da cana.'}</p>
      <div class="cp-fs">
        ${sel('estadio', 'Estádio da cana', CN() ? CN().ESTADIOS.slice() : [])}
        ${sel('corte', 'Corte / ciclo', CN() ? CN().CORTES.slice() : [])}
        ${sel('tipo', 'Tipo', ['Praga', 'Doença', 'Planta daninha', 'Estádio fenológico', 'Falha de estande', 'Outro'])}
        <label class="cp-f"><span>Principal problema</span><input data-cp-f="alvo" value="${esc(m.alvo || '')}" list="cp-alvos"></label>
        ${sel('estado_talhao', 'Condição do talhão', ['Excelente', 'Muito bom', 'Bom', 'Regular', 'Ruim'])}
        ${sel('estado_hidrico', 'Estado hídrico', ['Muito seco', 'Seco', 'Adequado', 'Úmido', 'Muito úmido'])}
        <label class="cp-f cp-full"><span>Observações</span><textarea rows="3" data-cp-f="obs">${esc(m.obs || '')}</textarea></label>
      </div>${datalistAlvos()}`;
    vPontosMapa();
  }
  const ROT = { foto: 'Foto', anexo: 'Anexo', video: 'Vídeo', audio: 'Áudio', nota: 'Anotação' };
  function miniatura(p) {
    if (p.foto) return `<a class="cp-th" href="${esc(p.foto)}" target="_blank" rel="noopener"><img src="${esc(p.foto)}" alt="" loading="lazy"></a>`;
    if (p.tipo === 'foto' && p.midia_id) return `<span class="cp-th"><img data-mid="${esc(p.midia_id)}" alt=""></span>`;
    if (p.midia && p.midia.url) return `<a class="cp-th cp-thi" href="${esc(p.midia.url)}" target="_blank" rel="noopener">${ic(p.tipo || 'anexo')}</a>`;
    return `<span class="cp-th cp-thi">${ic(p.tipo || 'nota')}</span>`;
  }
  async function urlLocal(id) {
    if (urlMidia.has(id)) return urlMidia.get(id);
    const it = await I().Off.lerMidia(id); if (!it || !it.blob) return null;
    const u = URL.createObjectURL(it.blob); urlMidia.set(id, u); return u;
  }
  function datalistAlvos() {
    const s = new Set();
    for (const m of I().S.data.monitoramentos) { if (m.alvo) s.add(m.alvo); for (const a of m.amostras_detalhe || []) if (a.alvo) s.add(a.alvo); }
    return `<datalist id="cp-alvos">${[...s].sort().slice(0, 300).map(a => `<option value="${esc(a)}">`).join('')}</datalist>`;
  }
  function vPontosMapa() {
    if (!V || !V.ly) return;
    V.ly.clearLayers();
    V.m.pontos.forEach((p, i) => { if (p.lat != null) L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'cp-wpm', html: `<span>${i + 1}</span>`, iconSize: [24, 24] }) }).addTo(V.ly); });
    (V.m.amostras_detalhe || []).forEach(a => { if (a.lat != null) L.circleMarker([a.lat, a.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: LIMA, fillOpacity: 1 }).addTo(V.ly); });
    if (gps.pos) L.circleMarker([gps.pos.lat, gps.pos.lng], { radius: 7, color: '#fff', weight: 2, fillColor: AZUL, fillOpacity: 1 }).addTo(V.ly);
  }
  function vGpsInfo() {
    const el = $('#cp-vgps'); if (!el) return;
    if (!gps.pos) { el.textContent = 'Procurando GPS…'; el.dataset.ok = ''; return; }
    const t = V && tal(V.m.talhao_id), dentroT = t && dentro(L.latLng(gps.pos.lat, gps.pos.lng), t);
    el.dataset.ok = dentroT ? '1' : '0';
    el.textContent = `GPS ${gps.pos.lat.toFixed(5)}, ${gps.pos.lng.toFixed(5)} · precisão ${Math.round(gps.pos.acc)} m${t ? dentroT ? ' · dentro do talhão' : ' · fora do talhão' : ''}`;
  }
  // Amostra guiada: 1) escolher a praga, doença ou daninha da cana; 2) anotar o valor no padrão do protocolo
  function amostraForm() {
    if (!exigeEditar()) return;
    if (!CN()) return amostraLivre();
    const m = V.m, n = m.amostras_detalhe.length + 1;
    const usados = [...new Set([...m.amostras_detalhe.slice().reverse().map(a => (CN().daAmostra(a) || {}).id), ...(pref.recentes || [])].filter(Boolean))].slice(0, 6).map(CN().get).filter(Boolean);
    sheet(`<header class="cp-sh-h"><h2>Amostra ${n}: o que vai avaliar?</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <input type="search" class="cp-busca" id="cp-cq" placeholder="Buscar praga, doença ou planta daninha" aria-label="Buscar">
      <div id="cp-clist" class="cp-cat"></div>`, 'alto');
    const lista = () => {
      const q = norm($('#cp-cq').value);
      const b = it => `<button data-cp="am-item" data-id="${it.id}"><b>${esc(it.nome)}</b><small><i>${esc(it.sci)}</i> · ${esc(it.un)}</small></button>`;
      let h = '';
      if (!q && usados.length) h += `<h4>Usados por último</h4><div class="cp-catl">${usados.map(b).join('')}</div>`;
      for (const g of CN().GRUPOS) {
        const l = CN().itens.filter(it => it.g === g && (!q || norm(it.nome + ' ' + it.sci + ' ' + (it.apel || '')).includes(q)));
        if (l.length) h += `<h4>${g}</h4><div class="cp-catl">${l.map(b).join('')}</div>`;
      }
      $('#cp-clist').innerHTML = (h || '<p class="cp-mut">Nada encontrado com esse nome.</p>') + `<button class="cp-btn cp-outro" data-cp="am-livre">Outro alvo (digitar o nome)</button>`;
    };
    $('#cp-cq').addEventListener('input', lista); lista();
  }
  function amostraItem(id) {
    const it = CN().get(id); if (!it || !V) return;
    const m = V.m, n = m.amostras_detalhe.length + 1, aj = ajustes();
    const baseIni = it.base ? ((pref.bases || {})[it.id] || it.base) : 0;
    const campo = it.base
      ? `<div class="cp-prop"><label class="cp-f"><span>${esc(it.baseNome)}</span><input name="base" type="number" min="1" step="1" inputmode="numeric" value="${baseIni}" required></label>
          <div class="cp-f"><span>${esc(it.posNome)}</span><div class="cp-cnt"><button type="button" class="cp-round" data-d="-1" aria-label="Menos">−</button><input name="pos" type="number" min="0" step="1" inputmode="numeric" value="0" aria-label="${esc(it.posNome)}"><button type="button" class="cp-round" data-d="1" aria-label="Mais">+</button></div></div>
          <div class="cp-propr"><span>Infestação</span><b id="cp-ppct">0%</b></div></div>`
      : it.lt === 'pres'
      ? `<div class="cp-sem cp-sem2">${[['0', 'Não'], ['1', 'Sim']].map(([v, l]) => `<label><input type="radio" name="valor" value="${v}" required><b>${l}</b></label>`).join('')}</div>`
      : it.lt === 'cont'
        ? `<div class="cp-cnt"><button type="button" class="cp-round" data-d="-${it.passo || 1}" aria-label="Menos">−</button><input name="valor" type="number" min="0" step="any" inputmode="decimal" value="0" aria-label="Valor"><button type="button" class="cp-round" data-d="${it.passo || 1}" aria-label="Mais">+</button></div>${it.passo ? `<small class="cp-mut">Os botões mudam de ${it.passo} em ${it.passo}. Você também pode digitar o número.</small>` : ''}`
        : `<div class="cp-pct"><input name="valor" type="number" min="0" max="100" step="any" inputmode="decimal" required placeholder="0" aria-label="Valor em %"><b>%</b></div><input type="range" min="0" max="${Math.max(20, (CN().niveis(it, aj).vm || 10) * 3)}" step="0.5" value="0" class="cp-rng" aria-label="Arrastar valor">`;
    sheet(`<header class="cp-sh-h"><button class="cp-ib" data-cp="v-amostra" aria-label="Trocar">${ic('voltar')}</button><h2>Amostra ${n}</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="cp-cath"><b>${esc(it.nome)}</b><small><i>${esc(it.sci)}</i> · ${esc(it.g.replace(/s$/, '').replace('Plantas daninha', 'Planta daninha'))}</small></div>
      <details class="cp-prot"><summary>Como amostrar ${ic('seta')}</summary><p>${esc(it.prot)}</p></details>
      <form class="cp-fs" id="cp-amf">
        <div class="cp-f cp-full"><span>${esc(it.un.charAt(0).toUpperCase() + it.un.slice(1))}</span>${campo}</div>
        <div class="cp-full cp-amcl" id="cp-amcl"></div>
        <p class="cp-mut cp-full cp-nivtxt">Níveis: ${esc(textoNiveis(it, aj))}${I().podeEditar() ? ' · <button type="button" class="cp-lnk" data-cp="niveis">ajustar</button>' : ''}</p>
        <label class="cp-f cp-full"><span>Observação</span><input name="obs"></label>
        <p class="cp-mut cp-full">${gps.pos ? 'A amostra fica marcada na sua posição atual.' : 'Sem GPS no momento: a amostra fica sem posição.'}</p>
        <div class="cp-full cp-acts"><button type="submit" class="cp-btn pri" data-mais="1">Salvar e próxima</button><button type="submit" class="cp-btn">Salvar</button></div>
      </form>`);
    const f = $('#cp-amf'), rng = $('.cp-rng', f), inp = () => f.querySelector(it.base ? 'input[name=pos]' : 'input[name=valor]:not([type=radio])');
    const prop = () => { const b = num(f.base.value), p = num(f.pos.value); return b > 0 && p != null ? { b, p, v: Math.round(p / b * 10000) / 100 } : null; };
    const valor = () => it.base ? (prop() || {}).v ?? null : it.lt === 'pres' ? num((f.querySelector('input[name=valor]:checked') || {}).value) : num(inp().value);
    const atual = () => { const v = valor(); if (it.base) $('#cp-ppct').textContent = v == null ? '—' : fmtN(v) + '%'; $('#cp-amcl').innerHTML = v == null ? '' : chipCl(CN().classe(it, v, aj)); };
    f.addEventListener('click', e => { const d = e.target.closest('[data-d]'); if (!d) return; const i = inp(); i.value = Math.max(0, (num(i.value) || 0) + Number(d.dataset.d)); atual(); });
    f.addEventListener('input', e => { if (e.target === rng) inp().value = rng.value; else if (rng && e.target === inp()) rng.value = inp().value || 0; atual(); });
    f.addEventListener('change', atual);
    atual();
    f.addEventListener('submit', e => {
      e.preventDefault();
      const v = valor(); if (v == null) { I().toast('Informe o valor.'); return; }
      const cl = CN().classe(it, v, aj);
      const a = { amostra: n, praga_id: it.id, alvo: it.nome, grupo: it.g, medida: it.un, valor: v, nivel: cl == null ? '' : CN().NIVEL[cl], obs: new FormData(f).get('obs').trim(), data: agoraISO() };
      if (gps.pos) { a.lat = +gps.pos.lat.toFixed(7); a.lng = +gps.pos.lng.toFixed(7); }
      if (it.base) { const x = prop(); a.avaliadas = x.b; a.positivas = x.p; pref.bases = { ...(pref.bases || {}), [it.id]: x.b }; }
      m.amostras_detalhe.push(a);
      pref.recentes = [it.id, ...(pref.recentes || []).filter(x => x !== it.id)].slice(0, 6); salvarPref();
      semAuto(m); vSalvar(); vRender(); fecharSheet();
      if (e.submitter && e.submitter.dataset.mais) amostraItem(it.id); else I().toast('Amostra registrada.');
    });
  }
  // Alvo digitado à mão (fora do catálogo da cana)
  function amostraLivre() {
    const m = V.m, n = m.amostras_detalhe.length + 1;
    const ult = m.amostras_detalhe[m.amostras_detalhe.length - 1] || {};
    sheet(`<header class="cp-sh-h"><h2>Amostra ${n}: outro alvo</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <form class="cp-fs" id="cp-amf">
        <label class="cp-f cp-full"><span>Praga / doença / alvo</span><input name="alvo" list="cp-alvos" value="${esc(ult.alvo || m.alvo || '')}" required></label>
        <label class="cp-f"><span>Medida</span><input name="medida" list="cp-medidas" value="${esc(ult.medida || '')}" placeholder="Ex.: Incidência (%)"></label>
        <label class="cp-f"><span>Valor</span><input name="valor" type="number" step="any" inputmode="decimal" autofocus></label>
        <div class="cp-f cp-full"><span>Nível</span><div class="cp-sem">${['Baixo', 'Médio', 'Alto'].map(s => `<label><input type="radio" name="nivel" value="${s}"><b>${s}</b></label>`).join('')}</div></div>
        <label class="cp-f cp-full"><span>Observação</span><input name="obs"></label>
        <p class="cp-mut cp-full">${gps.pos ? 'A amostra fica marcada na sua posição atual.' : 'Sem GPS no momento: a amostra fica sem posição.'}</p>
        <div class="cp-full cp-acts"><button type="submit" class="cp-btn pri" data-mais="1">Salvar e próxima</button><button type="submit" class="cp-btn">Salvar</button></div>
      </form><datalist id="cp-medidas">${['Incidência (%)', 'Severidade (%)', 'Nº por metro', 'Nº por planta', 'Nº por m²', 'Presença', 'Desfolha (%)', 'Plantas por metro'].map(x => `<option value="${x}">`).join('')}</datalist>${datalistAlvos()}`);
    $('#cp-amf').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, fd = new FormData(f);
      const a = { amostra: n, alvo: fd.get('alvo').trim(), medida: fd.get('medida').trim(), valor: fd.get('valor') === '' ? null : Number(fd.get('valor')), nivel: fd.get('nivel') || '', obs: fd.get('obs').trim(), data: agoraISO() };
      if (gps.pos) { a.lat = +gps.pos.lat.toFixed(7); a.lng = +gps.pos.lng.toFixed(7); }
      m.amostras_detalhe.push(a);
      if (!m.alvo && a.alvo) m.alvo = a.alvo;
      semAuto(m); vSalvar(); vRender(); fecharSheet();
      if (e.submitter && e.submitter.dataset.mais) amostraLivre(); else I().toast('Amostra registrada.');
    });
  }

  // ---------- Níveis de controle da cana (editáveis) ----------
  function niveisTela() {
    fecharSheet(); fecharMenu();
    const aj = ajustes(), ed = I().podeEditar();
    const el = tela(`<header class="cp-bar"><button class="cp-ib" data-cp="voltar" aria-label="Voltar">${ic('voltar')}</button><h1>Níveis de controle</h1><span></span></header>
      <div class="cp-ctx">Cana-de-açúcar. <b style="color:${COR_CL[1]}">Atenção</b> deixa o semáforo amarelo; <b style="color:${COR_CL[2]}">Controle</b> deixa vermelho. São valores de referência: ajuste com o seu agrônomo.</div>
      <form class="cp-niv-l" id="cp-nivf">${CN().GRUPOS.map(g => `<h3 class="cp-h3">${g}</h3><ul>${CN().itens.filter(x => x.g === g).map(it => { const n = CN().niveis(it, aj), mud = aj[it.id] ? ' cp-mud' : ''; return `<li class="${mud}"><span><b>${esc(it.nome)}</b><small>${esc(it.un)}</small></span>${it.lt === 'pres' ? '<em class="cp-mut">Presença = controle</em>' : `<label><small>Atenção</small><input type="number" step="any" min="0" inputmode="decimal" name="${it.id}.am" value="${n.am ?? ''}" ${ed ? '' : 'disabled'}></label><label><small>Controle</small><input type="number" step="any" min="0" inputmode="decimal" name="${it.id}.vm" value="${n.vm ?? ''}" ${ed ? '' : 'disabled'}></label>`}</li>`; }).join('')}</ul>`).join('')}
        ${ed ? `<div class="cp-acts cp-niv-a"><button type="button" class="cp-btn" data-cp="niv-padrao">Restaurar padrão</button><button type="submit" class="cp-btn pri">Salvar níveis</button></div>` : '<p class="cp-mut">Seu acesso é só de consulta.</p>'}
      </form>`, { cls: 'cp-niveis' });
    $('#cp-nivf', el).addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target), itens = {};
      for (const it of CN().itens) {
        if (it.lt === 'pres') continue;
        const am = num(fd.get(it.id + '.am')), vm = num(fd.get(it.id + '.vm'));
        if (am != null && vm != null && am > vm) { I().toast(`${it.nome}: o nível de atenção não pode ser maior que o de controle.`); return; }
        if (am !== it.am || vm !== it.vm) itens[it.id] = { am, vm };
      }
      await salvarNiveis(itens, 'Níveis salvos.');
    });
  }
  async function salvarNiveis(itens, msg) {
    const atual = I().get('config', 'niveis_cana') || {};
    try { await I().Store.save('config', Object.assign({}, atual, { id: 'niveis_cana', itens, atualizado_em: new Date().toISOString(), atualizado_por: email() })); I().toast(msg); voltarTela(); if (V) vRender(); calcCalor(); estilos(); } catch (e) { }
  }

  // ---------- Pontos com mídia ----------
  async function ponto(tipo) {
    if (!exigeEditar()) return;
    if (tipo === 'nota') return pontoSheet({ tipo });
    if (tipo === 'audio' && window.MediaRecorder && navigator.mediaDevices) return Rec.abrir();
    const inp = $('#cp-file');
    inp.value = ''; inp.removeAttribute('capture');
    inp.accept = tipo === 'foto' ? 'image/*' : tipo === 'video' ? 'video/*' : tipo === 'audio' ? 'audio/*' : '';
    if (tipo === 'foto' || tipo === 'video') inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      if (f.size > 50 * 1024 * 1024) { I().toast('Arquivo muito grande (máximo 50 MB).'); return; }
      let blob = f;
      if (tipo === 'foto') blob = await reduzirFoto(f).catch(() => f);
      pontoSheet({ tipo, blob, nome: f.name, mime: blob.type || f.type });
    };
    inp.click();
  }
  function pontoSheet(d) {
    const prev = d.blob && d.tipo === 'foto' ? `<img class="cp-prev" src="${URL.createObjectURL(d.blob)}" alt="">` : d.blob && d.tipo === 'video' ? `<video class="cp-prev" src="${URL.createObjectURL(d.blob)}" controls playsinline></video>` : d.blob && d.tipo === 'audio' ? `<audio src="${URL.createObjectURL(d.blob)}" controls></audio>` : d.blob ? `<p>${ic('anexo')} ${esc(d.nome || 'arquivo')}</p>` : '';
    sheet(`<header class="cp-sh-h"><h2>${esc(ROT[d.tipo])}</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      ${prev}<form class="cp-fs" id="cp-ptf"><label class="cp-f cp-full"><span>${d.tipo === 'nota' ? 'Anotação' : 'Observação (opcional)'}</span><textarea name="obs" rows="${d.tipo === 'nota' ? 4 : 2}" ${d.tipo === 'nota' ? 'required autofocus' : ''}></textarea></label>
      <p class="cp-mut cp-full">${gps.pos ? `Local: ${gps.pos.lat.toFixed(5)}, ${gps.pos.lng.toFixed(5)} (±${Math.round(gps.pos.acc)} m)` : 'Sem GPS no momento: o ponto fica sem posição.'}</p>
      <div class="cp-full cp-acts"><button class="cp-btn pri" type="submit">Salvar ponto</button></div></form>`);
    $('#cp-ptf').addEventListener('submit', async e => {
      e.preventDefault();
      const obs = new FormData(e.target).get('obs').trim();
      const p = { id: I().newId(), tipo: d.tipo, data: agoraISO(), obs };
      if (gps.pos) { p.lat = +gps.pos.lat.toFixed(7); p.lng = +gps.pos.lng.toFixed(7); p.precisao_m = Math.round(gps.pos.acc); }
      if (d.blob) {
        p.midia_id = 'm' + p.id; p.midia_nome = d.nome || '';
        try { await I().Off.guardarMidia(p.midia_id, d.blob, { tipo: d.tipo, mime: d.mime || d.blob.type || 'application/octet-stream', nome: d.nome || '', rec: V.m.id }); }
        catch (err) { I().toast('Não há espaço no celular para guardar o arquivo.'); return; }
        urlMidia.set(p.midia_id, URL.createObjectURL(d.blob));
      }
      V.m.pontos.push(p);
      await vSalvar(); vRender(); fecharSheet();
      I().toast('Ponto salvo.');
      Midia.contar(); Midia.enviar();
    });
  }
  function reduzirFoto(f) {
    return new Promise((ok, falha) => {
      const img = new Image(), u = URL.createObjectURL(f);
      img.onload = () => {
        const M = 1600, r = Math.min(1, M / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(b => b ? ok(b) : falha(), 'image/jpeg', 0.82);
      };
      img.onerror = falha; img.src = u;
    });
  }
  // Gravador de áudio
  const Rec = {
    on: false, mr: null, partes: [], t0: 0, timer: null,
    async abrir() {
      sheet(`<header class="cp-sh-h"><h2>Gravar áudio</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
        <div class="cp-rec"><b id="cp-rect">00:00</b><button class="cp-recb" data-cp="rec" aria-label="Parar gravação"><i></i></button><p class="cp-mut" id="cp-recm">Gravando… toque para parar.</p></div>`);
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.partes = []; this.mr = new MediaRecorder(st); this.on = true; this.t0 = Date.now();
        this.mr.ondataavailable = e => { if (e.data.size) this.partes.push(e.data); };
        this.mr.onstop = () => { st.getTracks().forEach(t => t.stop()); if (this.cancelado) return; const b = new Blob(this.partes, { type: this.mr.mimeType || 'audio/webm' }); pontoSheet({ tipo: 'audio', blob: b, nome: 'audio.' + (/mp4|aac/.test(b.type) ? 'm4a' : 'webm'), mime: b.type }); };
        this.cancelado = false; this.mr.start();
        this.timer = setInterval(() => { const s = Math.floor((Date.now() - this.t0) / 1000); const el = $('#cp-rect'); if (el) el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 500);
      } catch (e) { this.on = false; $('#cp-recm').textContent = 'Permita o uso do microfone nas configurações do celular.'; }
    },
    parar(cancelar) { clearInterval(this.timer); if (this.mr && this.on) { this.cancelado = !!cancelar; this.on = false; this.mr.stop(); } },
  };

  // Envio de fotos/vídeos/áudios/anexos ao Supabase Storage (bucket "campo")
  const Midia = {
    rodando: false, semBucket: false,
    async contar() { nMidia = (await I().Off.listarMidia()).length; faixa(); },
    async enviar() {
      const SB = I().SB;
      if (this.rodando || !navigator.onLine || !SB || !SB.cli || !SB.cli.storage) return;
      this.rodando = true;
      try {
        const lista = await I().Off.listarMidia();
        for (const it of lista) {
          const ext = (it.nome && it.nome.includes('.') ? it.nome.split('.').pop() : (it.mime || '').split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase();
          const caminho = `${new Date().getFullYear()}/${it.id}.${ext || 'bin'}`;
          const r = await SB.cli.storage.from('campo').upload(caminho, it.blob, { contentType: it.mime, upsert: true });
          if (r.error) {
            if (/bucket/i.test(r.error.message || '')) { this.semBucket = true; break; }
            if (I().Off.erroDeRede(r.error)) break;
            console.warn('upload', r.error); continue;
          }
          this.semBucket = false;
          const url = SB.cli.storage.from('campo').getPublicUrl(caminho).data.publicUrl;
          const rec = I().get('monitoramentos', it.rec);
          if (rec) {
            const novo = JSON.parse(JSON.stringify(rec));
            novo.pontos = (novo.pontos || []).map(p => p.midia_id !== it.id ? p : Object.assign(p, it.tipo === 'foto' ? { foto: url } : { midia: { url, nome: it.nome || '', mime: it.mime || '' } }));
            await I().Store.save('monitoramentos', novo);
            if (V && String(V.m.id) === String(rec.id)) { V.m.pontos = V.m.pontos.map(p => p.midia_id !== it.id ? p : Object.assign(p, it.tipo === 'foto' ? { foto: url } : { midia: { url, nome: it.nome || '', mime: it.mime || '' } })); vRender(); }
          }
          await I().Off.tirarMidia(it.id);
        }
      } finally { this.rodando = false; this.contar(); }
    },
  };

  // ---------- GPS ----------
  function ligarGps(centralizar) {
    if (!navigator.geolocation) { I().toast('Este aparelho não informa a localização.'); return; }
    gps.seguir = !!centralizar;
    if (gps.watch != null) { if (centralizar && gps.pos) irParaGps(); return; }
    let primeira = true;
    gps.watch = navigator.geolocation.watchPosition(p => {
      gps.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      desenharGps();
      if (primeira) { primeira = false; if (gps.seguir) { irParaGps(); const t = talhaoEm(L.latLng(gps.pos.lat, gps.pos.lng)); if (t) selecionar(t, false); } }
      vGpsInfo(); if (V) vPontosMapa();
    }, e => { if (e.code === 1) I().toast('Permita o acesso à localização nas configurações do celular.'); gps.watch = null; vGpsInfo(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  }
  function irParaGps() { if (gps.pos && map) map.setView([gps.pos.lat, gps.pos.lng], Math.max(map.getZoom(), 16)); }
  function desenharGps() {
    lyGps.clearLayers();
    if (!gps.pos) return;
    L.circle([gps.pos.lat, gps.pos.lng], { radius: gps.pos.acc, color: AZUL, weight: 1, fillOpacity: 0.12, interactive: false }).addTo(lyGps);
    L.circleMarker([gps.pos.lat, gps.pos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: AZUL, fillOpacity: 1, interactive: false }).addTo(lyGps);
  }
  function navegar(t) {
    const c = t ? centroTal(t) : selTal ? centroTal(tal(selTal)) : fazAtual() ? centroFaz(fazAtual()) : null;
    if (!c) { I().toast('Escolha uma fazenda ou talhão para navegar até lá.'); return; }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat.toFixed(6)},${c.lng.toFixed(6)}&travelmode=driving`, '_blank', 'noopener');
  }

  // ---------- Mapa offline ----------
  async function baixarMapa() {
    if (!('caches' in window)) { I().toast('Este navegador não guarda mapas offline.'); return; }
    if (!navigator.onLine) { I().toast('Conecte na internet para baixar o mapa.'); return; }
    fecharSheet();
    const b = map.getBounds(), z0 = Math.max(map.getZoom(), 10), urls = [];
    const tile = (lat, lng, z) => { const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n), r = lat * Math.PI / 180; return [x, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
    for (let z = z0; z <= Math.min(z0 + 4, 18); z++) {
      const [x1, y1] = tile(b.getNorth(), b.getWest(), z), [x2, y2] = tile(b.getSouth(), b.getEast(), z);
      if ((x2 - x1 + 1) * (y2 - y1 + 1) + urls.length > 3000) break;
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) urls.push(`${ESRI}World_Imagery/MapServer/tile/${z}/${y}/${x}`);
    }
    const cache = await caches.open('inovaagro-mapa');
    let feitos = 0, erros = 0;
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(urls.slice(i, i + 8).map(async u => { try { if (!(await cache.match(u))) await cache.put(u, await fetch(u, { mode: 'no-cors' })); } catch (e) { erros++; } feitos++; }));
      I().toast('Salvando mapa: ' + feitos + ' de ' + urls.length);
    }
    I().toast(erros ? 'Mapa salvo com ' + erros + ' falhas. Tente de novo para completar.' : 'Mapa desta área salvo para usar sem internet.');
  }

  // ---------- Sincronização ----------
  async function atualizarFila() {
    const l = await I().Off.fila();
    fila = new Set(l.map(x => x.k + ':' + x.id));
    faixa();
  }
  function faixa() {
    const el = $('#cp-faixa'); if (!el) return;
    const n = (I().Sync.pend || 0) + nMidia;
    const off = !navigator.onLine || I().Sync.offline;
    el.hidden = !n || faixaFechada === n || pane !== 'inicio';
    root.classList.toggle('cp-faixa-on', !el.hidden);
    if (!el.hidden) el.innerHTML = `<span>${off ? 'Sem internet' : 'Pendente'} · ${n} para enviar</span><button class="cp-lnk" data-cp="sync">${I().Sync.rodando ? 'Enviando…' : 'Sincronizar'}</button><button class="cp-ib" data-cp="fechar-faixa" aria-label="Esconder aviso">${ic('fechar')}</button>`;
    const bn = $('#cp-bnot'), bs = document.getElementById('badge-not');
    if (bn) { bn.hidden = !bs || bs.hidden; bn.textContent = bs ? bs.textContent : ''; }
  }
  async function sincronizarAgora() {
    if (!navigator.onLine) { I().toast('Sem internet agora. Os dados ficam no celular e são enviados quando a conexão voltar.'); return; }
    I().toast('Sincronizando…');
    await I().sincronizar(true); await Midia.enviar(); await atualizarFila();
    if (!I().Sync.pend && !nMidia) I().toast('Tudo sincronizado.');
    if (root.classList.contains('cp-menu-on')) menu();
  }
  async function pendencias() {
    const l = await I().Off.fila(), md = await I().Off.listarMidia();
    sheet(`<header class="cp-sh-h"><h2>Para enviar</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <ul class="cp-mini">${l.map(x => `<li><span><b>${esc(I().NOME[x.k] || x.k)}</b>${x.del ? ' (exclusão)' : ''}<br><small>${esc(x.obj && (x.obj.titulo || nomeTalFaz(x.obj.talhao_id) || x.obj.nome) || '')} · ${esc(fmtDH((x.em || '').slice(0, 16)))}</small></span></li>`).join('')}
      ${md.map(x => `<li><span><b>${esc(ROT[x.tipo] || 'Arquivo')}</b> ${esc(x.nome || '')}<br><small>${(x.blob.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB · ${esc(fmtDH((x.em || '').slice(0, 16)))}</small></span></li>`).join('')}</ul>
      ${!l.length && !md.length ? '<p class="cp-mut">Nada pendente.</p>' : ''}<button class="cp-btn pri" data-cp="sync">${ic('sync')}Sincronizar agora</button>`);
  }

  // ---------- Opções e suporte ----------
  function opcoes() {
    fecharMenu();
    sheet(`<header class="cp-sh-h"><h2>Opções</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="cp-mlinks">
        <button data-cp="niveis">${ic('semaforo')}Níveis de controle da cana</button>
        <button data-act="instalar">${ic('download')}Instalar o app no celular</button>
        <button data-cp="baixar-mapa">${ic('camadas')}Salvar o mapa da área na tela para usar sem internet</button>
        <button data-cp="completo">${ic('tela')}Abrir a versão completa do sistema</button>
      </div>
      <p class="cp-mut">Tamanho do texto, tema claro ou escuro e dados da empresa ficam em Configuração, na versão completa.</p>`);
  }
  function suporte() {
    fecharMenu();
    sheet(`<header class="cp-sh-h"><h2>Centro de suporte</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="cp-ajuda">
        <details open><summary>Como instalar o app</summary><p><b>iPhone:</b> no Safari, toque em Compartilhar e em "Adicionar à Tela de Início". <b>Android:</b> no Chrome, toque nos três pontinhos e em "Instalar app".</p></details>
        <details><summary>Funciona sem internet?</summary><p>Sim. Entre uma vez com internet para o app guardar os dados no celular. Depois, tudo o que você registrar sem sinal fica guardado e é enviado sozinho quando a internet voltar. A faixa amarela mostra quantos registros faltam enviar.</p></details>
        <details><summary>E o mapa sem internet?</summary><p>Os contornos dos talhões aparecem sempre. A imagem de satélite aparece nas áreas que você já viu com internet ou salvou em Camadas, "Salvar o mapa desta área".</p></details>
        <details><summary>Como faço uma visita?</summary><p>Toque no talhão no mapa e em "Nova visita". Registre amostras com o botão "+ Amostras" e marque fotos, áudios, vídeos, anexos e anotações nos botões redondos: cada um fica no ponto do GPS onde você está.</p></details>
        <details><summary>Preciso de ajuda</summary><p>Fale com o administrador da sua equipe. Ele pode liberar acesso, trocar sua permissão e ver tudo o que você registrou.</p></details>
      </div>`);
  }

  // ---------- Cliques ----------
  function clique(e) {
    const b = e.target.closest('[data-cp]'); if (!b || !root.contains(b)) return;
    const a = b.dataset.cp;
    if (b.matches('input')) { if (a === 'tg') { pref[b.dataset.k] = b.checked; salvarPref(); if (b.dataset.k === 'nomes') rotulos(); if (b.dataset.k === 'pontos') desenharPontos(); if (b.dataset.k === 'pluv') desenharPluv(); } if (a === 'so-faz') { soFaz = b.checked; historico(); } return; }
    switch (a) {
      case 'menu': menu(); break;
      case 'fechar-menu': fecharMenu(); break;
      case 'tab': fecharMenu(); fecharTelas(); if (b.dataset.p === 'historico') histTal = null; abrirPane(b.dataset.p); break;
      case 'pick': picker(); break;
      case 'pick-tab': pickTab = b.dataset.t; listaPick(); break;
      case 'pick-faz': pref.faz = b.dataset.id || null; salvarPref(); selTal = null; estilos(); desenharPontos(); desenharCard(); topo(); if (pref.faz) { enquadrarFaz(fazAtual()); pickTab = 'tal'; $('#cp-pick-q').value = ''; listaPick(); } else { enquadrarTudo(); fecharSheet(); } break;
      case 'pick-tal': { const t = tal(b.dataset.id); if (!t) break; if (pickCb) { const cb = pickCb; pickCb = null; selecionar(t, true); cb(t); } else { fecharSheet(); selecionar(t, true); } break; }
      case 'gps': ligarGps(true); if (gps.pos) { irParaGps(); const t = talhaoEm(L.latLng(gps.pos.lat, gps.pos.lng)); if (t) selecionar(t, false); } else I().toast('Procurando sua localização…'); break;
      case 'camadas': camadas(); break;
      case 'base': setBase(b.dataset.b); $$('[data-cp="base"]', root).forEach(x => x.setAttribute('aria-pressed', x.dataset.b === pref.base)); break;
      case 'navegar': navegar(); break;
      case 'chuva': chuva(); break;
      case 'fechar-card': selTal = null; estilos(); desenharCard(); topo(); break;
      case 'visita-nova': comTalhao(novaVisita); break;
      case 'atividades': atividades(selTal ? tal(selTal) : null); break;
      case 'hist-tal': histTal = selTal; abrirPane('historico'); break;
      case 'hist-todos': histTal = null; historico(); break;
      case 'filtro-h': filtroH = b.dataset.f; histLim = 40; historico(); break;
      case 'hist-mais': { const el = $('[data-pane="historico"]', root), y = el.scrollTop; histLim += 60; historico(); el.scrollTop = y; break; }
      case 'abrir-reg': { const r = I().get(b.dataset.k, b.dataset.id); if (!r) break; if (b.dataset.k === 'monitoramentos') abrirVisita(r); else I().openForm(b.dataset.k, r); break; }
      case 'ativ': { const [, , fn] = ATIV[b.dataset.g][1][b.dataset.a]; const tt = b.closest('.cp-tela')._tal; const go = t => fn(t); if (ATIV[b.dataset.g][0] === 'Clima') { fn(); break; } if (!exigeEditar()) break; if (tt) go(tal(tt)); else comTalhao(go); break; }
      case 'voltar': if (V && !V.salva && (V.m.pontos.length || V.m.amostras_detalhe.length)) vSalvar(); voltarTela(); break;
      case 'fechar-sheet': fecharSheet(); break;
      case 'sync': sincronizarAgora(); break;
      case 'pendencias': fecharMenu(); pendencias(); break;
      case 'fechar-faixa': faixaFechada = (I().Sync.pend || 0) + nMidia; faixa(); break;
      case 'opcoes': opcoes(); break;
      case 'suporte': suporte(); break;
      case 'completo': fecharMenu(); fecharSheet(); location.hash = 'painel'; break;
      case 'baixar-mapa': baixarMapa(); break;
      // visita
      case 'v-amostra': amostraForm(); break;
      case 'rota': if (telas.length && telas[telas.length - 1].el.classList.contains('cp-rota')) voltarTela(); else { fecharTelas(); rota(); } break;
      case 'rota-mapa': rotaMapa(); break;
      case 'rota-gmaps': rotaGmaps(); break;
      case 'rota-limpar': lyRota.clearLayers(); rotaAtual = null; { const bb = $('#cp-rbar'); if (bb) bb.hidden = true; } rotulos(); break;
      case 'rota-ir': navegar(tal(b.dataset.id)); break;
      case 'rota-visita': { const t = tal(b.dataset.id); if (t) novaVisita(t); break; }
      case 'cot-lista': cotesiaLista(); break;
      case 'cot-nova': comTalhao(cotesiaNova, 'Talhão da liberação'); break;
      case 'am-item': amostraItem(b.dataset.id); break;
      case 'am-livre': amostraLivre(); break;
      case 'niveis': if (CN()) niveisTela(); break;
      case 'niv-padrao': if (confirm('Voltar todos os níveis para os valores de referência?')) salvarNiveis({}, 'Níveis de referência restaurados.'); break;
      case 'v-sem-auto': V.m.semaforo_manual = false; semAuto(V.m); vSalvar(); vRender(); break;
      case 'wp': ponto(b.dataset.t); break;
      case 'rec': Rec.parar(false); break;
      case 'v-sem': if (V.m.semaforo === b.dataset.s) { V.m.semaforo = ''; V.m.semaforo_manual = false; semAuto(V.m); } else { V.m.semaforo = b.dataset.s; V.m.semaforo_manual = true; } vSalvar(); vRender(); break;
      case 'v-del-am': if (confirm('Apagar esta amostra?')) { V.m.amostras_detalhe.splice(+b.dataset.i, 1); V.m.amostras_detalhe.forEach((x, i) => x.amostra = i + 1); semAuto(V.m); vSalvar(); vRender(); } break;
      case 'v-del-pt': if (confirm('Apagar este ponto?')) { const [p] = V.m.pontos.splice(+b.dataset.i, 1); if (p && p.midia_id) I().Off.tirarMidia(p.midia_id).then(() => Midia.contar()); vSalvar(); vRender(); } break;
      case 'v-gps': ligarGps(false); if (gps.pos && V.map) V.map.setView([gps.pos.lat, gps.pos.lng], Math.max(V.map.getZoom(), 17)); break;
      case 'v-ir': navegar(tal(V.m.talhao_id)); break;
      case 'v-exp': V.el.classList.toggle('cp-vmap-grande'); setTimeout(() => V.map && V.map.invalidateSize(), 220); break;
      case 'v-mais': { if (!V.salva) vSalvar(); const m = I().get('monitoramentos', V.m.id) || V.m; voltarTela(); I().openForm('monitoramentos', m); break; }
      case 'v-concluir': if (V.salva || V.m.pontos.length || V.m.amostras_detalhe.length || V.m.semaforo || V.m.obs) { vSalvar('Visita salva.'); } voltarTela(); break;
    }
  }
  document.addEventListener('change', e => {
    const ro = e.target.closest('[data-cp-rota]');
    if (ro) { if (ro.dataset.cpRota === 'dias') pref.rotaDias = Number(ro.value); else pref.rotaNunca = ro.checked; salvarPref(); voltarTela(); rota(); return; }
    const c = e.target.closest('[data-cp-calor]');
    if (c) { if (c.dataset.cpCalor === 'dias') pref.calorDias = Number(c.value); else pref.calor = c.value || null; salvarPref(); calcCalor(); estilos(); return; }
    const f = e.target.closest('[data-cp-f]'); if (!f || !V) return;
    V.m[f.dataset.cpF] = f.value; vSalvar();
  });

  // ---------- Integração com o app ----------
  function view(first) {
    document.body.classList.add('campo-on');
    if (!window.L) return;
    if (!root) montar();
    else if (first) abrirPane(pane);
    setTimeout(() => map && map.invalidateSize(), 50);
    atualizarFila(); Midia.contar(); Midia.enviar();
  }
  window.addEventListener('hashchange', () => {
    if (location.hash === '#campo') return;
    document.body.classList.remove('campo-on');
    if (movidas.size) { devolverSecoes(); if (I()) I().route(); }
  });
  document.addEventListener('inova:dados', () => {
    if (!root) return;
    desenhar();
    if (pane === 'historico' && !telas.length) historico();
    const top = telas[telas.length - 1];
    if (top && top.el.classList.contains('cp-cotl')) { voltarTela(); cotesiaLista(); }
  });
  document.addEventListener('inova:sync', () => { if (root) { atualizarFila(); if (root.classList.contains('cp-menu-on')) menu(); } });
  window.addEventListener('online', () => { Midia.enviar(); });
  setInterval(() => { if (nMidia) Midia.enviar(); }, 90000);

  return { view, Midia };
})();
