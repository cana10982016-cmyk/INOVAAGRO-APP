/* INOVAAGRO — Previsão do tempo por fazenda e janela de aplicação.
   Usa a previsão hora a hora do Open-Meteo (gratuita, sem chave), no centro de cada fazenda (contorno dos talhões).
   Cada hora recebe uma situação para pulverizar: boa, atenção ou não aplicar, pelos limites de
   chuva (na hora e nas horas seguintes, que lavam o produto), vento (nem forte, nem parado), rajadas, calor e ar seco.
   Os limites podem ser ajustados no aparelho. A última previsão de cada fazenda fica guardada no aparelho
   para abrir sem internet. Ordens de aplicação previstas para os próximos 7 dias ganham um aviso do tempo,
   e as notificações avisam quando há chuva forte, vento forte ou geada nas fazendas com aplicação prevista. */
window.Tempo = (function () {
  'use strict';
  const I = () => window.INOVA;
  const S = () => I().S;
  const esc = s => I().esc(s);
  const key = v => I().key(v);
  const $ = (s, el = document) => el.querySelector(s);

  // ---------- Datas e números ----------
  const p2 = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const hoje = () => iso(new Date());
  const dt = s => new Date(s + 'T12:00:00');
  const somar = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const SEM_L = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const diaCurto = s => s === hoje() ? 'Hoje' : s === somar(hoje(), 1) ? 'Amanhã' : SEM[dt(s).getDay()];
  const diaLongo = s => (s === hoje() ? 'Hoje, ' : s === somar(hoje(), 1) ? 'Amanhã, ' : SEM_L[dt(s).getDay()] + ', ') + dt(s).getDate() + ' de ' + MES[dt(s).getMonth()];
  const dm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
  const n1 = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
  const mm = v => v == null ? '—' : (v < 0.1 ? '0' : n1(v)) + ' mm';
  const r0 = v => v == null ? '—' : String(Math.round(v));
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const hm = ms => { const d = new Date(ms); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const RUMO = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const rumo = g => g == null ? '' : RUMO[Math.round(((g % 360) + 360) % 360 / 45) % 8];
  // Delta T: diferença entre a temperatura do ar e a de bulbo úmido (fórmula de Stull). Bom para aplicar entre 2 e 8.
  function deltaT(T, UR) {
    if (T == null || UR == null) return null;
    const tw = T * Math.atan(0.151977 * Math.sqrt(UR + 8.313659)) + Math.atan(T + UR) - Math.atan(UR - 1.676331) + 0.00391838 * Math.pow(UR, 1.5) * Math.atan(0.023101 * UR) - 4.686035;
    return Math.max(0, T - tw);
  }

  // ---------- Ícones ----------
  const svg = (p, cls = '') => `<svg class="tp-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const IC = {
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    parcial: '<path d="M8.5 5.2V3.6M3.6 8.5H2M4.9 4.9l1 1M12.1 4.9l-1 1"/><path d="M5.4 11.4A3.6 3.6 0 1 1 11.9 8"/><path d="M8 19a3.5 3.5 0 0 1 .3-7 5 5 0 0 1 9.4 1.2A3 3 0 0 1 17.5 19z"/>',
    nuvem: '<path d="M7 18a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.4A3.3 3.3 0 0 1 17 18z"/>',
    chuva: '<path d="M7 14.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.4A3.3 3.3 0 0 1 17 14.5z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
    raio: '<path d="M7 14.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.4A3.3 3.3 0 0 1 17 14.5z"/><path d="m12.5 15-2 3.5h3l-2 3.5"/>',
    vento: '<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5M3 16h8"/>',
    gota: '<path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z"/>',
    bico: '<path d="M9 3h6v4H9zM12 7v3"/><path d="M12 10 7 20M12 10l5 10M12 10v10M12 10l-2.5 10M12 10l2.5 10"/>',
    alerta: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8L16.2 9.5"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5M20 20v-4h-4"/>',
    ajuste: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    seta: '<path d="m9 6 6 6-6 6"/>',
    termo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  };
  function icTempo(d) {
    const c = d.code;
    if (c != null) { if (c >= 95) return IC.raio; if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return d.mm >= 1 ? IC.chuva : IC.nuvem; if (c === 3 || c === 45 || c === 48) return IC.nuvem; if (c === 2) return IC.parcial; return IC.sol; }
    return d.mm >= 1 ? IC.chuva : d.prob >= 40 ? IC.nuvem : IC.sol;
  }
  // seta para onde o vento sopra (a direção do Open-Meteo é de onde ele vem)
  const setaVento = g => g == null ? '' : `<svg class="tp-ic tp-dir" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(g + 180)}deg)"><path d="M12 4v16M6.5 9.5 12 4l5.5 5.5"/></svg>`;

  // ---------- Limites para aplicar (ajustáveis no aparelho) ----------
  const LIM0 = { ventoMin: 3, ventoMax: 10, rajadaMax: 20, tempMax: 30, urMin: 55, horasDepois: 2 };
  const LS_LIM = 'inovaagro.tempo.limites';
  const LIM = Object.assign({}, LIM0);
  try { Object.assign(LIM, JSON.parse(localStorage.getItem(LS_LIM) || '{}')); } catch (e) { }
  const CAMPOS_LIM = [['ventoMin', 'Vento mínimo', 'km/h', 'Abaixo disso o ar está parado e pode haver inversão térmica.'], ['ventoMax', 'Vento máximo', 'km/h', 'Acima disso a gota é levada para fora do alvo (deriva).'], ['rajadaMax', 'Rajada máxima', 'km/h', ''], ['tempMax', 'Temperatura máxima', '°C', 'Acima disso a gota evapora antes de chegar na folha.'], ['urMin', 'Umidade mínima', '%', ''], ['horasDepois', 'Horas sem chuva depois', 'h', 'Tempo que o produto precisa para não ser lavado.']];

  // Situação de cada hora: 0 = boa, 1 = atenção, 2 = não aplicar. Os motivos explicam o porquê.
  function avaliar(H, i) {
    const x = H[i], mot = []; let n = 0;
    const pior = (k, t) => { mot.push([k, t]); if (k > n) n = k; };
    if (x.mm >= 0.2 || x.prob >= 60) pior(2, 'chuva');
    else {
      if (x.prob >= 30) pior(1, 'pode chover');
      let s = 0, p = 0;
      for (let j = i + 1; j <= i + LIM.horasDepois && j < H.length; j++) { s += H[j].mm || 0; p = Math.max(p, H[j].prob || 0); }
      if (s >= 0.5 || p >= 60) pior(2, 'chuva logo depois');
      else if (p >= 40 && x.prob < 30) pior(1, 'pode chover depois');
    }
    if (x.vento > LIM.ventoMax + 5) pior(2, 'vento forte');
    else if (x.vento > LIM.ventoMax) pior(1, 'vento acima de ' + LIM.ventoMax);
    else if (x.vento != null && x.vento < LIM.ventoMin) pior(1, 'vento fraco');
    if (x.rajada > LIM.rajadaMax + 10) pior(2, 'rajadas fortes');
    else if (x.rajada > LIM.rajadaMax) pior(1, 'rajadas');
    if (x.temp > LIM.tempMax + 3) pior(2, 'calor');
    else if (x.temp > LIM.tempMax) pior(1, 'calor');
    if (x.ur != null && x.ur < LIM.urMin - 10) pior(2, 'ar seco');
    else if (x.ur != null && x.ur < LIM.urMin) pior(1, 'ar seco');
    mot.sort((a, b) => b[0] - a[0]);
    return { n, mot: mot.map(m => m[1]) };
  }
  function classificar(F) {
    const h0 = hoje();
    F.horas = F.horas.filter(x => x.d >= h0); F.dias = F.dias.filter(x => x.d >= h0);
    F.horas.forEach((x, i) => { const a = avaliar(F.horas, i); x.n = a.n; x.mot = a.mot; x.dT = deltaT(x.temp, x.ur); });
    F._lim = JSON.stringify(LIM); F._dia = h0;
    return F;
  }
  // Janelas: horas seguidas com situação até "nivel", com pelo menos "min" horas
  function janelas(hs, nivel = 0, min = 2) {
    const out = []; let ini = null;
    for (let k = 0; k <= hs.length; k++) {
      if (k < hs.length && hs[k].n <= nivel) { if (ini == null) ini = k; continue; }
      if (ini != null && k - ini >= min) out.push([hs[ini].h, hs[k - 1].h + 1]);
      ini = null;
    }
    return out;
  }
  const txtJan = l => l.map(([a, b]) => b === 24 ? `${a}h à meia-noite` : `${a}h às ${b}h`).join(', ').replace(/, ([^,]*)$/, ' e $1');
  const durJan = l => l.reduce((a, [x, y]) => a + y - x, 0);
  function resumoDia(F, d) {
    const hs = F.horas.filter(x => x.d === d), dia = F.dias.find(x => x.d === d) || null;
    const jb = janelas(hs, 0), ja = jb.length ? [] : janelas(hs, 1, 3);
    const cnt = {};
    for (const x of hs) if (x.h >= 6 && x.h <= 19 && x.n) for (const t of x.mot) cnt[t] = (cnt[t] || 0) + (x.n === 2 ? 2 : 1);
    const mot = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    const nivel = jb.length ? 0 : ja.length ? 1 : 2;
    return { d, hs, dia, jb, ja, mot, nivel, boas: hs.filter(x => x.n === 0).length };
  }
  function frase(r) {
    if (!r.hs.length) return 'Sem previsão para este dia.';
    if (r.nivel === 0) return (durJan(r.jb) >= 3 ? 'Bom para aplicar' : 'Janela curta') + ': ' + txtJan(r.jb);
    if (r.nivel === 1) return 'Só com cuidado: ' + txtJan(r.ja) + (r.mot.length ? ' (' + r.mot.join(' e ') + ')' : '');
    return 'Sem janela para aplicar' + (r.mot.length ? ': ' + r.mot.join(' e ') : '');
  }

  // ---------- Busca no Open-Meteo e cópia no aparelho ----------
  const API = 'https://api.open-meteo.com/v1/forecast';
  const HV = 'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m';
  const DV = 'weather_code,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant';
  const LSK = 'inovaagro.tempo.v1';
  const MEM = new Map();
  let DISCO = {};
  try { DISCO = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (e) { DISCO = {}; }
  function salvarDisco() {
    const ks = Object.keys(DISCO).sort((a, b) => DISCO[b].em - DISCO[a].em);
    for (const k of ks.slice(12)) delete DISCO[k]; // guarda só as 12 fazendas mais recentes (o login precisa de espaço)
    try { localStorage.setItem(LSK, JSON.stringify(DISCO)); } catch (e) { for (const k of ks.slice(4)) delete DISCO[k]; try { localStorage.setItem(LSK, JSON.stringify(DISCO)); } catch (e2) { } }
  }
  function ler(o) {
    const H = o.hourly || {}, D = o.daily || {}, h0 = hoje(), v = (a, i) => a && a[i] != null ? a[i] : null;
    const horas = [], dias = [], pas = [];
    (H.time || []).forEach((t, i) => { const d = t.slice(0, 10); if (d < h0) return; horas.push({ t, d, h: +t.slice(11, 13), mm: v(H.precipitation, i) || 0, prob: v(H.precipitation_probability, i), vento: v(H.wind_speed_10m, i), rajada: v(H.wind_gusts_10m, i), dir: v(H.wind_direction_10m, i), temp: v(H.temperature_2m, i), ur: v(H.relative_humidity_2m, i) }); });
    (D.time || []).forEach((d, i) => {
      if (d < h0) { pas.push({ d, mm: v(D.precipitation_sum, i) || 0 }); return; }
      dias.push({ d, mm: v(D.precipitation_sum, i) || 0, prob: v(D.precipitation_probability_max, i), max: v(D.temperature_2m_max, i), min: v(D.temperature_2m_min, i), vento: v(D.wind_speed_10m_max, i), rajada: v(D.wind_gusts_10m_max, i), dir: v(D.wind_direction_10m_dominant, i), code: v(D.weather_code, i) });
    });
    return { em: Date.now(), horas, dias, pas: pas.length ? pas : null };
  }
  function guardar(f, F) {
    const k = key(f.id), velho = MEM.get(k) || DISCO[k];
    if (!F.pas && velho && velho.pas) F.pas = velho.pas;
    MEM.set(k, classificar(F));
    DISCO[k] = { em: F.em, horas: F.horas.map(({ t, d, h, mm, prob, vento, rajada, dir, temp, ur }) => ({ t, d, h, mm, prob, vento, rajada, dir, temp, ur })), dias: F.dias, pas: F.pas };
  }
  async function baixar(fs, passado) {
    const pts = fs.map(f => [f, I().centroFaz(f)]).filter(x => x[1]);
    for (let i = 0; i < pts.length; i += 50) {
      const ch = pts.slice(i, i + 50);
      const u = `${API}?latitude=${ch.map(x => x[1][0].toFixed(3)).join(',')}&longitude=${ch.map(x => x[1][1].toFixed(3)).join(',')}&hourly=${HV}&daily=${DV}&forecast_days=7${passado ? '&past_days=30' : ''}&timezone=America%2FSao_Paulo`;
      const r = await fetch(u); if (!r.ok) throw new Error('Open-Meteo ' + r.status);
      let j = await r.json(); if (!Array.isArray(j)) j = [j];
      j.forEach((o, k) => { if (ch[k]) guardar(ch[k][0], ler(o)); });
    }
    salvarDisco();
  }
  function doCache(f) {
    if (!f) return null;
    const k = key(f.id); let F = MEM.get(k);
    if (!F && DISCO[k]) { F = JSON.parse(JSON.stringify(DISCO[k])); MEM.set(k, F); }
    if (F && (F._lim !== JSON.stringify(LIM) || F._dia !== hoje())) classificar(F);
    return F || null;
  }
  const idade = F => F ? Date.now() - F.em : Infinity;
  const FRESCO = 2 * 36e5;
  async function obter(f, o = {}) {
    let F = doCache(f);
    if (F && idade(F) < FRESCO && F.dias.length >= 6 && (!o.passado || F.pas) && !o.forcar) return F;
    if (navigator.onLine !== false) { try { await baixar([f], o.passado); return doCache(f); } catch (e) { console.warn('previsão', e); } }
    return F && idade(F) < 72 * 36e5 && F.dias.length ? F : null;
  }

  // ---------- Ordens de aplicação ----------
  const pend = o => !o.status || o.status === 'Planejada' || o.status === 'Em andamento';
  const ehApl = o => o.tipo === 'Pulverização' || o.tipo === 'Fertilização' || (o.produtos && o.produtos.length > 0);
  const nomeFaz = id => (I().get('fazendas', id) || {}).nome || 'Fazenda';
  function ordensApl(fazId) {
    const h = hoje(), fim = somar(h, 6);
    return (S().data.ordens || []).filter(o => pend(o) && ehApl(o) && o.data_prevista && o.data_prevista >= h && o.data_prevista <= fim && (!fazId || key(o.fazenda_id) === key(fazId)))
      .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  }
  function veredito(o) {
    const F = doCache(I().get('fazendas', o.fazenda_id)); if (!F) return null;
    const r = resumoDia(F, o.data_prevista); if (!r.hs.length) return null;
    const dep = F.dias.find(x => x.d === somar(o.data_prevista, 1));
    let n = r.nivel, txt = frase(r);
    if (n === 0 && dep && dep.mm >= 10) { n = 1; txt += ` · ${mm(dep.mm)} de chuva no dia seguinte`; }
    return { n, txt, r };
  }
  const TAG = ['Bom para aplicar', 'Atenção ao tempo', 'Tempo ruim para aplicar'];
  function tagOrdem(o) {
    if (!pend(o) || !ehApl(o) || !o.data_prevista || o.data_prevista < hoje() || o.data_prevista > somar(hoje(), 6)) return '';
    const v = veredito(o); if (!v) return '';
    return `<span class="tp-tag n${v.n}" title="${esc(v.txt)}">${svg(v.n === 0 ? IC.bico : v.n === 1 ? IC.alerta : IC.chuva)}${TAG[v.n]}</span>`;
  }

  // ---------- Alertas da fazenda (7 dias) ----------
  function alertas(F) {
    const out = [];
    for (const x of F.dias) {
      const q = diaCurto(x.d).toLowerCase() + (x.d === hoje() || x.d === somar(hoje(), 1) ? '' : ' ' + dm(x.d));
      if (x.min != null && x.min <= 3) out.push([2, 'Risco de geada', `${q}: mínima de ${r0(x.min)} °C`, x.d]);
      if (x.mm >= 30) out.push([2, 'Chuva forte', `${q}: ${mm(x.mm)}`, x.d]);
      else if (x.mm >= 15) out.push([1, 'Chuva', `${q}: ${mm(x.mm)}`, x.d]);
      if (x.rajada >= 60 || x.vento >= 35) out.push([2, 'Vento forte', `${q}: rajadas de ${r0(x.rajada)} km/h`, x.d]);
      else if (x.rajada >= 45) out.push([1, 'Ventania', `${q}: rajadas de ${r0(x.rajada)} km/h`, x.d]);
      if (x.max != null && x.max >= 36) out.push([1, 'Calor extremo', `${q}: máxima de ${r0(x.max)} °C`, x.d]);
    }
    if (F.dias.length >= 6 && F.dias.every(x => x.mm < 1)) out.push([0, 'Sem chuva prevista', `nenhum dia com chuva nos próximos ${F.dias.length} dias`, '']);
    return out;
  }

  // =====================================================================
  // Tela "Chuvas e previsão": uma fazenda ou todas
  // =====================================================================
  const T = { modo: 'faz', dia: null, todasHoras: false, q: '', soApl: false, limOn: false };
  try { const o = JSON.parse(localStorage.getItem('inovaagro.tempo.pref') || '{}'); if (o.modo) T.modo = o.modo; if (o.todasHoras) T.todasHoras = true; } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem('inovaagro.tempo.pref', JSON.stringify({ modo: T.modo, todasHoras: T.todasHoras })); } catch (e) { } };
  let EL = null, FAZ = null;

  function cab(F) {
    return `<div class="tp-cab">
      <div class="seg tp-seg" role="group" aria-label="Mostrar"><button data-tp-modo="faz" aria-pressed="${T.modo === 'faz'}">Esta fazenda</button><button data-tp-modo="todas" aria-pressed="${T.modo === 'todas'}">Todas as fazendas</button></div>
      <span class="tp-upd">${F ? (idade(F) > FRESCO && navigator.onLine === false ? 'Sem internet · previsão de ' + new Date(F.em).toLocaleDateString('pt-BR') + ' às ' + hm(F.em) : 'Atualizada às ' + hm(F.em)) : ''}</span>
      <button class="btn small ghost" data-tp="lim" aria-expanded="${T.limOn}">${svg(IC.ajuste)}Limites para aplicar</button>
      <button class="btn small ghost" data-tp="atualizar">${svg(IC.sync)}Atualizar</button>
    </div>${T.limOn ? painelLim() : ''}`;
  }
  function painelLim() {
    return `<form class="tp-lim" data-tp-lim><p>A hora fica <b class="tp-c0">boa</b> quando tudo está dentro destes limites, <b class="tp-c1">atenção</b> quando passa um pouco e <b class="tp-c2">não aplicar</b> quando passa muito ou chove. Vale para este aparelho.</p>
      <div class="tp-lim-g">${CAMPOS_LIM.map(([k, l, u, d]) => `<label><span>${l}</span><span class="tp-lim-i"><input type="number" inputmode="decimal" min="0" max="100" step="1" name="${k}" value="${LIM[k]}"><em>${u}</em></span>${d ? `<small>${d}</small>` : ''}</label>`).join('')}</div>
      <div class="tp-lim-b"><button type="button" class="btn small ghost" data-tp="lim-padrao">Voltar ao padrão</button><button class="btn small primary">Aplicar limites</button></div></form>`;
  }

  async function render(el, f) {
    EL = el; FAZ = f;
    const sel = el.closest('.card-box') && el.closest('.card-box').querySelector('#cl-faz');
    if (sel) sel.hidden = T.modo === 'todas';
    if (!el.dataset.tpOn) { el.dataset.tpOn = 1; el.addEventListener('click', clique); el.addEventListener('submit', enviarLim); el.addEventListener('input', e => { if (e.target.matches('[data-tp-q]')) { T.q = e.target.value; desenharTodas(); } }); el.addEventListener('change', e => { if (e.target.matches('[data-tp-soapl]')) { T.soApl = e.target.checked; desenharTodas(); } }); }
    if (T.modo === 'todas') return renderTodas(el);
    if (!f) { el.innerHTML = cab() + '<p class="muted">Escolha uma fazenda.</p>'; return; }
    if (!I().centroFaz(f)) { el.innerHTML = cab() + '<p class="muted">Esta fazenda não tem localização (contorno de talhão ou coordenada), por isso não há previsão.</p>'; return; }
    const F0 = doCache(f);
    el.innerHTML = cab(F0) + (F0 && F0.dias.length ? htmlFaz(f, F0) : '<div class="tp-load"><span></span><span></span><span></span></div>');
    const F = await obter(f, { passado: true });
    if (FAZ !== f || !el.isConnected || T.modo !== 'faz') return;
    if (!F) { el.innerHTML = cab() + `<p class="muted">${navigator.onLine === false ? 'Sem internet. A previsão aparece quando a conexão voltar.' : 'Não foi possível carregar a previsão agora. Tente de novo em instantes.'}</p>`; return; }
    if (F !== F0 || !F0.dias.length) { const y = window.scrollY; el.innerHTML = cab(F) + htmlFaz(f, F); window.scrollTo(0, y); }
  }
  function redesenhar() { if (EL && EL.isConnected) { if (T.modo === 'todas') renderTodas(EL); else { const F = doCache(FAZ); if (F) EL.innerHTML = cab(F) + htmlFaz(FAZ, F); else render(EL, FAZ); } } }

  function htmlFaz(f, F) {
    if (!T.dia || !F.dias.some(d => d.d === T.dia)) T.dia = F.dias[0] && F.dias[0].d;
    const al = alertas(F), ords = ordensApl(f.id);
    const rs = F.dias.map(x => resumoDia(F, x.d));
    return `<div class="tp">
      <div class="tp-alertas">${al.length ? al.map(([n, t, d, dia]) => `<button class="tp-al n${n}" ${dia ? `data-tp-dia="${dia}"` : ''}>${svg(n === 2 ? IC.alerta : n === 1 ? IC.alerta : IC.sol)}<b>${t}</b><span>${esc(d)}</span></button>`).join('') : `<span class="tp-al n0">${svg(IC.ok)}<b>Sem alertas de tempo</b><span>para os próximos 7 dias</span></span>`}</div>
      <div class="tp-dias" role="tablist" aria-label="Dias da previsão">${F.dias.map((x, k) => cardDia(x, rs[k])).join('')}</div>
      ${grade(F, rs)}
      ${detalhe(F, rs.find(r => r.d === T.dia))}
      ${ords.length ? secOrdens(ords) : ''}
      ${historico(F)}
      <p class="tp-fonte">Previsão do Open-Meteo para o centro da fazenda ${esc(f.nome)}. A janela de aplicação usa os limites ao lado do botão Atualizar.</p>
    </div>`;
  }
  function cardDia(x, r) {
    const on = x.d === T.dia;
    return `<button class="tp-dia" role="tab" aria-selected="${on}" data-tp-dia="${x.d}">
      <span class="tp-dn"><b>${diaCurto(x.d)}</b><small>${dm(x.d)}</small></span>
      <span class="tp-dt">${svg(icTempo(x), 'tp-big')}<span><b class="num">${r0(x.max)}°</b><small class="num">${r0(x.min)}°</small></span></span>
      <span class="tp-dc"><span class="tp-bar"><i style="width:${Math.min(100, x.prob || 0)}%"></i></span><span class="num"><b>${mm(x.mm)}</b> · ${x.prob != null ? x.prob + '%' : '—'}</span></span>
      <span class="tp-dv">${setaVento(x.dir)}<span class="num">${r0(x.vento)} km/h</span><small class="num">raj. ${r0(x.rajada)}</small></span>
      <span class="tp-apl n${r.nivel}">${r.nivel === 0 ? plural(r.boas, 'hora boa', 'horas boas') : r.nivel === 1 ? 'só com cuidado' : 'sem janela'}</span>
    </button>`;
  }
  function grade(F, rs) {
    const hrs = [...Array(24).keys()];
    const cel = x => x ? `<td class="n${x.n}" title="${x.h}h · ${['boa para aplicar', 'atenção', 'não aplicar'][x.n]}${x.mot.length ? ': ' + x.mot.join(', ') : ''} · vento ${r0(x.vento)} km/h · ${mm(x.mm)} · ${r0(x.temp)} °C"><i></i></td>` : '<td class="vazio"><i></i></td>';
    return `<section class="tp-sec"><div class="tp-sec-h"><h4>${svg(IC.bico)}Janela de aplicação <small>hora a hora, 7 dias</small></h4>
        <span class="tp-leg"><i class="n0"></i>Boa<i class="n1"></i>Atenção<i class="n2"></i>Não aplicar</span></div>
      <div class="tp-grade-w"><table class="tp-grade"><thead><tr><th></th>${hrs.map(h => `<th>${h % 3 === 0 ? h + 'h' : ''}</th>`).join('')}<th class="tp-gr"></th></tr></thead>
        <tbody>${rs.map(r => { const m = new Map(r.hs.map(x => [x.h, x])); return `<tr data-tp-dia="${r.d}" aria-selected="${r.d === T.dia}"><th>${diaCurto(r.d)} <small>${dm(r.d)}</small></th>${hrs.map(h => cel(m.get(h))).join('')}<td class="tp-gr n${r.nivel}">${r.nivel === 0 ? r.jb.map(([a, b]) => a + '–' + b + 'h').slice(0, 2).join(' · ') : r.nivel === 1 ? 'cuidado' : '—'}</td></tr>`; }).join('')}</tbody></table></div>
    </section>`;
  }
  function detalhe(F, r) {
    if (!r) return '';
    const hs = T.todasHoras ? r.hs : r.hs.filter(x => x.h >= 5 && x.h <= 20);
    const SIT = ['Boa', 'Atenção', 'Não aplicar'];
    return `<section class="tp-sec tp-det"><div class="tp-sec-h"><h4>${esc(diaLongo(r.d))}</h4><label class="chk"><input type="checkbox" data-tp="todas-horas" ${T.todasHoras ? 'checked' : ''}> Mostrar a madrugada</label></div>
      <div class="tp-ver n${r.nivel}">${svg(r.nivel === 0 ? IC.ok : r.nivel === 1 ? IC.alerta : IC.x)}<span><b>${esc(frase(r))}</b>${r.dia ? `<small>Chuva ${mm(r.dia.mm)}${r.dia.prob != null ? ' · chance de ' + r.dia.prob + '%' : ''} · vento até ${r0(r.dia.vento)} km/h, rajadas de ${r0(r.dia.rajada)} · ${r0(r.dia.min)}° a ${r0(r.dia.max)}°</small>` : ''}</span></div>
      <div class="table-wrap"><table class="tp-horas"><thead><tr><th>Hora</th><th>Aplicação</th><th class="r">Chuva</th><th class="r">Chance</th><th class="r">Vento</th><th class="r">Rajada</th><th>Vem do</th><th class="r">Temp.</th><th class="r">Umidade</th><th class="r" title="Diferença entre a temperatura do ar e a de bulbo úmido. Ideal entre 2 e 8.">Delta T</th><th>Motivo</th></tr></thead>
      <tbody>${hs.map(x => `<tr class="n${x.n}"><td class="num"><b>${p2(x.h)}h</b></td><td><span class="tp-sit n${x.n}"><i></i>${SIT[x.n]}</span></td><td class="r num">${x.mm >= 0.1 ? mm(x.mm) : '—'}</td><td class="r num">${x.prob != null ? x.prob + '%' : '—'}</td><td class="r num">${r0(x.vento)} km/h</td><td class="r num">${r0(x.rajada)}</td><td class="tp-rumo">${setaVento(x.dir)}${rumo(x.dir)}</td><td class="r num">${r0(x.temp)}°</td><td class="r num">${r0(x.ur)}%</td><td class="r num">${x.dT != null ? n1(x.dT) : '—'}</td><td class="tp-mot">${esc(x.mot.join(', '))}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }
  function secOrdens(ords) {
    return `<section class="tp-sec"><div class="tp-sec-h"><h4>${svg(IC.bico)}Aplicações previstas nesta fazenda <small>próximos 7 dias</small></h4></div>
      <ul class="tp-ords">${ords.map(o => { const v = veredito(o); const ts = (o.talhao_ids || []).map(id => I().get('talhoes', id)).filter(Boolean); return `<li><button data-edit="ordens:${esc(o.id)}"><i class="tp-dot n${v ? v.n : 1}"></i><span><b>${esc(o.titulo || o.tipo)}</b><small>${esc(diaLongo(o.data_prevista))}${ts.length ? ' · ' + plural(ts.length, 'talhão', 'talhões') : ''}${o.produtos && o.produtos.length ? ' · ' + esc(o.produtos.map(p => p.produto).slice(0, 2).join(', ')) : ''}</small></span><em class="n${v ? v.n : 1}">${v ? esc(v.txt) : 'Sem previsão'}</em>${svg(IC.seta, 'tp-chev')}</button></li>`; }).join('')}</ul></section>`;
  }
  function historico(F) {
    if (!F.pas || !F.pas.length) return '';
    const tot = F.pas.reduce((a, x) => a + x.mm, 0), max = Math.max(1, ...F.pas.map(x => x.mm));
    return `<section class="tp-sec"><div class="tp-sec-h"><h4>${svg(IC.gota)}Chuva nos últimos 30 dias <small>estimativa por satélite e modelo</small></h4><b class="num tp-tot">${mm(tot)}</b></div>
      <div class="hist tp-hist" role="img" aria-label="Chuva diária nos últimos 30 dias">${F.pas.map(x => `<span title="${dm(x.d)}: ${mm(x.mm)}" style="height:${Math.max(2, x.mm / max * 100)}%"></span>`).join('')}</div>
      <div class="tp-hist-l"><span>${dm(F.pas[0].d)}</span><span>${dm(F.pas[F.pas.length - 1].d)}</span></div></section>`;
  }

  // ---------- Todas as fazendas ----------
  async function renderTodas(el) {
    const fs = S().data.fazendas.filter(f => I().centroFaz(f));
    const falta = fs.filter(f => idade(doCache(f)) > FRESCO);
    el.innerHTML = cab() + `<div class="tp-todas"><div class="toolbar"><input type="search" class="q" data-tp-q placeholder="Buscar fazenda ou produtor" value="${esc(T.q)}" aria-label="Buscar fazenda"><label class="chk"><input type="checkbox" data-tp-soapl ${T.soApl ? 'checked' : ''}> Só com aplicação prevista</label><span class="count" data-tp-ct></span></div><div data-tp-tab>${falta.length ? `<div class="tp-load"><span></span><span></span><span></span></div><p class="muted tp-loadt">Buscando a previsão de ${plural(falta.length, 'fazenda', 'fazendas')}…</p>` : ''}</div></div>`;
    if (falta.length && navigator.onLine !== false) { try { await baixar(falta); } catch (e) { console.warn('previsão', e); } }
    if (!el.isConnected || T.modo !== 'todas') return;
    const c = el.querySelector('.tp-cab'); if (c) { const F = fs.map(doCache).filter(Boolean).sort((a, b) => a.em - b.em)[0]; c.outerHTML = cab(F).replace(/<form[\s\S]*$/, ''); }
    desenharTodas();
  }
  function desenharTodas() {
    const box = EL && EL.querySelector('[data-tp-tab]'); if (!box) return;
    const q = String(T.q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const h = hoje(), ds = [h, somar(h, 1), somar(h, 2)];
    const linhas = S().data.fazendas.map(f => {
      const F = doCache(f), p = I().get('produtores', f.produtor_id), ords = ordensApl(f.id);
      return { f, F, p, ords, rs: F ? ds.map(d => resumoDia(F, d)) : null, al: F ? alertas(F).filter(a => a[0] > 0) : [] };
    }).filter(x => (!q || ((x.f.nome || '') + ' ' + ((x.p && x.p.nome) || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)) && (!T.soApl || x.ords.length))
      .sort((a, b) => (b.ords.length ? 1 : 0) - (a.ords.length ? 1 : 0) || b.al.length - a.al.length || (a.f.nome || '').localeCompare(b.f.nome || '', 'pt-BR'));
    const ct = EL.querySelector('[data-tp-ct]'); if (ct) ct.textContent = plural(linhas.length, 'fazenda', 'fazendas');
    const celDia = r => !r || !r.hs.length ? '<td class="muted">—</td>' : `<td><span class="tp-cel n${r.nivel}"><i></i><b>${r.nivel === 0 ? esc(r.jb.slice(0, 2).map(([a, b]) => a + '–' + b + 'h').join(', ')) : r.nivel === 1 ? 'Com cuidado' : 'Sem janela'}</b></span><small class="num">${r.dia ? mm(r.dia.mm) + ' · vento ' + r0(r.dia.vento) : ''}${r.nivel === 2 && r.mot.length ? ' · ' + esc(r.mot[0]) : ''}</small></td>`;
    box.innerHTML = `<div class="table-wrap"><table class="tp-tab"><thead><tr><th>Fazenda</th><th>Hoje</th><th>Amanhã</th><th>${diaCurto(ds[2])} ${dm(ds[2])}</th><th class="r">Chuva 7 dias</th><th>Alertas</th><th class="r">Aplicações</th></tr></thead>
      <tbody>${linhas.map(x => `<tr data-tp-faz="${esc(x.f.id)}"><td><b>${esc(x.f.nome)}</b><small class="muted">${esc((x.p && x.p.nome) || '')}${x.f.municipio ? ' · ' + esc(x.f.municipio) : ''}</small></td>${x.F ? x.rs.map(celDia).join('') + `<td class="r num">${mm(x.F.dias.reduce((a, d) => a + d.mm, 0))}</td><td><span class="tp-als">${x.al.slice(0, 2).map(a => `<span class="pill ${a[0] === 2 ? 'bad' : 'warn'}">${esc(a[1])} · ${esc(a[2].split(':')[0])}</span>`).join('')}</span></td>` : `<td colspan="5" class="muted">${!I().centroFaz(x.f) ? 'Sem localização' : 'Sem previsão no aparelho'}</td>`}<td class="r">${x.ords.length ? `<span class="tp-na n${Math.max(0, ...x.ords.map(o => (veredito(o) || { n: 1 }).n))}">${x.ords.length}</span>` : '<span class="muted">—</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nenhuma fazenda encontrada.</td></tr>'}</tbody></table></div>
      <p class="tp-fonte">Janela de aplicação de cada dia (horas boas seguidas), chuva e vento máximo previstos. Toque numa fazenda para ver hora a hora.</p>`;
  }

  // ---------- Cliques ----------
  function clique(e) {
    const b = e.target.closest('[data-tp-dia]');
    if (b && T.modo === 'faz') { T.dia = b.dataset.tpDia; const F = doCache(FAZ); if (F) { const y = window.scrollY; EL.innerHTML = cab(F) + htmlFaz(FAZ, F); window.scrollTo(0, y); } return; }
    const m = e.target.closest('[data-tp-modo]');
    if (m) { if (T.modo !== m.dataset.tpModo) { T.modo = m.dataset.tpModo; salvarPref(); render(EL, FAZ); } return; }
    const fz = e.target.closest('[data-tp-faz]');
    if (fz) { T.modo = 'faz'; T.dia = null; salvarPref(); if (I().climaFaz) I().climaFaz(fz.dataset.tpFaz); return; }
    const a = e.target.closest('[data-tp]'); if (!a) return;
    const k = a.dataset.tp;
    if (k === 'atualizar') { if (navigator.onLine === false) { I().toast('Sem internet agora.'); return; } if (T.modo === 'todas') { for (const f of S().data.fazendas) { const F = doCache(f); if (F) F.em = 0; } render(EL, FAZ); } else { a.disabled = true; obter(FAZ, { passado: true, forcar: true }).then(F => { if (F) redesenhar(); else I().toast('Não foi possível atualizar agora.'); }); } }
    else if (k === 'lim') { T.limOn = !T.limOn; redesenhar(); }
    else if (k === 'lim-padrao') { Object.assign(LIM, LIM0); try { localStorage.removeItem(LS_LIM); } catch (err) { } redesenhar(); I().toast('Limites voltaram ao padrão.'); }
    else if (k === 'todas-horas') { T.todasHoras = a.checked; salvarPref(); redesenhar(); }
  }
  function enviarLim(e) {
    if (!e.target.matches('[data-tp-lim]')) return;
    e.preventDefault();
    const fd = new FormData(e.target);
    for (const [k] of CAMPOS_LIM) { const v = parseFloat(String(fd.get(k)).replace(',', '.')); if (isFinite(v) && v >= 0) LIM[k] = v; }
    if (LIM.ventoMin >= LIM.ventoMax) LIM.ventoMin = Math.max(0, LIM.ventoMax - 1);
    try { localStorage.setItem(LS_LIM, JSON.stringify(LIM)); } catch (err) { }
    T.limOn = false; redesenhar(); I().toast('Limites salvos neste aparelho.');
    if (I().updateBadges) I().updateBadges();
  }

  // =====================================================================
  // Resumo do dia (aba Hoje) e notificações
  // =====================================================================
  async function linhaHoje(f) {
    const F = await obter(f); if (!F) return '';
    const r = resumoDia(F, hoje()), am = resumoDia(F, somar(hoje(), 1));
    const ords = ordensApl().filter(o => o.data_prevista === hoje()), ruins = ords.filter(o => { const v = veredito(o); return v && v.n > 0; });
    const lin = (rr, rot) => `<li class="n${rr.nivel}">${svg(rr.nivel === 0 ? IC.bico : rr.nivel === 1 ? IC.alerta : IC.x)}<span><b>${rot}</b> ${esc(rr.nivel === 0 ? txtJan(rr.jb) : rr.nivel === 1 ? 'só com cuidado, ' + txtJan(rr.ja) : 'sem janela' + (rr.mot.length ? ' (' + rr.mot.join(' e ') + ')' : ''))}</span></li>`;
    return `<div class="tp-hoje"><span class="tp-hoje-t">Janela para aplicar</span><ul>${r.hs.length ? lin(r, 'Hoje:') : ''}${am.hs.length ? lin(am, 'Amanhã:') : ''}</ul>
      ${ruins.length ? `<p class="tp-hoje-al">${svg(IC.alerta)}${plural(ruins.length, 'aplicação prevista', 'aplicações previstas')} para hoje com tempo ruim</p>` : ''}
      <a class="tp-hoje-l" href="#clima" data-tp-abrir="${esc(f.id)}">Ver hora a hora${svg(IC.seta)}</a></div>`;
  }
  function avisos() {
    if (!window.INOVA || !S().data.ordens) return [];
    const out = [], h = hoje();
    for (const o of ordensApl()) {
      const v = veredito(o); if (!v || v.n === 0) continue;
      out.push({ id: `tpo-${o.id}-${o.data_prevista}-${v.n}`, tipo: 'atividades', data: h, cor: v.n === 2 ? '#d03b3b' : '#eda100', t: `${v.n === 2 ? 'Tempo ruim' : 'Atenção ao tempo'} para a aplicação: ${o.titulo || o.tipo}`, d: `${nomeFaz(o.fazenda_id)} · ${diaLongo(o.data_prevista)} · ${v.txt}`, go: 'ordens:' + o.id });
    }
    const fz = new Set(ordensApl().map(o => key(o.fazenda_id)));
    for (const id of fz) {
      const f = I().get('fazendas', id), F = doCache(f); if (!F || idade(F) > 24 * 36e5) continue;
      const al = alertas(F).filter(a => a[0] === 2 && a[3] && a[3] <= somar(h, 3)); if (!al.length) continue;
      out.push({ id: `tpa-${id}-${al.map(a => a[1] + a[3]).join('|')}`, tipo: 'atividades', data: h, cor: '#d03b3b', t: `Previsão de ${[...new Set(al.map(a => a[1].toLowerCase()))].join(' e ')} em ${f.nome}`, d: al.map(a => a[2]).join(' · '), go: 'tp:' + id });
    }
    return out;
  }
  // abre a previsão de uma fazenda (das notificações ou do resumo do dia)
  function abrir(id) {
    T.modo = 'faz'; T.dia = null; salvarPref();
    if (I().climaFaz) I().climaFaz(id, true);
    if (document.body.classList.contains('campo-on')) {
      const q = () => document.querySelector('#v-campo [data-cp="tab"][data-p="clima"]');
      if (!q()) { const m = document.querySelector('#v-campo [data-cp="menu"]'); if (m) m.click(); }
      const b = q(); if (b) { b.click(); return; }
    }
    if (location.hash !== '#clima') location.hash = 'clima';
  }
  document.addEventListener('click', e => { const a = e.target.closest('[data-tp-abrir]'); if (a) { e.preventDefault(); abrir(a.dataset.tpAbrir); } });

  // Busca em segundo plano a previsão das fazendas com aplicação prevista, para os avisos e etiquetas das ordens.
  let ultima = 0;
  async function preparar() {
    if (!window.INOVA || !S().data.ordens || navigator.onLine === false || Date.now() - ultima < FRESCO) return;
    ultima = Date.now();
    const fs = [...new Set(ordensApl().map(o => key(o.fazenda_id)))].map(id => I().get('fazendas', id)).filter(f => f && idade(doCache(f)) > FRESCO).slice(0, 50);
    if (!fs.length) return;
    try { await baixar(fs); if (I().updateBadges) I().updateBadges(); if (/^#ord/.test(location.hash)) I().refresh(); } catch (e) { console.warn('previsão', e); }
  }
  document.addEventListener('inova:dados', () => setTimeout(preparar, 1500));
  window.addEventListener('online', () => setTimeout(preparar, 3000));

  return { render, obter, resumoDia, linhaHoje, avisos, tagOrdem, abrir, frase, LIM, _baixar: baixar };
})();
