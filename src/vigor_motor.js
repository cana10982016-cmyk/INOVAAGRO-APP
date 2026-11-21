// ---------- Vigor por satélite (NDVI) — motor de cálculo ----------
// Fonte: Sentinel-2 L2A (ESA/Copernicus), cópia aberta e gratuita na AWS (bucket público sentinel-cogs, sem cadastro).
// Lê só o pedaço da imagem que cobre a fazenda (COG, leitura por partes), a 20 m por pixel.
// Para cada talhão usa a imagem mais recente em que ele está pelo menos 80% sem nuvem (máscara SCL da ESA).
window.VIGOR_MOTOR = (function () {
  const BUCKET = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/';
  const PREFIXO = 'sentinel-s2-l2a-cogs/';
  const GEOTIFF = 'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js';
  const D = Math.PI / 180;

  // ---- Projeção UTM (WGS84), fórmulas de Snyder ----
  function utm(lat, lon, zona, sul) {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const phi = lat * D, lam = lon * D, lam0 = ((zona - 1) * 6 - 180 + 3) * D;
    const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
    const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = c * (lam - lam0);
    const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
      + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let y = k0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (sul) y += 10000000;
    return [x, y];
  }
  // Quadrícula MGRS de 100 km (= nome do "tile" do Sentinel-2), ex.: 22KHD
  function tile(lat, lon) {
    const zona = Math.floor((lon + 180) / 6) + 1;
    const faixa = 'CDEFGHJKLMNPQRSTUVWX'[Math.floor((lat + 80) / 8)];
    const [x, y] = utm(lat, lon, zona, lat < 0);
    const col = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'][(zona - 1) % 3][Math.floor(x / 100000) - 1];
    const lin = 'ABCDEFGHJKLMNPQRSTUV'[(Math.floor((y % 2000000) / 100000) + (zona % 2 ? 0 : 5)) % 20];
    return { zona, faixa, sq: col + lin, id: zona + faixa + col + lin };
  }

  // ---- Geometria ----
  const aneis = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  function caixa(geoms) {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const g of geoms) for (const p of aneis(g)) for (const c of p[0]) { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); }
    return isFinite(b[0]) ? b : null;
  }
  // pixels (índices na janela) cujo centro cai dentro do polígono — varredura por linha (regra par-ímpar)
  function rasterizar(polis, w, h) {
    const out = [];
    let y0 = Infinity, y1 = -Infinity;
    for (const p of polis) for (const r of p) for (const q of r) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5, xs = [];
      for (const p of polis) for (const r of p) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i], b = r[j];
        if ((a[1] > cy) !== (b[1] > cy)) xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) out.push(y * w + x);
      }
    }
    return out;
  }

  // ---- Catálogo de imagens (listagem do bucket público) ----
  async function listar(prefixo) {
    const r = await fetch(BUCKET + '?list-type=2&delimiter=/&prefix=' + encodeURIComponent(prefixo));
    if (!r.ok) throw new Error('catálogo ' + r.status);
    const xml = await r.text();
    return [...xml.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)].map(m => m[1]).filter(p => p !== prefixo);
  }
  // cenas dos últimos `dias`, mais recentes primeiro (uma por data e tile; reprocessamento _1 vence _0)
  async function cenas(tiles, dias, ate) {
    const fim = ate ? new Date(ate + 'T23:59:59Z') : new Date(), ini = new Date(fim - dias * 864e5);
    const meses = [];
    for (let d = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 1)); d >= new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), 1)); d.setUTCMonth(d.getUTCMonth() - 1)) meses.push([d.getUTCFullYear(), d.getUTCMonth() + 1]);
    const lotes = await Promise.all(tiles.flatMap(t => meses.map(([a, m]) => listar(`${PREFIXO}${t.zona}/${t.faixa}/${t.sq}/${a}/${m}/`).catch(() => []))));
    const por = new Map();
    for (const p of lotes.flat()) {
      const id = p.split('/').slice(-2)[0], m = id.match(/^S2[ABCD]_(\w{5})_(\d{8})_(\d+)_L2A$/); if (!m) continue;
      const data = m[2].slice(0, 4) + '-' + m[2].slice(4, 6) + '-' + m[2].slice(6, 8);
      if (data < ini.toISOString().slice(0, 10) || data > fim.toISOString().slice(0, 10)) continue;
      const k = m[1] + data, v = { id, tile: m[1], data, rev: +m[3], url: BUCKET + p };
      if (!por.has(k) || por.get(k).rev < v.rev) por.set(k, v);
    }
    return [...por.values()].sort((a, b) => b.data.localeCompare(a.data) || a.tile.localeCompare(b.tile));
  }

  let GT = null;
  async function geotiff() {
    if (window.GeoTIFF) return window.GeoTIFF;
    if (!GT) GT = new Promise((ok, fail) => { const s = document.createElement('script'); s.src = GEOTIFF; s.onload = () => ok(window.GeoTIFF); s.onerror = () => { GT = null; fail(new Error('Não carregou o leitor de imagens. Verifique a internet.')); }; document.head.appendChild(s); });
    return GT;
  }
  // abre a banda e devolve a imagem de 20 m (SCL já é 20 m; B04/B08 usam a primeira redução, que é 20 m)
  async function banda20(url) {
    const G = await geotiff();
    const tif = await G.fromUrl(url, { allowFullFile: false, cacheSize: 64 });
    let img = await tif.getImage(0);
    if (img.getResolution()[0] < 15) img = await tif.getImage(1);
    return img;
  }

  // Lê uma cena: devolve janela (x0,y0,w,h) com scl/red/nir; bandas só se houver talhão aproveitável
  async function lerCena(cena, talhoes, sc, minLimpo, avisar) {
    const meta = await fetch(cena.url + cena.id + '.json').then(r => r.ok ? r.json() : null).catch(() => null);
    if (meta && meta.properties && meta.properties['eo:cloud_cover'] > 97) return null;
    const epsg = meta && meta.properties && meta.properties['proj:epsg'] || (cena.tile.slice(2, 3) < 'N' ? 32700 : 32600) + +cena.tile.slice(0, 2);
    const zona = epsg % 100, sul = epsg >= 32700;
    // Obs.: nesta cópia da AWS os valores já vêm harmonizados (sem o deslocamento de -1000 das imagens novas da ESA),
    // conferido em 21/11/2026 (vermelho da cana fechada ~300). Por isso o NDVI usa os valores direto.
    const off = 0;
    avisar && avisar('Lendo nuvens de ' + cena.data.split('-').reverse().join('/') + '…');
    const scl = await banda20(cena.url + 'SCL.tif');
    const [ox, oy] = scl.getOrigin(), [rx, ry] = scl.getResolution(), W = scl.getWidth(), H = scl.getHeight();
    // talhões em pixels da imagem inteira
    const proj = talhoes.map(t => ({ t, polis: aneis(t.geometry).map(p => p.map(r => r.map(c => { const [x, y] = utm(c[1], c[0], zona, sul); return [(x - ox) / rx, (y - oy) / ry]; }))) }));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of proj) for (const po of p.polis) for (const q of po[0]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1); x1 = Math.min(W, Math.ceil(x1) + 1); y1 = Math.min(H, Math.ceil(y1) + 1);
    if (x1 <= x0 || y1 <= y0) return null;
    const w = x1 - x0, h = y1 - y0;
    const [S] = await scl.readRasters({ window: [x0, y0, x1, y1] });
    // SCL: 4 vegetação, 5 solo, 6 água, 7 sem classificação → aproveitáveis; 0 sem dado; 1 saturado; 2 sombra escura; 3 sombra de nuvem; 8/9 nuvem; 10 cirro; 11 neve
    const BOM = new Uint8Array(12); BOM[4] = BOM[5] = BOM[6] = BOM[7] = 1;
    const usar = [];
    for (const p of proj) {
      const pix = rasterizar(p.polis.map(po => po.map(r => r.map(q => [q[0] - x0, q[1] - y0]))), w, h);
      const tot = Math.max(pix.length, aneis(p.t.geometry).length ? 1 : 0);
      if (pix.length < 4) continue;
      let ok = 0; for (const i of pix) ok += BOM[S[i]] || 0;
      if (ok / tot >= minLimpo) usar.push({ t: p.t, pix, limpo: ok / tot });
    }
    if (!usar.length) return { cena, usados: [] };
    avisar && avisar('Calculando o vigor de ' + cena.data.split('-').reverse().join('/') + '…');
    const [red, nir] = await Promise.all(['B04', 'B08'].map(b => banda20(cena.url + b + '.tif').then(im => im.readRasters({ window: [x0, y0, x1, y1], width: w, height: h }).then(r => r[0]))));
    const ndvi = new Float32Array(w * h).fill(NaN);
    for (let i = 0; i < ndvi.length; i++) {
      if (!BOM[S[i]] || S[i] === 6) continue;
      const r = red[i] + off, n = nir[i] + off;
      if (r + n > 0) ndvi[i] = (n - r) / (n + r);
    }
    const usados = usar.map(u => {
      const v = []; for (const i of u.pix) if (!isNaN(ndvi[i])) v.push(ndvi[i]);
      if (v.length < 4) return null;
      v.sort((a, b) => a - b);
      const med = v.reduce((a, b) => a + b, 0) / v.length;
      return { t: u.t, ndvi: med, p10: v[Math.floor(v.length * 0.1)], p90: v[Math.floor(v.length * 0.9)], baixo: v.filter(x => x < 0.4).length / v.length, n: v.length, limpo: u.limpo };
    }).filter(Boolean);
    return { cena, usados, janela: { x0, y0, w, h, ox, oy, rx, ry, zona, sul }, ndvi };
  }

  // Calcula o vigor dos talhões. Retorna { porTalhao: Map(id -> {data, ndvi, ...}), anterior: Map(...), imagem }
  // opts: dias (padrão 75), ate (AAAA-MM-DD), minLimpo (0.8), maxCenas (10), avisar(texto), anterior: true para buscar também uma imagem ~1 mês antes
  async function calcular(talhoes, opts = {}) {
    talhoes = talhoes.filter(t => t.geometry && aneis(t.geometry).length);
    if (!talhoes.length) throw new Error('Esta fazenda não tem talhões desenhados no mapa.');
    const bb = caixa(talhoes.map(t => t.geometry));
    const pts = [[bb[1], bb[0]], [bb[1], bb[2]], [bb[3], bb[0]], [bb[3], bb[2]], [(bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2]];
    const tiles = [...new Map(pts.map(p => tile(p[0], p[1])).map(t => [t.id, t])).values()];
    const avisar = opts.avisar || (() => {});
    const minLimpo = opts.minLimpo || 0.8, maxCenas = opts.maxCenas || 14;
    avisar('Procurando imagens do satélite…');
    async function rodada(lista, dias, ate, guardarImagem) {
      const cs = await cenas(tiles, dias, ate);
      const res = new Map(); let imagem = null, lidas = 0;
      let pend = lista.slice();
      for (const c of cs) {
        if (!pend.length || lidas >= maxCenas) break;
        lidas++;
        const r = await lerCena(c, pend, null, minLimpo, avisar).catch(e => { console.warn('vigor', c.id, e); return null; });
        if (!r || !r.usados.length) continue;
        for (const u of r.usados) res.set(String(u.t.id), { data: c.data, cena: c.id, ndvi: +u.ndvi.toFixed(3), p10: +u.p10.toFixed(3), p90: +u.p90.toFixed(3), baixo: +u.baixo.toFixed(3), limpo: +u.limpo.toFixed(2), px: u.n });
        if (guardarImagem && (!imagem || r.usados.length > imagem.usados.length)) imagem = r;
        const feitos = new Set(r.usados.map(u => String(u.t.id)));
        pend = pend.filter(t => !feitos.has(String(t.id)));
      }
      return { res, imagem, faltam: pend, cenasVistas: lidas, cenasAchadas: cs.length };
    }
    const atual = await rodada(talhoes, opts.dias || 90, opts.ate, true);
    let anterior = new Map();
    if (opts.anterior && atual.res.size) {
      // imagem anterior: ~1 mês antes da mais antiga usada (para mostrar se o vigor subiu ou caiu)
      const datas = [...atual.res.values()].map(v => v.data).sort();
      const ate = new Date(new Date(datas[0] + 'T12:00:00Z') - 20 * 864e5).toISOString().slice(0, 10);
      avisar('Buscando a imagem anterior para comparar…');
      anterior = (await rodada(talhoes.filter(t => atual.res.has(String(t.id))), 70, ate, false)).res;
    }
    return { porTalhao: atual.res, anterior, imagem: atual.imagem, semImagem: atual.faltam.map(t => t.id), cenasVistas: atual.cenasVistas, cenasAchadas: atual.cenasAchadas, tiles: tiles.map(t => t.id) };
  }

  // Cor do NDVI para a imagem do mapa (vermelho → amarelo → verde escuro)
  const ESC = [[0.10, [165, 42, 38]], [0.30, [214, 96, 58]], [0.45, [236, 178, 64]], [0.60, [176, 205, 82]], [0.72, [92, 160, 72]], [0.85, [28, 104, 52]]];
  function corNdvi(v) {
    if (v <= ESC[0][0]) return ESC[0][1];
    for (let i = 1; i < ESC.length; i++) if (v <= ESC[i][0]) { const [a, ca] = ESC[i - 1], [b, cb] = ESC[i], k = (v - a) / (b - a); return ca.map((x, j) => Math.round(x + (cb[j] - x) * k)); }
    return ESC[ESC.length - 1][1];
  }
  // Desenha a imagem de vigor (pixel a pixel, só dentro dos talhões) em coordenadas de latitude/longitude, para sobrepor no mapa
  function desenhar(imagem, talhoes, maxLado = 900) {
    if (!imagem || !imagem.ndvi) return null;
    const ts = talhoes.filter(t => t.geometry);
    const bb = caixa(ts.map(t => t.geometry)); if (!bb) return null;
    const J = imagem.janela;
    const latm = (bb[1] + bb[3]) / 2, mx = (bb[2] - bb[0]) * 111320 * Math.cos(latm * D), my = (bb[3] - bb[1]) * 110540;
    const passo = Math.max(5, Math.max(mx, my) / maxLado); // metros por pixel da imagem final
    const W = Math.max(1, Math.round(mx / passo)), H = Math.max(1, Math.round(my / passo));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const X = lon => (lon - bb[0]) / (bb[2] - bb[0]) * W, Y = lat => (bb[3] - lat) / (bb[3] - bb[1]) * H;
    g.fillStyle = '#000'; g.beginPath();
    for (const t of ts) for (const p of aneis(t.geometry)) for (const r of p) r.forEach((c, i) => i ? g.lineTo(X(c[0]), Y(c[1])) : g.moveTo(X(c[0]), Y(c[1])));
    g.fill('evenodd');
    const id = g.getImageData(0, 0, W, H), px = id.data;
    for (let y = 0; y < H; y++) {
      const lat = bb[3] - (y + 0.5) / H * (bb[3] - bb[1]);
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4; if (!px[o + 3]) continue;
        const lon = bb[0] + (x + 0.5) / W * (bb[2] - bb[0]);
        const [ux, uy] = utm(lat, lon, J.zona, J.sul);
        const cx = Math.floor((ux - J.ox) / J.rx) - J.x0, cy = Math.floor((uy - J.oy) / J.ry) - J.y0;
        const v = cx >= 0 && cy >= 0 && cx < J.w && cy < J.h ? imagem.ndvi[cy * J.w + cx] : NaN;
        if (isNaN(v)) { px[o] = px[o + 1] = px[o + 2] = 160; px[o + 3] = 90; continue; }
        const c = corNdvi(v); px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 235;
      }
    }
    g.putImageData(id, 0, 0);
    return { url: cv.toDataURL('image/png'), bounds: [[bb[1], bb[0]], [bb[3], bb[2]]], data: imagem.cena.data, cena: imagem.cena.id };
  }

  return { calcular, desenhar, corNdvi, tile, utm, cenas, ESC };
})();
