/* INOVAAGRO — Vigor dos talhões por satélite (NDVI do Sentinel-2).
   Calcula o NDVI médio de cada talhão (motor em vigor_motor.js), guarda na tabela "vigor" (uma linha por talhão,
   com o histórico das leituras) e mostra: cores no mapa, lista dos talhões que precisam de visita e imagem pixel a pixel.
   Regras pensadas para cana-de-açúcar. */
window.Vigor = (function () {
  'use strict';
  const I = () => window.INOVA, M = () => window.VIGOR_MOTOR;
  const esc = s => I().esc(s), key = v => I().key(v);
  const f2 = v => v == null || isNaN(v) ? '—' : Number(v).toFixed(2).replace('.', ',');
  const fd = d => d ? d.split('-').reverse().join('/') : '';
  const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);

  // Classes de vigor (NDVI médio do talhão)
  const CL = [
    { k: 'solo', l: 'Solo exposto ou cana cortada', curto: 'Solo / cortada', max: 0.30, c: '#a87a4f' },
    { k: 'baixo', l: 'Vigor baixo', curto: 'Baixo', max: 0.45, c: '#d1513b' },
    { k: 'medio', l: 'Vigor médio', curto: 'Médio', max: 0.60, c: '#e2b23b' },
    { k: 'bom', l: 'Vigor bom', curto: 'Bom', max: 0.72, c: '#7cae4c' },
    { k: 'alto', l: 'Vigor alto', curto: 'Alto', max: 9, c: '#1f6b39' },
  ];
  const SEM = { k: 'sem', l: 'Sem leitura de vigor', curto: 'Sem leitura', c: '#9aa39a' };
  const classe = v => v == null || isNaN(v) ? SEM : CL.find(c => v < c.max);
  const LIM_ABAIXO = 0.10, LIM_QUEDA = 0.10; // diferença para pedir visita

  // ---------- Leituras ----------
  const leitura = t => t && I().S.idx.vigor ? I().S.idx.vigor.get(key(t.id)) : null;
  let cacheV = -1, cacheFaz = new Map();
  // média de referência da fazenda: mediana dos talhões lidos até 30 dias antes da leitura mais recente
  function refFaz(fid) {
    if (cacheV !== I().S.version) { cacheV = I().S.version; cacheFaz = new Map(); }
    const k = key(fid); if (cacheFaz.has(k)) return cacheFaz.get(k);
    const ls = (I().S.talPorFaz.get(k) || []).map(leitura).filter(v => v && v.ndvi != null);
    let r = null;
    if (ls.length) {
      const ult = ls.map(v => v.data).sort().pop();
      const vs = ls.filter(v => dias(v.data, ult) <= 30).map(v => v.ndvi).sort((a, b) => a - b);
      r = { mediana: vs[Math.floor(vs.length / 2)], data: ult, n: ls.length };
    }
    cacheFaz.set(k, r); return r;
  }
  function colheitaRecente(t, data) {
    for (const s of I().S.safPorTal.get(key(t.id)) || []) {
      const dc = s.data_colheita; if (!dc) continue;
      const d = dias(dc, data); if (d >= -5 && d <= 90) return dc;
    }
    return null;
  }
  // Situação completa de um talhão
  function info(t) {
    const v = leitura(t);
    if (!v || v.ndvi == null) return { v: null, cl: SEM, alerta: false };
    const cl = classe(v.ndvi), ref = refFaz(t.fazenda_id);
    const delta = v.ant_ndvi != null ? +(v.ndvi - v.ant_ndvi).toFixed(3) : null;
    const abaixo = ref && ref.n >= 3 ? +(ref.mediana - v.ndvi).toFixed(3) : null;
    const colhida = colheitaRecente(t, v.data);
    const corte = !colhida && delta != null && delta <= -0.25 && v.ndvi < 0.35;
    const motivos = [];
    if (abaixo != null && abaixo >= LIM_ABAIXO) motivos.push(f2(abaixo) + ' abaixo da média da fazenda');
    if (delta != null && delta <= -LIM_QUEDA && !corte) motivos.push('caiu ' + f2(-delta) + ' desde ' + fd(v.ant_data));
    const alerta = !colhida && !corte && motivos.length > 0;
    const antiga = dias(v.data, I().today()) > 45;
    return { v, cl, delta, abaixo, ref, colhida, corte, motivos, alerta, antiga };
  }
  // para "Colorir por" do mapa do site
  function grupo(t) { const x = info(t); return x.v ? [x.cl.l, x.cl.c] : [SEM.l, SEM.c]; }
  function alertas(fid) {
    const ts = fid ? I().S.talPorFaz.get(key(fid)) || [] : I().S.data.talhoes;
    return ts.map(t => ({ t, x: info(t) })).filter(o => o.x.alerta).sort((a, b) => (b.x.abaixo || 0) - (a.x.abaixo || 0) || (a.x.v.ndvi - b.x.v.ndvi));
  }
  function resumo(fid) {
    const ts = (I().S.talPorFaz.get(key(fid)) || []).filter(t => t.geometry);
    const cont = new Map(); let ult = null, area = 0, soma = 0;
    for (const t of ts) {
      const x = info(t); cont.set(x.cl.k, (cont.get(x.cl.k) || 0) + 1);
      if (x.v) { if (!ult || x.v.data > ult) ult = x.v.data; const a = Number(t.area_ha) || 1; area += a; soma += a * x.v.ndvi; }
    }
    return { ts, cont, ult, media: area ? soma / area : null, lidos: ts.filter(t => leitura(t)).length };
  }

  // ---------- Atualizar (calcular e salvar) ----------
  const rodando = new Map(); // fazenda -> texto do andamento
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach(f => { try { f(); } catch (e) { } });
  const imagens = new Map(); // fazenda -> {url, bounds, data} (imagem pixel a pixel)
  const CACHE = 'inovaagro-vigor';
  async function guardarImagem(fid, img) {
    imagens.set(key(fid), img);
    try { const c = await caches.open(CACHE); await c.put('/vigor/' + key(fid), new Response(JSON.stringify(img), { headers: { 'content-type': 'application/json' } })); } catch (e) { }
  }
  async function imagem(fid) {
    const k = key(fid); if (imagens.has(k)) return imagens.get(k);
    try { const c = await caches.open(CACHE); const r = await c.match('/vigor/' + k); if (r) { const j = await r.json(); imagens.set(k, j); return j; } } catch (e) { }
    return null;
  }
  async function salvarVarios(lista) {
    const X = I(), S = X.S;
    if (!lista.length) return;
    const agora = new Date().toISOString(), eu = X.SB && X.SB.user ? X.SB.user.email : 'local';
    lista = lista.map(o => Object.assign(o, { atualizado_em: agora, criado_por: o.criado_por || eu }));
    if (X.Store.mode === 'supabase') {
      for (const o of lista) await X.Off.enfileirar('vigor', o);
      for (const o of lista) { const i = S.base.vigor.findIndex(r => key(r.id) === key(o.id)); if (i >= 0) S.base.vigor[i] = o; else S.base.vigor.push(o); }
      S.version = (S.version || 0) + 1; X.rebuild(); X.refresh(); X.sincronizar(false);
    } else if (X.Store.mode === 'nuvem') {
      for (const o of lista) await X.Store.save('vigor', o);
    } else {
      for (const o of lista) S.over.vigor[key(o.id)] = o;
      S.version = (S.version || 0) + 1; X.rebuild(); X.Store.persist(); X.refresh();
    }
  }
  async function atualizar(fid) {
    const X = I(), k = key(fid);
    if (rodando.has(k)) return;
    if (!X.podeEditar()) { X.toast('Seu acesso é só de consulta.'); return; }
    if (!navigator.onLine) { X.toast('Sem internet. O vigor precisa da imagem do satélite.'); return; }
    const f = X.get('fazendas', fid), ts = (X.S.talPorFaz.get(k) || []).filter(t => t.geometry);
    if (!ts.length) { X.toast('Esta fazenda não tem talhões desenhados no mapa.'); return; }
    rodando.set(k, 'Procurando imagens do satélite…'); avisar();
    try {
      const r = await M().calcular(ts, { anterior: true, avisar: s => { rodando.set(k, s); avisar(); } });
      const lista = [];
      for (const t of ts) {
        const n = r.porTalhao.get(String(t.id)); if (!n) continue;
        const velho = leitura(t), a = r.anterior.get(String(t.id));
        let hist = (velho && velho.hist || []).filter(h => h[0] !== n.data);
        if (a && !hist.some(h => h[0] === a.data)) hist.push([a.data, a.ndvi]);
        hist.push([n.data, n.ndvi]); hist.sort((x, y) => x[0].localeCompare(y[0])); hist = hist.slice(-24);
        const ant = hist.filter(h => h[0] < n.data && dias(h[0], n.data) >= 15).pop();
        lista.push({ id: key(t.id), talhao_id: t.id, fazenda_id: t.fazenda_id, data: n.data, ndvi: n.ndvi, p10: n.p10, p90: n.p90, baixo: n.baixo, limpo: n.limpo, cena: n.cena,
          ant_data: ant ? ant[0] : null, ant_ndvi: ant ? ant[1] : null, hist, calculado_em: new Date().toISOString() });
      }
      if (r.imagem) { const img = M().desenhar(r.imagem, ts); if (img) await guardarImagem(k, img); }
      await salvarVarios(lista);
      const al = alertas(k).length, sem = ts.length - lista.length;
      X.toast(lista.length ? `Vigor de ${lista.length} talhões atualizado${al ? ` · ${al} ${al > 1 ? 'precisam' : 'precisa'} de visita` : ''}${sem ? ` · ${sem} sem imagem limpa (nuvem)` : ''}.` : 'As imagens recentes desta fazenda estão cobertas de nuvem. Tente de novo em alguns dias.');
    } catch (e) {
      console.warn('vigor', e);
      X.toast('Não foi possível calcular o vigor agora: ' + (e.message || e));
    } finally { rodando.delete(k); avisar(); }
  }

  // ---------- Pedaços de tela ----------
  const seta = d => d == null ? '' : d >= 0.03 ? `<span class="vg-d up">▲ ${f2(d)}</span>` : d <= -0.03 ? `<span class="vg-d down">▼ ${f2(-d)}</span>` : `<span class="vg-d">= estável</span>`;
  const chip = cl => `<span class="vg-chip" style="--c:${cl.c}"><i></i>${esc(cl.curto)}</span>`;
  // mini gráfico do histórico do NDVI de um talhão
  function grafico(hist, w = 220, h = 46) {
    if (!hist || hist.length < 2) return '';
    const xs = hist.map(p => new Date(p[0]).getTime()), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
    const vs = hist.map(p => p[1]), lo = Math.max(0, Math.min(...vs, 0.45) - 0.08), hi = Math.min(1, Math.max(...vs, 0.45) + 0.08);
    const X = t => 4 + (t - x0) / (x1 - x0 || 1) * (w - 8), Y = v => h - 4 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (h - 8);
    const pts = hist.map((p, i) => [X(xs[i]), Y(p[1])]);
    return `<div class="vg-graf-w"><svg class="vg-graf" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="Histórico do vigor"><line x1="0" x2="${w}" y1="${Y(0.45)}" y2="${Y(0.45)}" class="vg-ref"/><polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/>${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" style="fill:${classe(hist[i][1]).c}"><title>${fd(hist[i][0])}: ${f2(hist[i][1])}</title></circle>`).join('')}</svg><div class="vg-graf-x"><span>${fd(hist[0][0])} · ${f2(hist[0][1])}</span><span>${fd(hist[hist.length - 1][0])} · ${f2(hist[hist.length - 1][1])}</span></div></div>`;
  }
  // linha curta para fichas de talhão
  function linhaTalhao(t) {
    const x = info(t);
    if (!x.v) return `<span class="vg-sem">Sem leitura de vigor</span>`;
    return `${chip(x.cl)} <b class="num">${f2(x.v.ndvi)}</b> ${seta(x.delta)} <span class="muted">· imagem de ${fd(x.v.data)}</span>${x.alerta ? ` <span class="vg-alerta">Ver no campo</span>` : ''}`;
  }
  function blocoTalhao(t) {
    const x = info(t);
    if (!x.v) return '';
    return `<div class="vg-bloco"><div class="vg-bl-l">${chip(x.cl)}<b class="num">${f2(x.v.ndvi)}</b>${seta(x.delta)}</div>
      <div class="vg-bl-t">NDVI médio na imagem de ${fd(x.v.data)}${x.ref && x.ref.n >= 3 ? ` · média da fazenda ${f2(x.ref.mediana)}` : ''}${x.v.baixo >= 0.1 && x.v.baixo <= 0.8 ? ` · ${Math.round(x.v.baixo * 100)}% da área com vigor baixo (manchas)` : ''}</div>
      ${x.alerta ? `<div class="vg-bl-a"><b>Precisa de visita:</b> ${esc(x.motivos.join(' e '))}.</div>` : x.colhida ? `<div class="vg-bl-t">Colhida em ${fd(x.colhida)}: vigor baixo esperado.</div>` : x.corte ? `<div class="vg-bl-t">Queda forte: provável colheita ou corte.</div>` : ''}
      ${grafico(x.v.hist)}</div>`;
  }
  function legenda() {
    return `<div class="vg-leg">${CL.slice().reverse().map(c => `<span><i style="background:${c.c}"></i>${esc(c.curto)}</span>`).join('')}</div>`;
  }
  // Painel da fazenda (site e celular)
  function painel(fid, opts = {}) {
    const X = I(), f = X.get('fazendas', fid);
    if (!f) return `<p class="muted">Escolha uma fazenda para ver o vigor dos talhões.</p>`;
    const k = key(fid), r = resumo(fid), al = alertas(fid), and = rodando.get(k);
    const pode = X.podeEditar();
    const falta = X.S.faltaVigor ? `<p class="vg-aviso"><b>Falta um passo para salvar na nuvem.</b> O administrador precisa rodar uma vez o arquivo <code>supabase/07_vigor.sql</code> no Supabase. Até lá o vigor fica só neste aparelho.</p>` : '';
    const barra = r.ts.length ? `<div class="vg-barra" aria-label="Talhões por classe de vigor">${[...CL, SEM].map(c => { const n = r.cont.get(c.k) || 0; return n ? `<i style="flex:${n};background:${c.c}" title="${esc(c.l)}: ${n}"></i>` : ''; }).join('')}</div>
      <div class="vg-cont">${[...CL].reverse().concat([SEM]).filter(c => r.cont.get(c.k)).map(c => `<span><i style="background:${c.c}"></i>${esc(c.curto)} <b>${r.cont.get(c.k)}</b></span>`).join('')}</div>` : '';
    return `<div class="vg-pan ${opts.cls || ''}">
      <div class="vg-top"><div><div class="vg-eyebrow">Vigor por satélite</div><div class="vg-tit">${r.ult ? `Imagem de ${fd(r.ult)}` : 'Ainda sem leitura'}</div>
        <div class="vg-sub">${r.media != null ? `NDVI médio <b class="num">${f2(r.media)}</b> · ` : ''}${r.lidos} de ${r.ts.length} talhões lidos</div></div>
        ${pode ? `<button class="${opts.btn || 'btn small primary'}" data-vg="atualizar" data-faz="${esc(fid)}" ${and ? 'disabled' : ''}>${and ? 'Calculando…' : r.ult ? 'Atualizar' : 'Calcular vigor'}</button>` : ''}</div>
      ${and ? `<div class="vg-and"><span class="vg-spin"></span>${esc(and)}</div>` : ''}
      ${falta}${barra}
      ${r.ult ? `<div class="vg-al-h">${al.length ? `Precisam de visita <b>${al.length}</b>` : 'Nenhum talhão fora do normal'}</div>
      ${al.length ? `<ul class="vg-al">${al.slice(0, opts.max || 8).map(({ t, x }) => `<li><button data-vg="talhao" data-id="${esc(t.id)}"><span class="vg-al-n"><b>${esc(I().nomeTal(t))}</b><small>${esc(x.motivos.join(' · '))}</small></span><span class="vg-al-v" style="--c:${x.cl.c}"><b class="num">${f2(x.v.ndvi)}</b>${seta(x.delta)}</span></button>${opts.agendar && window.Agenda ? `<button class="vg-ag" data-vg="agendar" data-id="${esc(t.id)}" title="Agendar visita" aria-label="Agendar visita em ${esc(t.nome)}">Agendar</button>` : ''}</li>`).join('')}</ul>${al.length > (opts.max || 8) ? `<p class="muted vg-mais">e mais ${al.length - (opts.max || 8)}</p>` : ''}` : `<p class="vg-ok">Os talhões estão parecidos com a média da fazenda e não tiveram queda desde a imagem anterior.</p>`}` :
      `<p class="vg-intro">O app busca a imagem mais recente do satélite Sentinel-2 sem nuvem sobre cada talhão (gratuita, a cada 5 dias) e calcula o NDVI, que mede o verde da cana. Mostra os talhões bem abaixo da média da fazenda ou que caíram desde a imagem anterior.</p>`}
      <details class="vg-como"><summary>Como ler</summary>${legenda()}<p>NDVI vai de 0 (solo) a 1 (cana fechada e vigorosa). <b>Precisa de visita</b>: talhão 0,10 ou mais abaixo da média da fazenda, ou que caiu 0,10 desde a imagem anterior. Talhões colhidos nos últimos 90 dias (data de colheita no plantio) e quedas fortes para solo exposto (provável corte) não entram no alerta. Talhão coberto por nuvem fica com a leitura anterior.</p></details>
    </div>`;
  }
  // monta o painel num elemento e o mantém atualizado enquanto calcula
  function montar(el, fid, opts = {}) {
    if (!el) return;
    el.dataset.vgPan = key(fid); el._vgOpts = opts;
    el.innerHTML = painel(fid, opts);
  }
  ouvintesPadrao();
  function ouvintesPadrao() {
    ouvintes.add(() => document.querySelectorAll('[data-vg-pan]').forEach(el => { el.innerHTML = painel(el.dataset.vgPan, el._vgOpts || {}); }));
  }
  // cliques dos painéis (site e celular)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-vg]'); if (!b) return;
    const a = b.dataset.vg;
    if (a === 'atualizar') { e.preventDefault(); atualizar(b.dataset.faz); }
    else if (a === 'agendar') { e.preventDefault(); agendar(b.dataset.id); }
    else if (a === 'talhao') { e.preventDefault(); if (typeof api.aoTalhao === 'function') api.aoTalhao(b.dataset.id, b); }
  });
  // agendar visita a partir do alerta (abre a agenda com a fazenda e o talhão já escolhidos)
  function agendar(tid) {
    const t = I().get('talhoes', tid); if (!t) return;
    if (window.Agenda && window.Agenda.novo) window.Agenda.novo({ fazenda_id: t.fazenda_id, talhao_ids: [String(t.id)], objetivo: 'Acompanhamento da lavoura', obs: 'Vigor baixo no satélite: ' + info(t).motivos.join(' e ') });
    else location.hash = 'agenda';
  }

  const api = { montar, aoTalhao(id) {
    const h = location.hash;
    if (h === '#campo' && window.Campo && window.Campo.irTalhao) window.Campo.irTalhao(id);
    else if (h === '#satelite') I().satTalhao(id);
    else I().selectTalhao(id, true);
  }, CL, SEM, classe, info, grupo, alertas, resumo, atualizar, rodando, ouvir: f => { ouvintes.add(f); return () => ouvintes.delete(f); }, imagem, painel, linhaTalhao, blocoTalhao, legenda, agendar, grafico, f2, fd };
  return api;
})();
