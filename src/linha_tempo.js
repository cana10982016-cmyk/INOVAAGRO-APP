/* INOVAAGRO — Histórico do talhão: linha do tempo de cada safra com visitas e pragas, aplicações, chuva,
   colheita e produtividade (TCH/ATR). A safra de cada registro vem da data (abril a março). */
window.LinhaTempo = (function () {
  'use strict';
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => I().esc(s);
  const S = () => I().S;
  const k = id => String(id);
  const n = v => Number(v) || 0;
  const nv = v => v === '' || v == null || !isFinite(Number(v)) || Number(v) <= 0 ? null : Number(v);
  const f1 = v => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f0 = v => Math.round(v || 0).toLocaleString('pt-BR');
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEM = { verde: '#16a34a', amarelo: '#d97706', vermelho: '#dc2626' };
  const CLS = ['ok', 'warn', 'bad'], CLT = ['Abaixo', 'Atenção', 'Controle'];
  const LS = 'inovaagro.linhatempo.v1';
  const T = { faz: '', tal: '', abertas: {} };
  try { Object.assign(T, JSON.parse(localStorage.getItem(LS) || '{}'), { abertas: {} }); } catch (e) { }
  const salvar = () => { try { localStorage.setItem(LS, JSON.stringify({ faz: T.faz, tal: T.tal })); } catch (e) { } };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    visita: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    aplic: '<path d="M4 6h10l3 3v3H4z"/><path d="M6 15v1M10 15v2M14 15v1M8 18v1M12 18v2"/>',
    chuva: '<path d="M7 15a4 4 0 1 1 1.6-7.7A5 5 0 0 1 18 9a3 3 0 0 1 0 6z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    colheita: '<path d="M12 21V8"/><path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5zM12 8c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
    plantio: '<path d="M12 21V11"/><path d="M12 11c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 14c0-3-2-5-7-5 0 4 2 5 7 5z"/>',
    controle: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  };

  function abrir(tid) { const t = I().get('talhoes', tid); if (!t) return; T.tal = k(t.id); T.faz = k(t.fazenda_id); salvar(); if (location.hash === '#linhatempo') render(); else location.hash = 'linhatempo'; }

  // ---------- Montagem dos dados ----------
  function dados(t) {
    const sp = d => I().safraPorData(d);
    const CN = window.CANA, aj = ((I().get('config', 'niveis_cana') || {}).itens) || {};
    const plantios = (S().safPorTal.get(k(t.id)) || []);
    const safras = new Map();
    const sf = nome => { if (!nome) return null; if (!safras.has(nome)) safras.set(nome, { nome, ev: [], s: null, chuva: 0, chuvaMes: new Map(), vis: 0, apl: 0, verm: 0 }); return safras.get(nome); };
    for (const s of plantios) { const x = sf(s.safra); if (!x) continue; if (!x.s || (s.data_plantio || '') > (x.s.data_plantio || '')) x.s = s;
      if (s.data_plantio && sp(s.data_plantio) === s.safra) x.ev.push({ d: s.data_plantio, tipo: 'plantio', t: 'Plantio' + (s.variedade ? ' · ' + s.variedade : ''), sub: s.corte || s.epoca || '' });
      if (s.data_colheita) x.ev.push({ d: s.data_colheita, tipo: 'colheita', t: 'Colheita', sub: [nv(s.produtividade) ? 'TCH ' + f1(nv(s.produtividade)) + ' t/ha' : '', nv(s.atr) ? 'ATR ' + f1(nv(s.atr)) + ' kg/t' : ''].filter(Boolean).join(' · ') || 'Produtividade não lançada' }); }
    for (const m of S().monPorTal.get(k(t.id)) || []) {
      const x = sf(sp(m.data)); if (!x) continue; x.vis++;
      const sem = I().semaforo(m); if (sem === 'vermelho') x.verm++;
      const g = new Map();
      for (const a of m.amostras_detalhe || []) { if (a.valor == null || a.valor === '' || !isFinite(+a.valor)) continue; const it = CN && CN.daAmostra(a); const id = it ? it.id : (a.alvo || ''); if (!id) continue; const y = g.get(id) || { nome: it ? it.nome : a.alvo, un: it ? it.un : '', it, v: [] }; y.v.push(+a.valor); g.set(id, y); }
      const pr = [...g.values()].map(y => { const med = y.v.reduce((a, b) => a + b, 0) / y.v.length; return { nome: y.nome, un: y.un, med, cl: y.it ? CN.classe(y.it, med, aj) : null }; });
      const rc = m.recomendacao && (m.recomendacao.produtos || []).length ? m.recomendacao.produtos.map(p => p.produto + (p.dose != null ? ' ' + String(p.dose).replace('.', ',') + ' ' + (p.unidade || '') : '')).join(' + ') : '';
      x.ev.push({ d: m.data || '', tipo: 'visita', t: 'Visita' + (m.alvo ? ' · ' + m.alvo : ''), sub: [m.estadio, m.responsavel ? (I().nomeDe ? I().nomeDe(m.responsavel) : String(m.responsavel)).split('@')[0] : ''].filter(Boolean).join(' · '), sem, pr, rc, obs: m.obs, go: 'monitoramentos:' + m.id });
    }
    for (const o of S().ordPorTal.get(k(t.id)) || []) {
      if (o.status === 'Cancelada') continue; const d = I().dataCusto(o); const x = sf(sp(d)); if (!x) continue; x.apl++;
      x.ev.push({ d, tipo: 'aplic', t: o.titulo || o.tipo || 'Ordem', sub: (o.status || 'Planejada') + (o.tipo ? ' · ' + o.tipo : ''), prods: (o.produtos || []).map(p => p.produto + (p.dose != null ? ' ' + String(p.dose).replace('.', ',') + ' ' + (p.unidade || '') : '')), st: o.status, go: 'ordens:' + o.id });
    }
    for (const kk of ['controles', 'avancos']) for (const a of S().data[kk] || []) { if (k(a.talhao_id) !== k(t.id)) continue; const x = sf(sp(a.data)); if (!x) continue; x.ev.push({ d: a.data || '', tipo: 'controle', t: (kk === 'avancos' ? 'Avanço · ' : '') + (a.tipo || 'Controle'), sub: a.valor != null ? String(a.valor).replace('.', ',') + ' ' + (a.unidade || '') : (a.obs || ''), go: kk + ':' + a.id }); }
    // chuva: pluviômetros da fazenda, média entre eles por dia, somada por mês
    const pluvs = new Set((S().data.pluviometros || []).filter(p => k(p.fazenda_id) === k(t.fazenda_id)).map(p => k(p.id)));
    const dia = new Map();
    for (const c of S().data.chuvas || []) { if (!pluvs.has(k(c.pluviometro_id)) || !c.data) continue; const dd = c.data.slice(0, 10), v = dia.get(dd) || []; v.push(n(c.mm)); dia.set(dd, v); }
    for (const [dd, v] of dia) { const mm = v.reduce((a, b) => a + b, 0) / v.length; const x = safras.get(sp(dd)); if (!x) continue; x.chuva += mm; const mk = dd.slice(0, 7); x.chuvaMes.set(mk, (x.chuvaMes.get(mk) || 0) + mm); }
    for (const x of safras.values()) for (const [mk, mm] of x.chuvaMes) if (mm > 0) x.ev.push({ d: mk + '-28', tipo: 'chuva', t: 'Chuva de ' + MES[+mk.slice(5) - 1], sub: f0(mm) + ' mm no mês', mes: true });
    for (const x of safras.values()) x.ev.sort((a, b) => String(b.d).localeCompare(String(a.d)) || (a.mes ? -1 : 1));
    return { safras: [...safras.values()].sort((a, b) => b.nome.localeCompare(a.nome)), temPluv: pluvs.size > 0 };
  }

  // ---------- Tela ----------
  let root = null;
  function view() {
    root = $('#v-linhatempo'); if (!root) return;
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.addEventListener('change', e => { const f = e.target.dataset.lt; if (!f) return; T[f] = e.target.value; if (f === 'faz') T.tal = ''; salvar(); render(); });
      root.addEventListener('click', e => {
        const g = e.target.closest('[data-lt-go]'); if (g) { const [kk, id] = g.dataset.ltGo.split(':'); const r = I().get(kk, id); if (r) I().openForm(kk, r); return; }
        const s = e.target.closest('[data-lt-sf]'); if (s) { T.abertas[s.dataset.ltSf] = !aberta(s.dataset.ltSf); render(); return; }
        if (e.target.closest('[data-lt-campo]')) { location.hash = 'campo'; }
      });
    }
    render();
  }
  let primeiraSafra = null;
  const aberta = nome => T.abertas[nome] != null ? T.abertas[nome] : nome === primeiraSafra;
  function render() {
    if (!root) return;
    const fazs = S().data.fazendas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    if (!T.faz || !I().get('fazendas', T.faz)) T.faz = fazs[0] ? k(fazs[0].id) : '';
    const tals = (S().talPorFaz.get(T.faz) || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
    if (!T.tal || !tals.some(t => k(t.id) === T.tal)) T.tal = tals[0] ? k(tals[0].id) : '';
    const t = I().get('talhoes', T.tal), f = I().get('fazendas', T.faz), cel = matchMedia('(max-width: 760px)').matches;
    let corpo = '<p class="empty">Escolha um talhão.</p>';
    if (t) {
      const D = dados(t); primeiraSafra = D.safras[0] ? D.safras[0].nome : null;
      const comP = D.safras.filter(x => x.s && nv(x.s.produtividade)).slice(0, 6).reverse();
      const ult = D.safras.find(x => x.s && nv(x.s.produtividade)), ant = ult && D.safras.find(x => x !== ult && x.nome < ult.nome && x.s && nv(x.s.produtividade));
      const c = I().culturaAtual(t);
      const chip = (a, b) => a && b ? `<span class="chip-d ${a >= b ? 'up' : 'dn'}">${a >= b ? '▲' : '▼'} ${Math.abs((a - b) / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>` : '';
      const mx = Math.max(1, ...comP.map(x => nv(x.s.produtividade)));
      corpo = `<section class="card-box lt-head"><div class="lt-tit"><h3>${esc(I().nomeTal(t))}</h3><p class="muted">${esc(f?.nome || '')} · ${I().fmtHa(t.area_ha)} ha${c ? ' · ' + esc([c.variedade, c.corte].filter(Boolean).join(' · ')) : ''}</p></div>
        <div class="lt-kpis">
          <div><span>TCH ${ult ? esc(ult.nome) : ''}</span><b>${ult ? f1(nv(ult.s.produtividade)) : '—'}</b><small>t/ha ${ant ? chip(nv(ult.s.produtividade), nv(ant.s.produtividade)) : ''}</small></div>
          <div><span>ATR ${ult ? esc(ult.nome) : ''}</span><b>${ult && nv(ult.s.atr) ? f1(nv(ult.s.atr)) : '—'}</b><small>kg/t ${ant && nv(ult.s.atr) ? chip(nv(ult.s.atr), nv(ant.s.atr)) : ''}</small></div>
          <div><span>Visitas</span><b>${D.safras.reduce((a, x) => a + x.vis, 0)}</b><small>${D.safras.reduce((a, x) => a + x.verm, 0)} em vermelho</small></div>
          <div><span>Aplicações</span><b>${D.safras.reduce((a, x) => a + x.apl, 0)}</b><small>em ${D.safras.length} safra(s)</small></div>
        </div>
        ${comP.length > 1 ? `<div class="lt-spark" role="img" aria-label="TCH por safra">${comP.map(x => `<div title="${esc(x.nome)}: ${f1(nv(x.s.produtividade))} t/ha"><b>${f1(nv(x.s.produtividade))}</b><i style="height:${(nv(x.s.produtividade) / mx * 100).toFixed(0)}%"></i><span>${esc(x.nome)}</span></div>`).join('')}</div>` : ''}</section>
        ${D.safras.length ? D.safras.map(x => safraHtml(x, D)).join('') : '<div class="note">Este talhão ainda não tem visitas, aplicações nem safras registradas.</div>'}`;
    }
    root.innerHTML = `<div class="page lt"><div class="page-head"><div><h2>Histórico do talhão</h2><p>Linha do tempo de cada safra: pragas, aplicações, chuva e produtividade.</p></div>${cel ? '<div class="head-acts"><button class="btn" data-lt-campo>Voltar ao campo</button></div>' : ''}</div>
      <div class="pd-filtros"><label class="field"><span>Fazenda</span><select data-lt="faz">${fazs.map(x => `<option value="${esc(x.id)}" ${k(x.id) === T.faz ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Talhão</span><select data-lt="tal">${tals.map(x => `<option value="${esc(x.id)}" ${k(x.id) === T.tal ? 'selected' : ''}>${esc(I().nomeTal(x))} · ${I().fmtHa(x.area_ha)} ha</option>`).join('')}</select></label></div>
      ${corpo}</div>`;
  }
  function safraHtml(x, D) {
    const s = x.s, tch = s && nv(s.produtividade), atr = s && nv(s.atr), ab = aberta(x.nome);
    return `<section class="card-box lt-sf ${ab ? 'on' : ''}"><button class="lt-sfh" data-lt-sf="${esc(x.nome)}" aria-expanded="${ab}">
        <div><b>Safra ${esc(x.nome)}</b><span>${esc([s?.corte, s?.variedade].filter(Boolean).join(' · ') || 'Cana-de-açúcar')}</span></div>
        <div class="lt-chips"><span title="TCH"><small>TCH</small><em>${tch ? f1(tch) : '—'}</em></span><span title="ATR"><small>ATR</small><em>${atr ? f1(atr) : '—'}</em></span><span title="Chuva na safra"><small>Chuva</small><em>${D.temPluv ? f0(x.chuva) + ' mm' : '—'}</em></span><span title="Visitas${x.verm ? ' (' + x.verm + ' em vermelho)' : ''}"><small>Visitas</small><em>${x.vis}${x.verm ? `<i class="lt-dot" style="background:${SEM.vermelho}"></i>${x.verm}` : ''}</em></span><span><small>Aplic.</small><em>${x.apl}</em></span></div>
        <svg class="lt-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      ${ab ? `<ol class="lt-tl">${x.ev.map(ev => `<li class="lt-ev lt-${ev.tipo}" ${ev.go ? `data-lt-go="${esc(ev.go)}" tabindex="0"` : ''}>
          <span class="lt-ic" ${ev.sem ? `style="--c:${SEM[ev.sem]}"` : ''}>${svg(IC[ev.tipo] || IC.controle)}</span>
          <div class="lt-c"><div class="lt-l1"><b>${esc(ev.t)}</b><time>${ev.mes ? '' : I().fmtDate(ev.d)}</time></div>
            ${ev.sub ? `<p class="muted">${esc(ev.sub)}</p>` : ''}
            ${ev.pr && ev.pr.length ? `<div class="lt-pr">${ev.pr.map(p => `<span class="pill ${p.cl != null ? CLS[p.cl] : ''}" title="${esc(p.un)}">${esc(p.nome)}: <b class="num">${f1(p.med)}</b>${p.cl != null ? ' · ' + CLT[p.cl] : ''}</span>`).join('')}</div>` : ''}
            ${ev.rc ? `<p class="lt-rc">Recomendado: ${esc(ev.rc)}</p>` : ''}
            ${ev.prods && ev.prods.length ? `<p class="lt-rc">${esc(ev.prods.join(' + '))}</p>` : ''}</div></li>`).join('') || '<li class="empty">Sem registros nesta safra.</li>'}</ol>` : ''}</section>`;
  }

  if (window.INOVA) {
    I().VIEWS.linhatempo = view;
    document.addEventListener('inova:dados', () => { if (root && !root.hidden && document.body.contains(root)) render(); });
  }
  return { view, abrir, dados };
})();
