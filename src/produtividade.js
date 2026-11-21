/* INOVAAGRO — Produtividade da cana: TCH (t de cana/ha) e ATR (kg de açúcar/t) por talhão, safra a safra.
   Os valores ficam no próprio plantio (tabela safras): "produtividade" = TCH e "atr" = ATR.
   Assim a tela Comparar safras e os relatórios já enxergam o TCH lançado aqui. */
window.Produtividade = (function () {
  'use strict';
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => I().esc(s);
  const nv = v => v === '' || v == null || !isFinite(Number(v)) || Number(v) <= 0 ? null : Number(v);
  const f1 = v => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
  const f2 = v => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const LS = 'inovaagro.produtividade.v1';
  const P = { aba: 'lancar', prod: '', faz: '', safra: '' };
  try { Object.assign(P, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem(LS, JSON.stringify(P)); } catch (e) { } };
  const S = () => I().S;
  const CORTES = () => window.CANA ? window.CANA.CORTES : ['Cana-planta (ano e meio)', 'Cana-planta (ano)', '1º corte', '2º corte', '3º corte', '4º corte', '5º corte', '6º corte ou mais'];

  function safras() {
    const s = new Set(S().data.safras.map(x => x.safra).filter(Boolean));
    s.add(I().safraPorData(I().today()));
    return [...s].sort().reverse();
  }
  const anterior = sf => { const [a] = String(sf).split('/'); const y = +a - 1; return isFinite(y) ? y + '/' + String(y + 1).slice(2) : ''; };
  function fazendas() {
    let l = P.prod ? (S().fazPorProd.get(P.prod) || []) : S().data.fazendas;
    return l.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }
  function talhoes() {
    const fz = P.faz ? fazendas().filter(f => String(f.id) === P.faz) : fazendas();
    const out = [];
    for (const f of fz) for (const t of (S().talPorFaz.get(String(f.id)) || [])) out.push(t);
    return out.sort((a, b) => String(I().get('fazendas', a.fazenda_id)?.nome || '').localeCompare(String(I().get('fazendas', b.fazenda_id)?.nome || ''), 'pt-BR') || String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
  }
  const plantio = (t, sf) => (S().safPorTal.get(String(t.id)) || []).filter(x => x.safra === sf).sort((a, b) => (b.data_plantio || '').localeCompare(a.data_plantio || ''))[0] || null;
  const area = (s, t) => nv(s && s.area_ha) || nv(t.area_ha) || 0;
  // médias ponderadas: TCH pela área, ATR pela produção
  function resumo(lista) {
    let ar = 0, arT = 0, tc = 0, prodA = 0, atr = 0, n = 0;
    for (const { s, t } of lista) {
      const a = area(s, t); ar += a;
      const tch = nv(s && s.produtividade), at = nv(s && s.atr);
      if (tch) { arT += a; tc += tch * a; n++; if (at) { prodA += tch * a; atr += at * tch * a; } }
    }
    const TCH = arT ? tc / arT : null, ATR = prodA ? atr / prodA : null;
    return { area: ar, areaLanc: arT, TCH, ATR, TAH: TCH && ATR ? TCH * ATR / 1000 : null, producao: tc, n };
  }

  let root = null;
  function view() {
    root = $('#v-produtividade'); if (!root) return;
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.addEventListener('change', mudou);
      root.addEventListener('click', clique);
    }
    render();
  }
  function render() {
    if (!root) return;
    const sl = safras(); if (!sl.includes(P.safra)) P.safra = [...new Set(S().data.safras.map(x => x.safra).filter(Boolean))].sort().reverse()[0] || sl[0];
    if (P.prod && !I().get('produtores', P.prod)) P.prod = '';
    if (P.faz && !fazendas().some(f => String(f.id) === P.faz)) P.faz = '';
    const ed = I().podeEditar();
    root.innerHTML = `<div class="page pd"><div class="page-head"><div><h2>Produtividade da cana</h2><p>TCH (toneladas de cana por hectare) e ATR (kg de açúcar por tonelada) de cada talhão, safra a safra.</p></div>
      <div class="head-acts"><button class="btn" data-pd-xls>${I().icon('xls')} Excel</button></div></div>
      <div class="pd-filtros">
        <label class="field"><span>Cliente</span><select data-pd="prod"><option value="">Todos os clientes</option>${S().data.produtores.map(p => `<option value="${esc(p.id)}" ${String(p.id) === P.prod ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Fazenda</span><select data-pd="faz"><option value="">Todas as fazendas</option>${fazendas().map(f => `<option value="${esc(f.id)}" ${String(f.id) === P.faz ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Safra</span><select data-pd="safra">${sl.map(s => `<option ${s === P.safra ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      </div>
      <div class="tabs" role="tablist"><button role="tab" data-pd-aba="lancar" aria-selected="${P.aba === 'lancar'}">Lançar ${esc(P.safra)}</button><button role="tab" data-pd-aba="comparar" aria-selected="${P.aba === 'comparar'}">Comparar safras</button></div>
      <div class="an-body">${P.aba === 'comparar' ? comparar() : lancar(ed)}</div></div>`;
  }

  function tiles(r, ra) {
    const d = (a, b) => a != null && b ? `<span class="chip-d ${a >= b ? 'up' : 'dn'}">${a >= b ? '▲' : '▼'} ${Math.abs((a - b) / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>` : '';
    const ant = anterior(P.safra);
    return `<div class="tiles">${[
      ['TCH médio', f1(r.TCH), 't de cana por ha', d(r.TCH, ra.TCH)],
      ['ATR médio', f1(r.ATR), 'kg de açúcar por t', d(r.ATR, ra.ATR)],
      ['TAH', f2(r.TAH), 't de açúcar por ha', d(r.TAH, ra.TAH)],
      ['Cana colhida', r.producao ? f0(r.producao) : '—', 't · ' + I().fmtHa0(r.areaLanc) + ' de ' + I().fmtHa0(r.area) + ' ha lançados', ''],
    ].map(([l, v, s, c]) => `<div class="tile"><span class="lbl">${l}</span><span class="val num">${v}</span><span class="sub">${s}${c ? ' ' + c + ` <span class="muted">vs ${esc(ant)}</span>` : ''}</span></div>`).join('')}</div>`;
  }

  function lancar(ed) {
    const ts = talhoes(), ant = anterior(P.safra);
    const linhas = ts.map(t => ({ t, s: plantio(t, P.safra), a: plantio(t, ant) }));
    const r = resumo(linhas), ra = resumo(linhas.map(x => ({ t: x.t, s: x.a })));
    if (!ts.length) return '<p class="empty">Nenhum talhão para este filtro.</p>';
    const lim = 400;
    return `${tiles(r, ra)}
      ${ed ? '<p class="muted pd-dica">Digite o TCH e o ATR na tabela. Salva sozinho ao sair do campo e funciona sem internet. O TAH e a produção são calculados.</p>' : ''}
      <div class="table-wrap pd-tab"><table><thead><tr><th>Talhão</th><th>Corte</th><th class="r">Área (ha)</th><th>Colheita</th><th class="r">TCH (t/ha)</th><th class="r">ATR (kg/t)</th><th class="r">TAH</th><th class="r">Produção (t)</th><th class="r">TCH ${esc(ant)}</th></tr></thead><tbody>
      ${linhas.slice(0, lim).map(({ t, s, a }) => {
        const tch = nv(s && s.produtividade), atr = nv(s && s.atr), ar = area(s, t), tA = nv(a && a.produtividade);
        const fz = I().get('fazendas', t.fazenda_id);
        const inp = (k, v, ph, step) => ed ? `<input type="number" inputmode="decimal" step="${step}" min="0" class="pd-in" data-k="${k}" value="${v ?? ''}" placeholder="${ph}" aria-label="${k} de ${esc(t.nome)}">` : (v == null ? '—' : esc(String(v).replace('.', ',')));
        return `<tr data-t="${esc(t.id)}"><td data-l="Talhão"><b>${esc(I().nomeTal(t))}</b><br><small class="muted">${esc(fz?.nome || '')}${s && s.variedade ? ' · ' + esc(s.variedade) : ''}</small></td>
          <td data-l="Corte">${ed ? `<select class="pd-in" data-k="corte" aria-label="Corte"><option value=""></option>${CORTES().map(c => `<option ${s && s.corte === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : esc(s?.corte || '—')}</td>
          <td class="r" data-l="Área">${I().fmtHa(ar)}</td>
          <td data-l="Colheita">${ed ? `<input type="date" class="pd-in" data-k="data_colheita" value="${esc(s?.data_colheita || '')}" aria-label="Data da colheita">` : I().fmtDate(s?.data_colheita)}</td>
          <td class="r" data-l="TCH">${inp('produtividade', tch, '0,0', '0.1')}</td>
          <td class="r" data-l="ATR">${inp('atr', atr, '0,0', '0.1')}</td>
          <td class="r num" data-l="TAH">${tch && atr ? f2(tch * atr / 1000) : '—'}</td>
          <td class="r num" data-l="Produção">${tch ? f0(tch * ar) : '—'}</td>
          <td class="r" data-l="TCH ${esc(ant)}">${tA ? `<span class="num">${f1(tA)}</span>${tch ? ` <span class="chip-d ${tch >= tA ? 'up' : 'dn'}">${tch >= tA ? '▲' : '▼'} ${Math.abs((tch - tA) / tA * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>` : ''}` : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>${linhas.length > lim ? `<p class="muted">Mostrando ${lim} de ${linhas.length} talhões. Escolha um cliente ou fazenda para ver todos.</p>` : ''}`;
  }

  // gráfico de colunas simples (uma série por gráfico: TCH e ATR têm escalas diferentes)
  function colunas(items, un, dec) {
    const ok = items.filter(i => i.v != null); if (!ok.length) return '<p class="empty">Sem dados lançados.</p>';
    const W = Math.max(560, items.length * 100), H = 170, top = 24, max = Math.max(...ok.map(i => i.v)) * 1.1 || 1, step = W / items.length, bw = Math.min(56, step - 30);
    return `<div class="svg-wrap"><svg viewBox="0 0 ${W} ${H + top + 24}" width="100%" style="max-height:240px" role="img" aria-label="Gráfico de ${esc(un)} por safra">
      <line x1="0" y1="${H + top}" x2="${W}" y2="${H + top}" stroke="var(--line)"/>
      ${items.map((i, k) => { const x = k * step + step / 2; if (i.v == null) return `<text x="${x}" y="${H + top + 16}" text-anchor="middle" class="pd-ax">${esc(i.n)}</text>`; const h = Math.max(2, i.v / max * H), y = H + top - h;
        return `<g><title>${esc(i.n)}: ${dec(i.v)} ${esc(un)}</title><path d="M${x - bw / 2},${H + top} V${y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H + top} z" fill="${k === items.length - 1 ? 'var(--brand)' : 'var(--brand-2, #8fb26b)'}"/>
          <text x="${x}" y="${y - 6}" text-anchor="middle" class="pd-vl">${dec(i.v)}</text><text x="${x}" y="${H + top + 16}" text-anchor="middle" class="pd-ax">${esc(i.n)}</text></g>`; }).join('')}
    </svg></div>`;
  }
  function comparar() {
    const ts = talhoes(), todas = safras().slice().reverse();
    const porSafra = todas.map(sf => ({ sf, r: resumo(ts.map(t => ({ t, s: plantio(t, sf) }))) }));
    const comDados = porSafra.filter(x => x.r.TCH != null || x.r.ATR != null);
    const cols = (comDados.length ? comDados : porSafra).slice(-6);
    const ult = cols.map(x => x.sf);
    const linhas = ts.map(t => ({ t, v: ult.map(sf => plantio(t, sf)) })).filter(x => x.v.some(s => nv(s && s.produtividade) || nv(s && s.atr)));
    return `<div class="pd-charts"><section class="card-box"><h3>TCH médio por safra <small>t de cana por ha</small></h3>${colunas(cols.map(x => ({ n: x.sf, v: x.r.TCH })), 't/ha', f1)}</section>
      <section class="card-box"><h3>ATR médio por safra <small>kg de açúcar por t</small></h3>${colunas(cols.map(x => ({ n: x.sf, v: x.r.ATR })), 'kg/t', f1)}</section></div>
      ${linhas.length ? `<div class="table-wrap"><table><thead><tr><th>Talhão</th>${ult.map(sf => `<th class="r">${esc(sf)}<br><small class="muted">TCH · ATR</small></th>`).join('')}<th>Tendência do TCH</th></tr></thead><tbody>
        ${linhas.slice(0, 400).map(({ t, v }) => { const tc = v.map(s => nv(s && s.produtividade)).filter(x => x != null), a = tc[tc.length - 2], b = tc[tc.length - 1];
          return `<tr><td><b>${esc(I().nomeTal(t))}</b><br><small class="muted">${esc(I().get('fazendas', t.fazenda_id)?.nome || '')}</small></td>${v.map(s => `<td class="r num">${nv(s && s.produtividade) ? f1(s.produtividade) : '—'} <span class="muted">· ${nv(s && s.atr) ? f1(s.atr) : '—'}</span></td>`).join('')}
          <td>${a && b ? `<span class="chip-d ${b >= a ? 'up' : 'dn'}">${b >= a ? '▲' : '▼'} ${Math.abs((b - a) / a * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="note">Ainda não há TCH ou ATR lançados para estes talhões. Use a aba <b>Lançar</b> depois de cada colheita.</div>'}`;
  }

  function mudou(e) {
    const f = e.target.closest('[data-pd]');
    if (f) { P[f.dataset.pd] = f.value; if (f.dataset.pd === 'prod') P.faz = ''; salvarPref(); render(); return; }
    const inp = e.target.closest('.pd-in'); if (!inp) return;
    const tr = inp.closest('tr[data-t]'), t = I().get('talhoes', tr.dataset.t); if (!t) return;
    const atual = plantio(t, P.safra);
    const rec = atual ? Object.assign({}, atual) : { id: I().newId(), safra: P.safra, cultura: 'Cana-de-açúcar', talhao_id: t.id, area_ha: nv(t.area_ha) };
    const k = inp.dataset.k;
    if (k === 'produtividade' || k === 'atr') {
      const v = inp.value === '' ? null : Number(inp.value);
      if (v != null && (v < 0 || (k === 'produtividade' && v > 400) || (k === 'atr' && v > 250))) { I().toast(k === 'atr' ? 'ATR fora do normal (até 250 kg/t). Confira.' : 'TCH fora do normal (até 400 t/ha). Confira.'); inp.focus(); return; }
      rec[k] = v;
    } else rec[k] = inp.value || null;
    const foco = document.activeElement && document.activeElement.closest && document.activeElement.closest('.pd-in');
    const fk = foco && foco !== inp ? [foco.closest('tr')?.dataset.t, foco.dataset.k] : null;
    I().Store.save('safras', rec).then(() => {
      if (fk) { const el = root.querySelector(`tr[data-t="${CSS.escape(fk[0])}"] [data-k="${fk[1]}"]`); if (el) el.focus(); }
    }).catch(() => {});
  }
  async function clique(e) {
    const ab = e.target.closest('[data-pd-aba]'); if (ab) { P.aba = ab.dataset.pdAba; salvarPref(); render(); return; }
    if (e.target.closest('[data-pd-xls]')) {
      try {
        await I().loadLib('xlsx'); const X = window.XLSX, wb = X.utils.book_new(), ts = talhoes(), sl = safras().slice().reverse();
        const rows = [];
        for (const t of ts) for (const sf of sl) { const s = plantio(t, sf); if (!s || !(nv(s.produtividade) || nv(s.atr))) continue; const tch = nv(s.produtividade), atr = nv(s.atr), ar = area(s, t);
          rows.push({ Cliente: I().get('produtores', I().get('fazendas', t.fazenda_id)?.produtor_id)?.nome || '', Fazenda: I().get('fazendas', t.fazenda_id)?.nome || '', Talhão: t.nome, Safra: sf, Corte: s.corte || '', Variedade: s.variedade || '', 'Área (ha)': ar, Colheita: s.data_colheita || '', 'TCH (t/ha)': tch, 'ATR (kg/t)': atr, TAH: tch && atr ? Math.round(tch * atr / 10) / 100 : null, 'Produção (t)': tch ? Math.round(tch * ar) : null }); }
        X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Sem TCH/ATR lançados' }]), 'Produtividade');
        X.writeFile(wb, 'inovaagro-produtividade-' + I().today() + '.xlsx'); I().toast('Planilha gerada.');
      } catch (err) { I().toast('Não foi possível gerar a planilha. Verifique a internet.'); }
    }
  }

  if (window.INOVA) {
    I().VIEWS.produtividade = view;
    document.addEventListener('inova:dados', () => { if (root && !root.hidden && document.body.contains(root) && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.pd-in'))) render(); });
  }
  return { view, resumo };
})();
