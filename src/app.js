/* Gleba — gestão agrícola. Dados base importados do SIMA (data/*.json) + alterações salvas (nuvem ou navegador). */
(function () {
  'use strict';

  // ---------- Configuração dos cadastros ----------
  const CULTURAS = ['Soja', 'Milho', 'Milho safrinha', 'Sorgo', 'Feijão', 'Algodão', 'Cana-de-açúcar', 'Café', 'Trigo', 'Pastagem', 'Pousio', 'Outra'];
  const STATUS = ['Planejada', 'Em andamento', 'Concluída', 'Cancelada'];
  const STATUS_CLS = { 'Planejada': 'info', 'Em andamento': 'warn', 'Concluída': 'ok', 'Cancelada': '' };
  const NIVEL_CLS = { 'Baixo': 'ok', 'Médio': 'warn', 'Alto': 'bad' };
  const KINDS = ['produtores', 'fazendas', 'talhoes', 'safras', 'monitoramentos', 'ordens'];
  const NOME = { produtores: 'produtor', fazendas: 'fazenda', talhoes: 'talhão', safras: 'plantio', monitoramentos: 'monitoramento', ordens: 'ordem de trabalho' };

  const FIELDS = {
    produtores: [
      { k: 'nome', l: 'Nome', req: 1, full: 1 },
      { k: 'documento', l: 'CPF / CNPJ' },
      { k: 'telefone', l: 'Telefone' },
      { k: 'email', l: 'E-mail', full: 1 },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    fazendas: [
      { k: 'nome', l: 'Nome da fazenda', req: 1, full: 1 },
      { k: 'produtor_id', l: 'Produtor', t: 'produtor', req: 1, full: 1 },
      { k: 'codigo', l: 'Código' },
      { k: 'municipio', l: 'Município - UF' },
      { k: 'area_ha', l: 'Área total (ha)', t: 'number' },
      { k: 'inscricao', l: 'Inscrição / CAR' },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    talhoes: [
      { k: 'nome', l: 'Nome do talhão', req: 1 },
      { k: 'area_ha', l: 'Área (ha)', t: 'number' },
      { k: 'fazenda_id', l: 'Fazenda', t: 'fazenda', req: 1, full: 1 },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    safras: [
      { k: 'safra', l: 'Safra', req: 1, ph: '2025/26' },
      { k: 'cultura', l: 'Cultura', t: 'select', opts: CULTURAS, req: 1 },
      { k: 'talhao_id', l: 'Talhão', t: 'talhao', req: 1, full: 1 },
      { k: 'variedade', l: 'Variedade / híbrido' },
      { k: 'data_plantio', l: 'Plantio', t: 'date' },
      { k: 'data_colheita', l: 'Colheita', t: 'date' },
      { k: 'produtividade', l: 'Produtividade (sc/ha)', t: 'number' },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    monitoramentos: [
      { k: 'data', l: 'Data', t: 'date', req: 1 },
      { k: 'responsavel', l: 'Responsável' },
      { k: 'talhao_id', l: 'Talhão', t: 'talhao', req: 1, full: 1 },
      { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Praga', 'Doença', 'Planta daninha', 'Estádio fenológico', 'Falha de estande', 'Outro'], req: 1 },
      { k: 'alvo', l: 'Praga / doença / alvo', ph: 'Ex.: lagarta-do-cartucho' },
      { k: 'nivel', l: 'Nível', t: 'select', opts: ['Baixo', 'Médio', 'Alto'] },
      { k: 'estadio', l: 'Estádio da cultura', ph: 'Ex.: V6, R3' },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    ordens: [
      { k: 'titulo', l: 'Título', req: 1, full: 1, ph: 'Ex.: Pulverização fungicida' },
      { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Pulverização', 'Plantio', 'Colheita', 'Adubação', 'Preparo de solo', 'Outro'], req: 1 },
      { k: 'status', l: 'Situação', t: 'select', opts: STATUS, req: 1 },
      { k: 'fazenda_id', l: 'Fazenda', t: 'fazenda', req: 1, full: 1 },
      { k: 'talhao_ids', l: 'Talhões', t: 'talhoes', full: 1 },
      { k: 'data_prevista', l: 'Data prevista', t: 'date' },
      { k: 'data_conclusao', l: 'Data de conclusão', t: 'date' },
      { k: 'responsavel', l: 'Responsável / operador', full: 1 },
      { k: 'insumos', l: 'Insumos e doses (um por linha)', t: 'textarea', full: 1, ph: 'Produto - dose/ha' },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
  };

  // ---------- Estado ----------
  const S = {
    base: Object.fromEntries(KINDS.map(k => [k, []])),
    over: Object.fromEntries(KINDS.map(k => [k, {}])),
    data: {}, idx: {},
    sel: { produtor: null, fazenda: null, talhao: null },
    colorBy: 'produtor',
  };

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtHa = n => n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = n => Number(n || 0).toLocaleString('pt-BR');
  const fmtDate = d => d ? d.slice(0, 10).split('-').reverse().join('/') : '—';
  const today = () => new Date().toISOString().slice(0, 10);
  const key = id => String(id);
  const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function rebuild() {
    for (const k of KINDS) {
      const m = new Map();
      for (const r of S.base[k]) m.set(key(r.id), r);
      for (const [id, r] of Object.entries(S.over[k])) {
        if (r._del) m.delete(id); else m.set(id, Object.assign({}, m.get(id) || {}, r));
      }
      S.data[k] = [...m.values()];
      S.idx[k] = m;
    }
    const by = (arr, f) => { const m = new Map(); for (const r of arr) { const v = key(r[f]); if (!m.has(v)) m.set(v, []); m.get(v).push(r); } return m; };
    S.fazPorProd = by(S.data.fazendas, 'produtor_id');
    S.talPorFaz = by(S.data.talhoes, 'fazenda_id');
    S.safPorTal = by(S.data.safras, 'talhao_id');
    S.monPorTal = by(S.data.monitoramentos, 'talhao_id');
    // produtor do talhão vem da fazenda
    for (const t of S.data.talhoes) { const f = get('fazendas', t.fazenda_id); if (f) t._prod = f.produtor_id; else t._prod = t.produtor_id; }
    S.data.produtores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    S.colors = new Map(S.data.produtores.map((p, i) => [key(p.id), PALETTE[i % PALETTE.length]]));
  }
  const get = (k, id) => id == null ? null : S.idx[k]?.get(key(id)) || null;
  const nomeTal = t => t ? (/^\d+$/.test(t.nome) ? 'Talhão ' + t.nome : t.nome) : '—';
  const culturaAtual = t => { const s = (S.safPorTal.get(key(t.id)) || []).slice().sort((a, b) => (b.safra || '').localeCompare(a.safra || '') || (b.data_plantio || '').localeCompare(a.data_plantio || '')); return s[0] || null; };
  const PALETTE = ['#e8b23a', '#5fb3d9', '#e46f5a', '#8fcf6a', '#b98ae6', '#f08bb6', '#5ad1b8', '#d9d36a', '#e8935a', '#7f9cf0'];
  const CULT_COLOR = { 'Soja': '#8fcf6a', 'Milho': '#e8b23a', 'Milho safrinha': '#f0cf6a', 'Sorgo': '#d98a4a', 'Feijão': '#b98ae6', 'Algodão': '#f2f2f2', 'Cana-de-açúcar': '#5ad1b8', 'Café': '#a0522d', 'Trigo': '#d9c27a', 'Pastagem': '#4f9e5a', 'Pousio': '#9a9a8a', 'Outra': '#7f9cf0' };
  const corTal = t => {
    if (S.colorBy === 'cultura') { const c = culturaAtual(t); return c ? CULT_COLOR[c.cultura] || '#7f9cf0' : '#8a9285'; }
    return S.colors.get(key(t._prod)) || '#ccc';
  };

  // ---------- Armazenamento ----------
  const LS = 'gleba.alteracoes.v1';
  const Store = {
    mode: 'local', db: null,
    async init() {
      try {
        if (window.claude && window.claude.use) {
          const db = await Promise.race([window.claude.use('db'), new Promise(r => setTimeout(() => r(null), 8000))]);
          if (db) { this.db = db; this.mode = 'nuvem'; this.subscribe(); }
        }
      } catch (e) { this.db = null; }
      if (!this.db) {
        try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o) for (const k of KINDS) S.over[k] = o[k] || {}; } catch (e) { }
      }
      setSync();
    },
    subscribe() {
      for (const k of KINDS) {
        this.db.collection(k).onSnapshot(snap => {
          const m = {}; for (const d of snap.docs) m[d.id] = d.data();
          S.over[k] = m; rebuild(); refresh();
        }, err => { console.warn('db', k, err); });
      }
    },
    async save(k, obj) {
      obj = Object.assign({}, obj, { atualizado_em: new Date().toISOString() });
      delete obj._prod;
      S.over[k][key(obj.id)] = obj; rebuild(); refresh();
      if (this.db) {
        try { await this.db.collection(k).doc(key(obj.id)).set(obj); }
        catch (e) { toast(e.code === 'invalid_argument' ? 'Você não tem permissão para alterar estes dados.' : 'Não foi possível salvar. Tente de novo.'); throw e; }
      } else this.persist();
    },
    async remove(k, id) { return this.save(k, { id, _del: true }); },
    persist() { try { localStorage.setItem(LS, JSON.stringify(S.over)); } catch (e) { toast('O navegador não deixou salvar os dados localmente.'); } },
  };
  function setSync() {
    const el = $('#sync'); el.dataset.mode = Store.mode;
    $('span', el).textContent = Store.mode === 'nuvem' ? 'Salvo na nuvem' : 'Salvo neste navegador';
  }

  // ---------- Carregar dados base ----------
  async function loadBase() {
    const pre = window.GLEBA_DATA || {};
    await Promise.all(KINDS.map(async k => {
      if (pre[k]) { S.base[k] = pre[k]; return; }
      try { const r = await fetch('data/' + k + '.json'); if (r.ok) S.base[k] = await r.json(); } catch (e) { }
    }));
  }

  // ---------- Roteamento ----------
  const VIEWS = { mapa: viewMapa, produtores: viewProdutores, fazendas: viewFazendas, talhoes: viewTalhoes, safras: viewSafras, monitoramentos: viewMonitoramentos, ordens: viewOrdens };
  let current = null;
  function route() {
    const v = (location.hash || '#mapa').slice(1);
    const name = VIEWS[v] ? v : 'mapa';
    document.querySelectorAll('.tabs a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + name) || a.removeAttribute('aria-current'));
    document.querySelectorAll('.tabs a').forEach(a => { if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page'); });
    document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== 'v-' + name);
    current = name; VIEWS[name](true);
  }
  function refresh() { if (current) VIEWS[current](false); }

  // ---------- Mapa ----------
  let map, layerTal, layerFaz, tileLayer, layersById = new Map(), mapReady = false;
  function initMap() {
    if (mapReady || !window.L) return;
    mapReady = true;
    map = L.map('map', { zoomControl: false, preferCanvas: true, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagem: Esri' });
    let tileErrors = 0, tileOk = 0;
    tileLayer.on('tileerror', () => { if (++tileErrors > 3 && !tileOk) { map.removeLayer(tileLayer); $('#mapnote').hidden = false; } });
    tileLayer.on('tileload', () => { tileOk++; });
    tileLayer.addTo(map);
    layerTal = L.featureGroup().addTo(map);
    layerFaz = L.featureGroup().addTo(map);
    map.on('zoomend', syncFazMarkers);
    map.on('click', () => { if (S.sel.talhao) { S.sel.talhao = null; drawSheet(); styleAll(); renderTree(); } });
  }
  function drawLayers() {
    layerTal.clearLayers(); layerFaz.clearLayers(); layersById.clear();
    for (const t of S.data.talhoes) {
      if (!t.geometry) continue;
      const lyr = L.geoJSON(t.geometry, { style: () => styleFor(t) });
      lyr.on('click', e => { L.DomEvent.stopPropagation(e); selectTalhao(t.id, false); });
      lyr.bindTooltip(() => esc(nomeTal(t)) + ' · ' + fmtHa(t.area_ha) + ' ha', { sticky: true, className: 'lbl' });
      lyr.addTo(layerTal); layersById.set(key(t.id), lyr);
    }
    for (const f of S.data.fazendas) {
      const c = fazCenter(f); if (!c) continue;
      L.circleMarker(c, { radius: 6, color: '#fff', weight: 2, fillColor: S.colors.get(key(f.produtor_id)) || '#ccc', fillOpacity: 1 })
        .bindTooltip(esc(f.nome), { className: 'lbl' })
        .on('click', () => selectFazenda(f.id, true)).addTo(layerFaz);
    }
    syncFazMarkers();
    drawLegend();
  }
  function fazCenter(f) {
    const ts = S.talPorFaz.get(key(f.id)) || [];
    const b = boundsOf(ts);
    if (b) return b.getCenter();
    return f.lat != null && f.lng != null ? L.latLng(f.lat, f.lng) : null;
  }
  function boundsOf(ts) {
    let b = null;
    for (const t of ts) { const l = layersById.get(key(t.id)); if (l) { const lb = l.getBounds(); b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast()); } }
    return b;
  }
  function syncFazMarkers() { if (!map) return; const show = map.getZoom() < 12; if (show && !map.hasLayer(layerFaz)) map.addLayer(layerFaz); if (!show && map.hasLayer(layerFaz)) map.removeLayer(layerFaz); }
  function inSel(t) {
    if (S.sel.fazenda) return key(t.fazenda_id) === key(S.sel.fazenda);
    if (S.sel.produtor) return key(t._prod) === key(S.sel.produtor);
    return true;
  }
  function styleFor(t) {
    const sel = key(t.id) === key(S.sel.talhao), on = inSel(t), c = corTal(t);
    return { color: sel ? '#ffffff' : c, weight: sel ? 3 : 1.4, fillColor: c, fillOpacity: sel ? 0.55 : on ? 0.32 : 0.08, opacity: on ? 1 : 0.35 };
  }
  function styleAll() { for (const t of S.data.talhoes) { const l = layersById.get(key(t.id)); if (l) l.setStyle(styleFor(t)); } }
  function fitSel() {
    let ts = S.data.talhoes.filter(inSel);
    if (S.sel.talhao) ts = [get('talhoes', S.sel.talhao)].filter(Boolean);
    const b = boundsOf(ts);
    if (b) map.fitBounds(b, { padding: [30, 30], maxZoom: 17 });
  }
  function drawLegend() {
    const el = $('#legend');
    if (S.colorBy === 'cultura') {
      const used = new Set(S.data.talhoes.map(t => culturaAtual(t)?.cultura).filter(Boolean));
      el.innerHTML = '<b>Cultura atual</b>' + [...used].map(c => `<div><i class="dot" style="background:${CULT_COLOR[c] || '#7f9cf0'}"></i>${esc(c)}</div>`).join('') + '<div><i class="dot" style="background:#8a9285"></i>Sem plantio cadastrado</div>';
    } else {
      el.innerHTML = '<b>Produtor</b>' + S.data.produtores.map(p => `<div><i class="dot" style="background:${S.colors.get(key(p.id))}"></i>${esc(p.nome)}</div>`).join('');
    }
  }

  function selectProdutor(id) { S.sel = { produtor: id, fazenda: null, talhao: null }; afterSel(true); }
  function selectFazenda(id, fit) { const f = get('fazendas', id); S.sel = { produtor: f ? f.produtor_id : null, fazenda: id, talhao: null }; afterSel(fit); }
  function selectTalhao(id, fit) { const t = get('talhoes', id); if (!t) return; S.sel = { produtor: t._prod, fazenda: t.fazenda_id, talhao: id }; afterSel(fit); }
  function afterSel(fit) {
    if (location.hash !== '#mapa' && location.hash !== '') { location.hash = 'mapa'; setTimeout(() => { styleAll(); fitSel(); }, 50); }
    styleAll(); renderTree(); drawSheet(); if (fit) fitSel();
  }

  function renderKpis() {
    const area = S.data.talhoes.reduce((s, t) => s + (Number(t.area_ha) || 0), 0);
    $('#kpis').innerHTML = [[S.data.produtores.length, 'Produtores'], [S.data.fazendas.length, 'Fazendas'], [S.data.talhoes.length, 'Talhões'], [Math.round(area), 'Hectares']]
      .map(([n, l]) => `<div class="kpi"><b>${fmtInt(n)}</b><span>${l}</span></div>`).join('');
  }
  const CHEV = '<svg class="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  function renderTree() {
    const q = ($('#q-mapa').value || '').trim().toLowerCase();
    const m = s => !q || String(s || '').toLowerCase().includes(q);
    let html = '';
    for (const p of S.data.produtores) {
      const fz = (S.fazPorProd.get(key(p.id)) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const pOpen = q || key(S.sel.produtor) === key(p.id);
      let inner = '', any = m(p.nome);
      for (const f of fz) {
        const ts = (S.talPorFaz.get(key(f.id)) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
        const fm = m(f.nome) || m(f.codigo);
        const tsShow = q && !fm && !m(p.nome) ? ts.filter(t => m(t.nome)) : ts;
        if (q && !fm && !m(p.nome) && !tsShow.length) continue;
        any = true;
        const area = ts.reduce((s, t) => s + (Number(t.area_ha) || 0), 0);
        const fOpen = (q && tsShow.length && !fm) || key(S.sel.fazenda) === key(f.id);
        inner += `<details class="f" ${fOpen ? 'open' : ''}><summary data-f="${esc(f.id)}" class="${key(S.sel.fazenda) === key(f.id) && !S.sel.talhao ? 'sel' : ''}">${CHEV}<span class="grow">${esc(f.nome)}</span><span class="muted num">${fmtHa(area)} ha</span></summary>`
          + tsShow.map(t => `<div class="t ${key(S.sel.talhao) === key(t.id) ? 'sel' : ''}" data-t="${esc(t.id)}"><span class="grow">${esc(nomeTal(t))}</span><span class="num">${fmtHa(t.area_ha)}</span></div>`).join('')
          + '</details>';
      }
      if (!any) continue;
      html += `<details class="p" ${pOpen ? 'open' : ''}><summary data-p="${esc(p.id)}" class="${key(S.sel.produtor) === key(p.id) && !S.sel.fazenda ? 'sel' : ''}">${CHEV}<i class="dot" style="background:${S.colors.get(key(p.id))}"></i><span class="grow">${esc(p.nome)}</span><span class="muted num">${fz.length}</span></summary>${inner}</details>`;
    }
    $('#tree').innerHTML = html || '<p class="empty" style="padding:12px 16px">Nada encontrado.</p>';
  }
  function drawSheet() {
    const el = $('#sheet');
    const t = get('talhoes', S.sel.talhao);
    if (!t) { el.hidden = true; return; }
    const f = get('fazendas', t.fazenda_id), p = get('produtores', t._prod);
    const saf = (S.safPorTal.get(key(t.id)) || []).slice().sort((a, b) => (b.safra || '').localeCompare(a.safra || ''));
    const mon = (S.monPorTal.get(key(t.id)) || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 6);
    const ords = S.data.ordens.filter(o => (o.talhao_ids || []).map(key).includes(key(t.id))).sort((a, b) => (b.data_prevista || '').localeCompare(a.data_prevista || '')).slice(0, 6);
    el.hidden = false;
    el.innerHTML = `<header><div class="row"><div><div class="eyebrow">${esc(f ? f.nome : '')}</div><h2>${esc(nomeTal(t))}</h2></div><button class="x" data-act="close" aria-label="Fechar">×</button></div></header>
      <div class="body">
        <dl class="facts"><dt>Área</dt><dd class="num">${fmtHa(t.area_ha)} ha</dd><dt>Produtor</dt><dd>${esc(p ? p.nome : '—')}</dd>
        <dt>Cultura atual</dt><dd>${saf[0] ? esc(saf[0].cultura + ' · ' + saf[0].safra) : '<span class="muted">Sem plantio cadastrado</span>'}</dd>
        ${t.obs ? `<dt>Obs.</dt><dd>${esc(t.obs)}</dd>` : ''}<dt>Código SIMA</dt><dd class="num muted">${/^\d+$/.test(key(t.id)) ? esc(t.id) : '—'}</dd></dl>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-act="edit-tal">Editar talhão</button></div>
        <section class="mini"><div class="sec-title">Safras <button class="btn small" data-act="new-saf">+ Plantio</button></div>
          ${saf.length ? saf.map(s => `<div class="it" data-edit="safras:${esc(s.id)}"><div class="top"><b>${esc(s.cultura)}</b><span class="muted">${esc(s.safra)}</span></div><span class="muted">${esc(s.variedade || '')}${s.data_plantio ? ' · plantio ' + fmtDate(s.data_plantio) : ''}${s.produtividade ? ' · ' + esc(s.produtividade) + ' sc/ha' : ''}</span></div>`).join('') : '<p class="empty">Nenhum plantio cadastrado.</p>'}</section>
        <section class="mini"><div class="sec-title">Monitoramentos <button class="btn small" data-act="new-mon">+ Registrar</button></div>
          ${mon.length ? mon.map(m => `<div class="it" data-edit="monitoramentos:${esc(m.id)}"><div class="top"><b>${esc(m.alvo || m.tipo)}</b><span class="muted">${fmtDate(m.data)}</span></div><span>${m.nivel ? `<span class="pill ${NIVEL_CLS[m.nivel] || ''}">${esc(m.nivel)}</span> ` : ''}<span class="muted">${esc(m.tipo || '')}${m.estadio ? ' · ' + esc(m.estadio) : ''}</span></span></div>`).join('') : '<p class="empty">Nenhum monitoramento.</p>'}</section>
        <section class="mini"><div class="sec-title">Ordens de trabalho <button class="btn small" data-act="new-ord">+ Nova</button></div>
          ${ords.length ? ords.map(o => `<div class="it" data-edit="ordens:${esc(o.id)}"><div class="top"><b>${esc(o.titulo)}</b><span class="pill ${STATUS_CLS[o.status] || ''}">${esc(o.status)}</span></div><span class="muted">${esc(o.tipo || '')} · ${fmtDate(o.data_prevista)}</span></div>`).join('') : '<p class="empty">Nenhuma ordem.</p>'}</section>
      </div>`;
  }

  function viewMapa(entering) {
    initMap();
    renderKpis(); renderTree(); drawSheet();
    if (!map) return;
    if (entering || !S._drawn || S._drawnVersion !== S.version) {
      setTimeout(() => {
        map.invalidateSize();
        drawLayers();
        if (!S._drawn) { const b = boundsOf(S.data.talhoes); if (b) map.fitBounds(b, { padding: [20, 20] }); else map.setView([-19.76, -48.57], 9); }
        else if (entering && (S.sel.talhao || S.sel.fazenda)) fitSel();
        S._drawn = true; S._drawnVersion = S.version;
      }, 0);
    }
  }

  // ---------- Tabelas ----------
  function tablePage(id, opts) {
    const root = $('#v-' + id);
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.innerHTML = `<div class="page"><div class="page-head"><div><h1>${opts.title}</h1><p>${opts.sub}</p></div><button class="btn primary" data-new="${opts.kind}">+ Novo ${esc(NOME[opts.kind])}</button></div>
        <div class="toolbar"><input type="search" id="q-${id}" placeholder="Buscar…" aria-label="Buscar">${opts.filter ? `<select id="f-${id}" aria-label="Filtrar">${opts.filter()}</select>` : ''}<span class="count" id="c-${id}"></span></div>
        <div class="table-wrap"><table><thead><tr>${opts.cols.map(c => `<th class="${c.r ? 'r' : ''}">${c.l}</th>`).join('')}</tr></thead><tbody id="tb-${id}"></tbody></table></div></div>`;
      $('#q-' + id, root).addEventListener('input', () => fill());
      if (opts.filter) $('#f-' + id, root).addEventListener('change', () => fill());
    } else if (opts.filter) {
      const s = $('#f-' + id, root), v = s.value; s.innerHTML = opts.filter(); s.value = v;
    }
    function fill() {
      const q = $('#q-' + id, root).value.trim().toLowerCase();
      const fv = opts.filter ? $('#f-' + id, root).value : '';
      let rows = opts.rows().filter(r => (!q || opts.text(r).toLowerCase().includes(q)) && (!fv || opts.match(r, fv)));
      $('#c-' + id, root).textContent = fmtInt(rows.length) + ' ' + (rows.length === 1 ? 'registro' : 'registros');
      const lim = rows.slice(0, 500);
      $('#tb-' + id, root).innerHTML = lim.map(r => `<tr data-row="${esc(r.id)}">${opts.cols.map(c => `<td class="${c.r ? 'r' : ''}">${c.v(r)}</td>`).join('')}</tr>`).join('')
        + (rows.length > 500 ? `<tr><td colspan="${opts.cols.length}" class="muted">Mostrando 500 de ${fmtInt(rows.length)}. Use a busca para refinar.</td></tr>` : '')
        + (rows.length ? '' : `<tr><td colspan="${opts.cols.length}" class="muted">Nenhum registro.</td></tr>`);
      $('#tb-' + id, root).onclick = e => { const tr = e.target.closest('tr[data-row]'); if (tr) opts.click(tr.dataset.row); };
    }
    fill();
  }
  const prodOpts = () => '<option value="">Todos os produtores</option>' + S.data.produtores.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
  const areaTal = ts => ts.reduce((s, t) => s + (Number(t.area_ha) || 0), 0);

  function viewProdutores() {
    tablePage('produtores', {
      kind: 'produtores', title: 'Produtores', sub: 'Clientes e proprietários das fazendas.',
      rows: () => S.data.produtores, text: r => r.nome + ' ' + (r.documento || ''),
      cols: [
        { l: 'Nome', v: r => `<i class="dot" style="display:inline-block;background:${S.colors.get(key(r.id))};margin-right:6px"></i>${esc(r.nome)}` },
        { l: 'CPF / CNPJ', v: r => esc(r.documento || '—') },
        { l: 'Fazendas', r: 1, v: r => fmtInt((S.fazPorProd.get(key(r.id)) || []).length) },
        { l: 'Talhões', r: 1, v: r => fmtInt((S.fazPorProd.get(key(r.id)) || []).reduce((s, f) => s + (S.talPorFaz.get(key(f.id)) || []).length, 0)) },
        { l: 'Área (ha)', r: 1, v: r => fmtHa((S.fazPorProd.get(key(r.id)) || []).reduce((s, f) => s + areaTal(S.talPorFaz.get(key(f.id)) || []), 0)) },
      ],
      click: id => openForm('produtores', get('produtores', id)),
    });
  }
  function viewFazendas() {
    tablePage('fazendas', {
      kind: 'fazendas', title: 'Fazendas', sub: 'Propriedades e seus talhões. Clique para editar.',
      rows: () => S.data.fazendas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      text: r => r.nome + ' ' + (r.codigo || '') + ' ' + (r.municipio || '') + ' ' + (get('produtores', r.produtor_id)?.nome || ''),
      filter: prodOpts, match: (r, v) => key(r.produtor_id) === v,
      cols: [
        { l: 'Código', v: r => esc(r.codigo || '—') },
        { l: 'Fazenda', v: r => esc(r.nome) },
        { l: 'Produtor', v: r => esc(get('produtores', r.produtor_id)?.nome || '—') },
        { l: 'Município', v: r => esc(r.municipio || '—') },
        { l: 'Talhões', r: 1, v: r => fmtInt((S.talPorFaz.get(key(r.id)) || []).length) },
        { l: 'Área (ha)', r: 1, v: r => fmtHa(areaTal(S.talPorFaz.get(key(r.id)) || []) || r.area_ha) },
        { l: '', v: r => `<button class="btn small" data-map-faz="${esc(r.id)}">Ver no mapa</button>` },
      ],
      click: id => openForm('fazendas', get('fazendas', id)),
    });
  }
  function viewTalhoes() {
    tablePage('talhoes', {
      kind: 'talhoes', title: 'Talhões', sub: 'Áreas de plantio com contorno no mapa.',
      rows: () => S.data.talhoes.slice().sort((a, b) => (get('fazendas', a.fazenda_id)?.nome || '').localeCompare(get('fazendas', b.fazenda_id)?.nome || '', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
      text: r => r.nome + ' ' + (get('fazendas', r.fazenda_id)?.nome || '') + ' ' + (get('produtores', r._prod)?.nome || ''),
      filter: prodOpts, match: (r, v) => key(r._prod) === v,
      cols: [
        { l: 'Talhão', v: r => esc(nomeTal(r)) },
        { l: 'Fazenda', v: r => esc(get('fazendas', r.fazenda_id)?.nome || '—') },
        { l: 'Produtor', v: r => esc(get('produtores', r._prod)?.nome || '—') },
        { l: 'Cultura atual', v: r => { const c = culturaAtual(r); return c ? esc(c.cultura + ' · ' + c.safra) : '<span class="muted">—</span>'; } },
        { l: 'Área (ha)', r: 1, v: r => fmtHa(r.area_ha) },
        { l: 'Contorno', v: r => r.geometry ? '<span class="pill ok">Sim</span>' : '<span class="pill">Não</span>' },
      ],
      click: id => { const t = get('talhoes', id); if (t && t.geometry) { location.hash = 'mapa'; setTimeout(() => selectTalhao(id, true), 60); } else openForm('talhoes', t); },
    });
  }
  function viewSafras() {
    tablePage('safras', {
      kind: 'safras', title: 'Safras', sub: 'O que foi plantado em cada talhão, por safra.',
      rows: () => S.data.safras.slice().sort((a, b) => (b.safra || '').localeCompare(a.safra || '')),
      text: r => [r.safra, r.cultura, r.variedade, nomeTal(get('talhoes', r.talhao_id)), get('fazendas', get('talhoes', r.talhao_id)?.fazenda_id)?.nome].join(' '),
      filter: () => '<option value="">Todas as safras</option>' + [...new Set(S.data.safras.map(s => s.safra))].sort().reverse().map(s => `<option>${esc(s)}</option>`).join(''),
      match: (r, v) => r.safra === v,
      cols: [
        { l: 'Safra', v: r => esc(r.safra) },
        { l: 'Cultura', v: r => `<i class="dot" style="display:inline-block;background:${CULT_COLOR[r.cultura] || '#7f9cf0'};margin-right:6px"></i>${esc(r.cultura)}` },
        { l: 'Variedade', v: r => esc(r.variedade || '—') },
        { l: 'Talhão', v: r => esc(nomeTal(get('talhoes', r.talhao_id))) },
        { l: 'Fazenda', v: r => esc(get('fazendas', get('talhoes', r.talhao_id)?.fazenda_id)?.nome || '—') },
        { l: 'Plantio', v: r => fmtDate(r.data_plantio) },
        { l: 'Colheita', v: r => fmtDate(r.data_colheita) },
        { l: 'sc/ha', r: 1, v: r => esc(r.produtividade ?? '—') },
      ],
      click: id => openForm('safras', get('safras', id)),
    });
  }
  function viewMonitoramentos() {
    tablePage('monitoramentos', {
      kind: 'monitoramentos', title: 'Monitoramentos', sub: 'Visitas de campo: pragas, doenças e estádio da cultura.',
      rows: () => S.data.monitoramentos.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')),
      text: r => [r.tipo, r.alvo, r.responsavel, r.obs, nomeTal(get('talhoes', r.talhao_id)), get('fazendas', get('talhoes', r.talhao_id)?.fazenda_id)?.nome].join(' '),
      filter: () => '<option value="">Todos os níveis</option><option>Alto</option><option>Médio</option><option>Baixo</option>',
      match: (r, v) => r.nivel === v,
      cols: [
        { l: 'Data', v: r => fmtDate(r.data) },
        { l: 'Talhão', v: r => esc(nomeTal(get('talhoes', r.talhao_id))) },
        { l: 'Fazenda', v: r => esc(get('fazendas', get('talhoes', r.talhao_id)?.fazenda_id)?.nome || '—') },
        { l: 'Tipo', v: r => esc(r.tipo || '—') },
        { l: 'Alvo', v: r => esc(r.alvo || '—') },
        { l: 'Nível', v: r => r.nivel ? `<span class="pill ${NIVEL_CLS[r.nivel] || ''}">${esc(r.nivel)}</span>` : '—' },
        { l: 'Responsável', v: r => esc(r.responsavel || '—') },
      ],
      click: id => openForm('monitoramentos', get('monitoramentos', id)),
    });
  }
  function viewOrdens() {
    const root = $('#v-ordens');
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.innerHTML = `<div class="page"><div class="page-head"><div><h1>Ordens de trabalho</h1><p>Pulverizações, plantio, colheita e demais operações, por situação.</p></div><button class="btn primary" data-new="ordens">+ Nova ordem</button></div>
        <div class="toolbar"><input type="search" id="q-ordens" placeholder="Buscar…" aria-label="Buscar ordens"><select id="f-ordens" aria-label="Filtrar por produtor"></select></div><div class="board" id="board"></div></div>`;
      $('#q-ordens').addEventListener('input', viewOrdens);
      $('#f-ordens').addEventListener('change', viewOrdens);
    }
    const s = $('#f-ordens'), v = s.value; s.innerHTML = prodOpts(); s.value = v;
    const q = $('#q-ordens').value.trim().toLowerCase();
    const rows = S.data.ordens.filter(o => {
      const f = get('fazendas', o.fazenda_id);
      if (s.value && key(f?.produtor_id) !== s.value) return false;
      return !q || [o.titulo, o.tipo, o.responsavel, o.insumos, f?.nome].join(' ').toLowerCase().includes(q);
    }).sort((a, b) => (a.data_prevista || '9').localeCompare(b.data_prevista || '9'));
    $('#board').innerHTML = STATUS.map(st => {
      const it = rows.filter(o => (o.status || 'Planejada') === st);
      return `<div class="col"><h3>${esc(st)} <span class="muted num">${it.length}</span></h3>${it.map(o => {
        const f = get('fazendas', o.fazenda_id); const ts = (o.talhao_ids || []).map(id => get('talhoes', id)).filter(Boolean);
        return `<div class="card" data-edit="ordens:${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc(o.tipo || '')} · ${fmtDate(o.data_prevista)}</small><small>${esc(f?.nome || '—')}${ts.length ? ' · ' + ts.length + (ts.length === 1 ? ' talhão' : ' talhões') + ' · ' + fmtHa(areaTal(ts)) + ' ha' : ''}</small></div>`;
      }).join('') || '<p class="empty">Nenhuma.</p>'}</div>`;
    }).join('');
  }

  // ---------- Formulários ----------
  function fazOptions(sel) {
    return '<option value="">Selecione…</option>' + S.data.produtores.map(p => `<optgroup label="${esc(p.nome)}">${(S.fazPorProd.get(key(p.id)) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => `<option value="${esc(f.id)}" ${key(f.id) === key(sel) ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</optgroup>`).join('');
  }
  function talOptions(sel) {
    return '<option value="">Selecione…</option>' + S.data.fazendas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => {
      const ts = (S.talPorFaz.get(key(f.id)) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
      return ts.length ? `<optgroup label="${esc(f.nome)}">${ts.map(t => `<option value="${esc(t.id)}" ${key(t.id) === key(sel) ? 'selected' : ''}>${esc(nomeTal(t))} · ${fmtHa(t.area_ha)} ha</option>`).join('')}</optgroup>` : '';
    }).join('');
  }
  function talChecks(fazId, sel) {
    const ts = (S.talPorFaz.get(key(fazId)) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
    const set = new Set((sel || []).map(key));
    for (const id of set) { const t = get('talhoes', id); if (t && key(t.fazenda_id) !== key(fazId)) ts.push(Object.assign({}, t, { nome: nomeTal(t) + ' (' + (get('fazendas', t.fazenda_id)?.nome || '') + ')' })); }
    return ts.length ? ts.map(t => `<label><input type="checkbox" name="talhao_ids" value="${esc(t.id)}" ${set.has(key(t.id)) ? 'checked' : ''}>${esc(nomeTal(t))}</label>`).join('') : '<span class="muted">Escolha a fazenda primeiro.</span>';
  }
  function fieldHtml(f, v) {
    const id = 'fld-' + f.k, req = f.req ? ' required' : '', ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
    let input;
    switch (f.t) {
      case 'textarea': input = `<textarea id="${id}" name="${f.k}"${ph}${req}>${esc(v)}</textarea>`; break;
      case 'number': input = `<input type="number" step="any" id="${id}" name="${f.k}" value="${esc(v)}"${req}>`; break;
      case 'date': input = `<input type="date" id="${id}" name="${f.k}" value="${esc(v)}"${req}>`; break;
      case 'select': input = `<select id="${id}" name="${f.k}"${req}><option value="">Selecione…</option>${f.opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
      case 'produtor': input = `<select id="${id}" name="${f.k}"${req}><option value="">Selecione…</option>${S.data.produtores.map(p => `<option value="${esc(p.id)}" ${key(p.id) === key(v) ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>`; break;
      case 'fazenda': input = `<select id="${id}" name="${f.k}"${req}>${fazOptions(v)}</select>`; break;
      case 'talhao': input = `<select id="${id}" name="${f.k}"${req}>${talOptions(v)}</select>`; break;
      case 'talhoes': return `<div class="field full" style="display:grid;gap:4px"><span style="font-size:13px;font-weight:500;color:var(--muted)">${f.l}</span><div class="checks" id="${id}">${v}</div></div>`;
      default: input = `<input type="text" id="${id}" name="${f.k}" value="${esc(v)}"${ph}${req}>`;
    }
    return `<label class="field ${f.full ? 'full' : ''}"><span>${f.l}${f.req ? ' <b>*</b>' : ''}</span>${input}</label>`;
  }
  function detalhes(kind, r) {
    const rows = [];
    if (kind === 'monitoramentos') {
      if (r.estado_hidrico) rows.push(['Estado hídrico', esc(r.estado_hidrico)]);
      if (r.estado_talhao) rows.push(['Condição do talhão', esc(r.estado_talhao)]);
      if (r.produtividade_estimada) rows.push(['Produtividade estimada', esc(r.produtividade_estimada.toLocaleString('pt-BR'))]);
      if (r.amostras) rows.push(['Amostras', esc(r.amostras)]);
      if (r.pontos_gps) rows.push(['Pontos GPS / fotos', esc(r.pontos_gps) + ' / ' + esc(r.fotos || 0)]);
      if (r.resultados) rows.push(['Resultados', r.resultados.map(x => `${esc(x.alvo)}: <b class="num">${esc(String(x.valor ?? '—').replace('.', ','))}</b> <span class="muted">${esc(x.medida || '')}</span>${x.nivel ? ` <span class="pill ${NIVEL_CLS[x.nivel] || ''}">${esc(x.nivel)}</span>` : ''}`).join('<br>')]);
    }
    if (kind === 'ordens' && r.produtos) {
      if (r.area_ha) rows.push(['Área da ordem', fmtHa(r.area_ha) + ' ha']);
      rows.push(['Produtos', '<div style="overflow-x:auto"><table style="font-size:12px"><thead><tr><th>Produto</th><th>Classe</th><th class="r">Dose</th><th class="r">Total</th><th class="r">Aplicado</th></tr></thead><tbody>' + r.produtos.map(p => `<tr style="cursor:default"><td>${esc(p.produto)}</td><td>${esc(p.classe || '')}</td><td class="r">${esc(String(p.dose ?? '—').replace('.', ','))} ${esc(p.unidade || '')}</td><td class="r">${esc(String(p.total ?? '—').replace('.', ','))} ${esc(p.unidade_total || '')}</td><td class="r">${p.aplicado_total != null ? esc(String(p.aplicado_total).replace('.', ',')) + ' ' + esc(p.unidade_total || '') : '—'}</td></tr>`).join('') + '</tbody></table></div>']);
    }
    if (!rows.length) return '';
    return `<div style="padding:12px 18px 0;display:grid;gap:8px"><div class="sec-title">Detalhes importados do SIMA</div><dl class="facts" style="font-size:13px">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></div>`;
  }
  function openForm(kind, rec, defaults) {
    const isNew = !rec;
    rec = Object.assign({}, defaults || {}, rec || {});
    const fields = FIELDS[kind];
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle">${isNew ? 'Novo ' : 'Editar '}${esc(NOME[kind])}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
      <form novalidate>${fields.map(f => fieldHtml(f, f.t === 'talhoes' ? talChecks(rec.fazenda_id, rec.talhao_ids) : rec[f.k])).join('')}</form>
      ${detalhes(kind, rec)}
      <footer>${isNew ? '' : '<button class="btn danger" data-del>Excluir</button>'}<div class="right"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar</button></div></footer></div>`;
    document.body.appendChild(bg);
    const form = $('form', bg);
    const fz = $('#fld-fazenda_id', bg), chk = $('#fld-talhao_ids', bg);
    if (fz && chk) fz.addEventListener('change', () => { chk.innerHTML = talChecks(fz.value, []); });
    const close = () => bg.remove();
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-del]')) {
        const b = e.target.closest('[data-del]');
        if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Confirmar exclusão'; return; }
        try { await Store.remove(kind, rec.id); toast('Excluído.'); close(); if (kind === 'talhoes' && key(S.sel.talhao) === key(rec.id)) { S.sel.talhao = null; drawSheet(); } } catch (e) { }
        return;
      }
      if (e.target.closest('[data-save]')) {
        e.preventDefault();
        const out = { id: isNew ? newId() : rec.id };
        if (!isNew) { Object.assign(out, get(kind, rec.id) || {}); delete out._prod; }
        let missing = null;
        for (const f of fields) {
          if (f.t === 'talhoes') { out[f.k] = [...form.querySelectorAll('input[name="talhao_ids"]:checked')].map(i => { const t = get('talhoes', i.value); return t ? t.id : i.value; }); continue; }
          let v = form.elements[f.k].value.trim();
          if (f.req && !v) { missing = missing || f; continue; }
          if (f.t === 'number') v = v === '' ? null : Number(v);
          else if (['produtor', 'fazenda', 'talhao'].includes(f.t)) { const k2 = { produtor: 'produtores', fazenda: 'fazendas', talhao: 'talhoes' }[f.t]; const r = get(k2, v); v = r ? r.id : (v || null); }
          else v = v || null;
          out[f.k] = v;
        }
        if (missing) { toast('Preencha: ' + missing.l); form.elements[missing.k].focus(); return; }
        try { await Store.save(kind, out); toast(isNew ? 'Cadastrado.' : 'Alterações salvas.'); close(); } catch (e) { }
      }
    });
    setTimeout(() => { const first = form.querySelector('input,select,textarea'); if (first) first.focus(); }, 20);
  }

  // ---------- Exportar ----------
  async function exportar() {
    const all = { gerado_em: new Date().toISOString() };
    for (const k of KINDS) all[k] = S.data[k].map(r => { const c = Object.assign({}, r); delete c._prod; return c; });
    const json = JSON.stringify(all);
    const name = 'gleba-dados-' + today() + '.json';
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: name, data: json }); return; }
    } catch (e) { if (e && e.code) { toast('Download cancelado.'); return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
  }

  // ---------- Diversos ----------
  let toastT;
  function toast(msg) { let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 2600); }

  document.addEventListener('click', e => {
    const n = e.target.closest('[data-new]'); if (n) { openForm(n.dataset.new, null, n.dataset.new === 'monitoramentos' ? { data: today() } : n.dataset.new === 'ordens' ? { status: 'Planejada' } : {}); return; }
    const ed = e.target.closest('[data-edit]'); if (ed) { const [k, id] = ed.dataset.edit.split(':'); openForm(k, get(k, id)); return; }
    const mf = e.target.closest('[data-map-faz]'); if (mf) { e.stopPropagation(); location.hash = 'mapa'; setTimeout(() => selectFazenda(mf.dataset.mapFaz, true), 60); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const t = get('talhoes', S.sel.talhao);
      switch (act.dataset.act) {
        case 'close': S.sel.talhao = null; drawSheet(); styleAll(); renderTree(); break;
        case 'edit-tal': openForm('talhoes', t); break;
        case 'new-saf': openForm('safras', null, { talhao_id: t.id }); break;
        case 'new-mon': openForm('monitoramentos', null, { talhao_id: t.id, data: today() }); break;
        case 'new-ord': openForm('ordens', null, { fazenda_id: t.fazenda_id, talhao_ids: [t.id], status: 'Planejada', data_prevista: today() }); break;
        case 'fit-all': S.sel = { produtor: null, fazenda: null, talhao: null }; afterSel(false); { const b = boundsOf(S.data.talhoes); if (b) map.fitBounds(b, { padding: [20, 20] }); } break;
        case 'color': S.colorBy = S.colorBy === 'produtor' ? 'cultura' : 'produtor'; act.textContent = S.colorBy === 'produtor' ? 'Colorir por cultura' : 'Colorir por produtor'; styleAll(); drawLegend(); break;
        case 'export': exportar(); break;
      }
      return;
    }
    const tr = e.target.closest('#tree');
    if (tr) {
      const t = e.target.closest('[data-t]'); if (t) { selectTalhao(t.dataset.t, true); return; }
      const f = e.target.closest('summary[data-f]'); if (f) { setTimeout(() => selectFazenda(f.dataset.f, true), 0); return; }
      const p = e.target.closest('summary[data-p]'); if (p) { setTimeout(() => selectProdutor(p.dataset.p), 0); return; }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('.modal-bg'); if (m) m.remove(); } });
  $('#q-mapa').addEventListener('input', renderTree);
  window.addEventListener('hashchange', route);

  (async function start() {
    await loadBase();
    S.version = 0;
    rebuild();
    route();
    $('#loading').hidden = true;
    await Store.init();
    rebuild(); refresh();
  })();
  const _save = Store.save.bind(Store);
  Store.save = async (k, o) => { S.version = (S.version || 0) + 1; return _save(k, o); };
})();
