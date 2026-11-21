/* INOVAAGRO — Relatório mensal por cliente (PDF): visitas, pragas da cana, chuva, aplicações e custos.
   Custos só aparecem para o administrador; o técnico gera o mesmo relatório sem nenhum valor em R$. */
window.RelMensal = (function () {
  'use strict';
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => I().esc(s);
  const S = () => I().S;
  const k = id => String(id);
  const n = v => Number(v) || 0;
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const f1 = v => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const R$ = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const SEM = { verde: ['Verde', '#16a34a'], amarelo: ['Amarelo', '#d97706'], vermelho: ['Vermelho', '#dc2626'] };
  const CL = ['Abaixo do nível', 'Atenção', 'Nível de controle'];
  const admin = () => I().ehAdmin();
  const LS = 'inovaagro.relmensal.v1';
  const RM = { prod: '', faz: '', mes: '', secs: { visitas: true, pragas: true, chuva: true, aplic: true, custos: true } };
  try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); Object.assign(RM, o, { secs: Object.assign(RM.secs, o.secs || {}) }); } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem(LS, JSON.stringify({ prod: RM.prod, faz: RM.faz, secs: RM.secs })); } catch (e) { } };
  function mesPadrao() { const d = new Date(); if (d.getDate() <= 10) d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); }
  const nomeMes = m => { const [y, mm] = m.split('-'); return MESES[+mm - 1] + ' de ' + y; };

  // ---------- Dados do mês ----------
  function dados() {
    const de = RM.mes + '-01', ate = RM.mes + '-31', no = d => d && d.slice(0, 10) >= de && d.slice(0, 10) <= ate;
    const prod = I().get('produtores', RM.prod);
    let fazs = (S().fazPorProd.get(k(RM.prod)) || []).slice();
    if (RM.faz) fazs = fazs.filter(f => k(f.id) === RM.faz);
    fazs.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const fset = new Set(fazs.map(f => k(f.id)));
    const tals = fazs.flatMap(f => S().talPorFaz.get(k(f.id)) || []), tset = new Set(tals.map(t => k(t.id)));
    const area = tals.reduce((a, t) => a + n(t.area_ha), 0);
    const tal = id => I().get('talhoes', id), fz = id => I().get('fazendas', id);
    // visitas
    const visitas = S().data.monitoramentos.filter(m => tset.has(k(m.talhao_id)) && no(m.data)).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const sem = { verde: 0, amarelo: 0, vermelho: 0 }; for (const m of visitas) sem[I().semaforo(m)]++;
    // pragas: média de cada praga em cada visita, comparada com o nível de controle
    const aj = ((I().get('config', 'niveis_cana') || {}).itens) || {}, CN = window.CANA;
    const pr = new Map();
    for (const m of visitas) {
      const g = new Map();
      for (const a of m.amostras_detalhe || []) { if (a.valor == null || a.valor === '' || !isFinite(+a.valor)) continue; const it = CN && CN.daAmostra(a); const id = it ? it.id : 'x:' + (a.alvo || '').toLowerCase(); if (!it && !a.alvo) continue; const x = g.get(id) || { it, nome: it ? it.nome : a.alvo, un: it ? it.un : a.medida || '', vals: [] }; x.vals.push(+a.valor); g.set(id, x); }
      for (const [id, x] of g) {
        const med = x.vals.reduce((a, v) => a + v, 0) / x.vals.length, cl = x.it ? CN.classe(x.it, med, aj) : null;
        const p = pr.get(id) || { nome: x.nome, un: x.un, it: x.it, visitas: 0, soma: 0, max: null, tals: new Map() };
        p.visitas++; p.soma += med; if (p.max == null || med > p.max) p.max = med;
        const tk = k(m.talhao_id), prev = p.tals.get(tk); if (!prev || (m.data || '') >= prev.data) p.tals.set(tk, { data: m.data || '', med, cl });
        pr.set(id, p);
      }
    }
    const pragas = [...pr.values()].map(p => { const l = [...p.tals.entries()].map(([tid, v]) => Object.assign({ t: tal(tid) }, v)); const niv = p.it && CN ? CN.niveis(p.it, aj) : {}; return Object.assign(p, { media: p.soma / p.visitas, controle: l.filter(x => x.cl === 2), atencao: l.filter(x => x.cl === 1), niv }); })
      .sort((a, b) => b.controle.length - a.controle.length || b.atencao.length - a.atencao.length || b.visitas - a.visitas);
    // chuva
    const pluvs = (S().data.pluviometros || []).filter(p => fset.has(k(p.fazenda_id)));
    const chuvasMes = (S().data.chuvas || []).filter(c => no(c.data) && pluvs.some(p => k(p.id) === k(c.pluviometro_id)));
    const [yy, mm] = RM.mes.split('-').map(Number), ndias = new Date(yy, mm, 0).getDate();
    const porDia = Array.from({ length: ndias }, () => []);
    for (const c of chuvasMes) porDia[+c.data.slice(8, 10) - 1].push(n(c.mm));
    const diaMedia = porDia.map(v => v.length ? v.reduce((a, x) => a + x, 0) / v.length : 0); // média entre pluviômetros
    const chuvaPluv = pluvs.map(p => { const cs = chuvasMes.filter(c => k(c.pluviometro_id) === k(p.id)); return { p, total: cs.reduce((a, c) => a + n(c.mm), 0), dias: new Set(cs.filter(c => n(c.mm) > 0).map(c => c.data.slice(0, 10))).size, max: Math.max(0, ...cs.map(c => n(c.mm))) }; });
    const chuvaTotal = diaMedia.reduce((a, v) => a + v, 0);
    const antAno = (yy - 1) + '-' + String(mm).padStart(2, '0');
    const chuvaAnoAnt = (() => { const cs = (S().data.chuvas || []).filter(c => (c.data || '').slice(0, 7) === antAno && pluvs.some(p => k(p.id) === k(c.pluviometro_id))); if (!cs.length) return null; const by = new Map(); for (const c of cs) { const x = by.get(c.data.slice(0, 10)) || []; x.push(n(c.mm)); by.set(c.data.slice(0, 10), x); } return [...by.values()].reduce((a, v) => a + v.reduce((s, x) => s + x, 0) / v.length, 0); })();
    // aplicações e operações do mês
    const ordens = S().data.ordens.filter(o => fset.has(k(o.fazenda_id)) && o.status !== 'Cancelada' && no(I().dataCusto(o))).sort((a, b) => I().dataCusto(a).localeCompare(I().dataCusto(b)));
    const aplic = ordens.map(o => ({ o, area: (o.talhao_ids || []).reduce((a, id) => a + n(tal(id)?.area_ha), 0) || n(o.area_ha) }));
    // custos (só administrador)
    let custos = null;
    if (admin()) {
      let ins = 0, op = 0; const porTipo = new Map(), semPreco = new Set();
      for (const o of ordens) for (const c of I().custosOrdem(o)) { if (!tset.has(c.tid)) continue; ins += c.ins; op += c.op; porTipo.set(o.tipo || 'Outro', (porTipo.get(o.tipo || 'Outro') || 0) + c.ins + c.op); c.sem.forEach(x => semPreco.add(x)); }
      const desp = new Map(); let dt = 0;
      for (const d of S().data.despesas || []) { if (d.status === 'Recusada' || !no(d.data)) continue; const fs = (Array.isArray(d.fazenda_ids) && d.fazenda_ids.length ? d.fazenda_ids : d.fazenda_id ? [d.fazenda_id] : []).map(String); if (!fs.length) continue; const parte = n(d.valor) / fs.length; for (const f of fs) if (fset.has(f)) { desp.set(d.tipo || 'Outra', (desp.get(d.tipo || 'Outra') || 0) + parte); dt += parte; } }
      custos = { ins, op, porTipo: [...porTipo.entries()].sort((a, b) => b[1] - a[1]), desp: [...desp.entries()].sort((a, b) => b[1] - a[1]), dt, total: ins + op + dt, porHa: area ? (ins + op + dt) / area : null, semPreco: [...semPreco] };
    }
    return { prod, fazs, tals, area, visitas, sem, pragas, pluvs, chuvaPluv, chuvaTotal, chuvaAnoAnt, diaMedia, ordens: aplic, custos, tecnicos: [...new Set(visitas.map(m => nomeP(m.responsavel || m.criado_por)).filter(Boolean))], tal, fz };
  }
  const nomeP = e => { if (!e || e === 'local') return ''; const nm = (I().S.nomes || {})[String(e).toLowerCase()]; return nm || String(e).split('@')[0]; };

  // ---------- Tela ----------
  let root = null;
  function view() {
    root = $('#v-relmensal'); if (!root) return;
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.rm === 'prod') { RM.prod = t.value; RM.faz = ''; } else if (t.dataset.rm === 'faz') RM.faz = t.value; else if (t.dataset.rm === 'mes') RM.mes = t.value || mesPadrao(); else if (t.dataset.sec) RM.secs[t.dataset.sec] = t.checked;
        salvarPref(); render();
      });
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-rm-pdf]'); if (!b) return;
        const tx = b.innerHTML; b.disabled = true; b.textContent = 'Gerando PDF…';
        try { await pdf(); } catch (err) { console.error(err); I().toast('Não foi possível gerar o PDF. Verifique a internet e tente de novo.'); }
        finally { b.disabled = false; b.innerHTML = tx; }
      });
    }
    render();
  }
  const SECS = () => [['visitas', 'Visitas'], ['pragas', 'Pragas'], ['chuva', 'Chuva'], ['aplic', 'Aplicações'], ...(admin() ? [['custos', 'Custos']] : [])];
  const on = s => RM.secs[s] && (s !== 'custos' || admin());
  function render() {
    if (!root) return;
    const prods = S().data.produtores;
    if (!RM.prod || !I().get('produtores', RM.prod)) RM.prod = prods[0] ? k(prods[0].id) : '';
    if (!RM.mes) RM.mes = mesPadrao();
    const fazs = (S().fazPorProd.get(k(RM.prod)) || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    if (RM.faz && !fazs.some(f => k(f.id) === RM.faz)) RM.faz = '';
    const D = dados();
    root.innerHTML = `<div class="page rm"><div class="page-head"><div><h2>Relatório mensal do cliente</h2><p>Resumo do mês para enviar ao produtor: visitas, pragas, chuva, aplicações${admin() ? ' e custos' : ''}.</p></div>
      <div class="head-acts"><button class="btn primary" data-rm-pdf>${I().icon('pdf')} Baixar PDF</button></div></div>
      <div class="card-box rm-f"><div class="rm-ctrl">
        <label class="field"><span>Cliente</span><select data-rm="prod">${prods.map(p => `<option value="${esc(p.id)}" ${k(p.id) === RM.prod ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Fazenda</span><select data-rm="faz"><option value="">Todas (${fazs.length})</option>${fazs.map(f => `<option value="${esc(f.id)}" ${k(f.id) === RM.faz ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        <label class="field"><span>Mês</span><input type="month" data-rm="mes" value="${esc(RM.mes)}"></label></div>
        <div class="rep-checks"><span class="muted">Incluir:</span>${SECS().map(([s, l]) => `<label><input type="checkbox" data-sec="${s}" ${RM.secs[s] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        ${admin() ? '' : '<p class="muted rm-aviso">Os custos não aparecem no seu acesso. O administrador gera a versão com valores.</p>'}</div>
      ${previa(D)}</div>`;
  }
  function previa(D) {
    const t = (l, v, s, cls = '') => `<div class="tile ${cls}"><span class="lbl">${l}</span><span class="val num">${v}</span><span class="sub">${s}</span></div>`;
    const ctl = D.pragas.reduce((a, p) => a + p.controle.length, 0);
    return `<article class="rm-doc"><header class="rm-hd"><div><small>Relatório mensal · ${esc(nomeMes(RM.mes))}</small><h3>${esc(D.prod?.nome || '—')}</h3><p class="muted">${D.fazs.length === 1 ? esc(D.fazs[0].nome) : D.fazs.length + ' fazendas'} · ${D.tals.length} talhões · ${I().fmtHa0(D.area)} ha${D.tecnicos.length ? ' · Técnico(s): ' + esc(D.tecnicos.join(', ')) : ''}</p></div></header>
      <div class="tiles">${t('Visitas', D.visitas.length, `${D.sem.vermelho} vermelho · ${D.sem.amarelo} amarelo · ${D.sem.verde} verde`, D.sem.vermelho ? 'alert' : '')}${t('Talhões em controle', ctl, ctl ? 'precisam de ação' : 'nenhuma praga no nível de controle', ctl ? 'alert' : '')}${t('Chuva no mês', f1(D.chuvaTotal) + ' mm', D.chuvaAnoAnt != null ? `${f1(D.chuvaAnoAnt)} mm no mesmo mês do ano passado` : D.pluvs.length + ' pluviômetro(s)')}${t('Aplicações', D.ordens.length, (c => c + (c === 1 ? ' concluída' : ' concluídas'))(D.ordens.filter(x => x.o.status === 'Concluída').length))}${on('custos') && D.custos ? t('Custo do mês', R$(D.custos.total), D.custos.porHa ? R$(D.custos.porHa) + ' por ha' : '') : ''}</div>
      ${on('visitas') ? `<section><h4>Visitas</h4>${D.visitas.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Fazenda / talhão</th><th>Técnico</th><th>Semáforo</th><th>Principal problema e recomendação</th></tr></thead><tbody>${D.visitas.map(m => { const tt = D.tal(m.talhao_id), s = SEM[I().semaforo(m)], rc = m.recomendacao && (m.recomendacao.produtos || []).length ? m.recomendacao.produtos.map(p => p.produto).join(', ') : ''; return `<tr><td>${I().fmtDate(m.data)}</td><td>${esc(D.fz(tt?.fazenda_id)?.nome || '')}<br><small class="muted">${esc(I().nomeTal(tt))}</small></td><td>${esc(nomeP(m.responsavel || m.criado_por) || '—')}</td><td><span class="rm-sem"><i style="background:${s[1]}"></i>${s[0]}</span></td><td>${esc(m.alvo || m.estadio || '—')}${rc ? `<br><small class="muted">Recomendado: ${esc(rc)}</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma visita neste mês.</p>'}</section>` : ''}
      ${on('pragas') ? `<section><h4>Pragas da cana</h4>${D.pragas.length ? `<div class="table-wrap"><table><thead><tr><th>Praga</th><th class="r">Visitas</th><th class="r">Média</th><th class="r">Maior</th><th>Nível de controle</th><th>Talhões em controle</th></tr></thead><tbody>${D.pragas.map(p => `<tr><td><b>${esc(p.nome)}</b><br><small class="muted">${esc(p.un)}</small></td><td class="r num">${p.visitas}</td><td class="r num">${f1(p.media)}</td><td class="r num">${f1(p.max)}</td><td>${p.niv.vm != null ? '≥ ' + f1(p.niv.vm) : '—'}</td><td>${p.controle.length ? `<span class="pill bad">${p.controle.length}</span> ${esc(p.controle.map(x => I().nomeTal(x.t)).join(', '))}` : p.atencao.length ? `<span class="pill warn">${p.atencao.length} em atenção</span>` : '<span class="pill ok">Nenhum</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma amostra de praga registrada neste mês.</p>'}</section>` : ''}
      ${on('chuva') ? `<section><h4>Chuva</h4>${D.pluvs.length ? `${barrasChuva(D.diaMedia)}<div class="table-wrap"><table><thead><tr><th>Pluviômetro</th><th>Fazenda</th><th class="r">Total do mês</th><th class="r">Dias com chuva</th><th class="r">Maior chuva</th></tr></thead><tbody>${D.chuvaPluv.map(x => `<tr><td>${esc(x.p.nome || '')}</td><td>${esc(D.fz(x.p.fazenda_id)?.nome || '')}</td><td class="r num">${f1(x.total)} mm</td><td class="r num">${x.dias}</td><td class="r num">${f1(x.max)} mm</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhum pluviômetro cadastrado nas fazendas deste cliente.</p>'}</section>` : ''}
      ${on('aplic') ? `<section><h4>Aplicações e operações</h4>${D.ordens.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Ordem</th><th>Situação</th><th class="r">Área (ha)</th><th>Produtos</th></tr></thead><tbody>${D.ordens.map(({ o, area }) => `<tr><td>${I().fmtDate(I().dataCusto(o))}</td><td>${esc(o.titulo || o.tipo || '')}<br><small class="muted">${esc(D.fz(o.fazenda_id)?.nome || '')} · ${(o.talhao_ids || []).length} talhão(ões)</small></td><td>${esc(o.status || 'Planejada')}</td><td class="r num">${I().fmtHa(area)}</td><td>${esc((o.produtos || []).map(p => p.produto + (p.dose != null ? ' ' + String(p.dose).replace('.', ',') + ' ' + (p.unidade || '') : '')).join('; ') || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma aplicação no mês.</p>'}</section>` : ''}
      ${on('custos') && D.custos ? `<section><h4>Custos <span class="pill info">só administrador</span></h4><div class="rm-cus">${[['Insumos', D.custos.ins], ['Operações', D.custos.op], ['Despesas de campo', D.custos.dt], ['Total', D.custos.total]].map(([l, v], i) => `<div class="${i === 3 ? 'tot' : ''}"><span>${l}</span><b class="num">${R$(v)}</b></div>`).join('')}</div>
        ${D.custos.semPreco.length ? `<p class="muted" style="font-size:12.5px;margin:0">Sem preço cadastrado (não somados): ${esc(D.custos.semPreco.slice(0, 8).join(', '))}${D.custos.semPreco.length > 8 ? '…' : ''}</p>` : ''}</section>` : ''}
    </article>`;
  }
  function barrasChuva(v) {
    const max = Math.max(...v, 1), W = v.length * 20, H = 90;
    return `<div class="svg-wrap rm-ch"><svg viewBox="0 0 ${W} ${H + 18}" width="100%" role="img" aria-label="Chuva por dia do mês">${v.map((x, i) => { const h = x ? Math.max(2, x / max * H) : 0; return `<g><title>Dia ${i + 1}: ${f1(x)} mm</title>${h ? `<rect x="${i * 20 + 4}" y="${H - h}" width="12" height="${h}" rx="3" fill="#3b8ee8"/>` : ''}${x >= max * 0.6 && x ? `<text x="${i * 20 + 10}" y="${H - h - 3}" text-anchor="middle" class="pd-vl" style="font-size:9px">${Math.round(x)}</text>` : ''}${(i + 1) % 5 === 0 || i === 0 ? `<text x="${i * 20 + 10}" y="${H + 13}" text-anchor="middle" class="pd-ax" style="font-size:9px">${i + 1}</text>` : ''}</g>`; }).join('')}<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="var(--line)"/></svg></div>`;
  }

  // ---------- PDF ----------
  async function pdf() {
    await I().loadLib('jspdf'); await I().loadLib('autotable');
    const fx = t => String(t || '').replace(/≥/g, '>=').replace(/≤/g, '<=');
    const D = dados(), { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
    const VERDE = [94, 129, 69], LIMA = [177, 210, 67], TINTA = [32, 30, 30], CINZA = [100, 106, 95], FUNDO = [243, 246, 238];
    const head = { fillColor: VERDE, textColor: 255, fontStyle: 'bold', fontSize: 8.5 };
    const est = { fontSize: 8.5, textColor: TINTA, cellPadding: 1.8, lineColor: [225, 230, 218], lineWidth: 0.1 };
    const logo = I().imgDataUrl('.login-logo.logo-claro');
    if (logo) doc.addImage(logo.url, 'PNG', M, 10, 46, 46 * logo.h / logo.w); else { doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...VERDE); doc.text('InovaAgro', M, 18); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA); doc.text('RELATÓRIO MENSAL', W - M, 13, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...TINTA); doc.text(nomeMes(RM.mes).replace(/^./, c => c.toUpperCase()), W - M, 20, { align: 'right' });
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.7); doc.line(M, 27, W - M, 27);
    let y = 35;
    doc.setFontSize(14); doc.text(D.prod?.nome || '—', M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    const sub = doc.splitTextToSize([D.fazs.length === 1 ? D.fazs[0].nome : D.fazs.map(f => f.nome).join(', '), D.tals.length + ' talhões', I().fmtHa0(D.area) + ' ha', D.tecnicos.length ? 'Técnico(s): ' + D.tecnicos.join(', ') : ''].filter(Boolean).join(' · '), W - 2 * M);
    doc.text(sub, M, y + 5); y += 6 + sub.length * 4;
    // resumo
    const ctl = D.pragas.reduce((a, p) => a + p.controle.length, 0);
    const tl = [[String(D.visitas.length), 'Visitas'], [String(ctl), 'Em nível de controle'], [f1(D.chuvaTotal) + ' mm', 'Chuva no mês'], [String(D.ordens.length), 'Aplicações']];
    if (on('custos') && D.custos) tl.push([R$(D.custos.total), 'Custo do mês']);
    const bw = (W - 2 * M - (tl.length - 1) * 3) / tl.length;
    tl.forEach(([v, l], i) => { const x = M + i * (bw + 3); doc.setFillColor(...FUNDO); doc.roundedRect(x, y, bw, 16, 2, 2, 'F'); doc.setFillColor(...(i === 1 && ctl ? [208, 59, 59] : LIMA)); doc.rect(x, y, 1.2, 16, 'F'); doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text(v, x + 4, y + 7.5); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(l.toUpperCase(), x + 4, y + 12.5); });
    y += 24;
    const tit = (s, extra) => { if (y > H - 40) { doc.addPage(); y = 18; } doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...VERDE); doc.text(s, M, y); if (extra) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text(extra, W - M, y, { align: 'right' }); } y += 3; };
    const COR = { Verde: [22, 163, 74], Amarelo: [202, 120, 0], Vermelho: [220, 38, 38] };
    const tab = (h, body, cs = {}) => { doc.autoTable({ didParseCell: d => { if (d.section === 'body' && COR[d.cell.raw]) d.cell.styles.textColor = COR[d.cell.raw]; }, startY: y, margin: { left: M, right: M, top: 16, bottom: 16 }, head: [h], body, theme: 'grid', headStyles: head, styles: est, alternateRowStyles: { fillColor: [249, 250, 246] }, columnStyles: cs }); y = doc.lastAutoTable.finalY + 8; };
    const vazio = t => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA); doc.text(t, M, y + 3); y += 10; };
    if (on('visitas')) {
      tit('Visitas', `${D.sem.vermelho} vermelho · ${D.sem.amarelo} amarelo · ${D.sem.verde} verde`);
      if (D.visitas.length) tab(['Data', 'Fazenda / talhão', 'Técnico', 'Semáforo', 'Principal problema e recomendação'], D.visitas.map(m => { const tt = D.tal(m.talhao_id), rc = m.recomendacao && (m.recomendacao.produtos || []).length ? '\nRecomendado: ' + m.recomendacao.produtos.map(p => p.produto).join(', ') : ''; return [I().fmtDate(m.data), (D.fz(tt?.fazenda_id)?.nome || '') + '\n' + I().nomeTal(tt), nomeP(m.responsavel || m.criado_por) || '—', SEM[I().semaforo(m)][0], (m.alvo || m.estadio || '—') + rc]; }), { 0: { cellWidth: 21 }, 3: { cellWidth: 20, fontStyle: 'bold' } });
      else vazio('Nenhuma visita neste mês.');
    }
    if (on('pragas')) {
      tit('Pragas da cana', 'média das amostras de cada visita');
      if (D.pragas.length) tab(['Praga', 'Unidade', 'Visitas', 'Média', 'Maior', 'Controle', 'Talhões em controle'], D.pragas.map(p => [fx(p.nome), fx(p.un), String(p.visitas), f1(p.media), f1(p.max), p.niv.vm != null ? 'a partir de ' + f1(p.niv.vm) : '—', p.controle.length ? p.controle.map(x => I().nomeTal(x.t)).join(', ') : p.atencao.length ? p.atencao.length + ' em atenção' : 'Nenhum']), { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
      else vazio('Nenhuma amostra de praga registrada neste mês.');
    }
    if (on('chuva')) {
      tit('Chuva', D.chuvaAnoAnt != null ? `${f1(D.chuvaTotal)} mm no mês · ${f1(D.chuvaAnoAnt)} mm no mesmo mês do ano passado` : `${f1(D.chuvaTotal)} mm no mês`);
      if (D.pluvs.length) {
        if (y > H - 70) { doc.addPage(); y = 18; }
        const v = D.diaMedia, max = Math.max(...v, 1), gw = W - 2 * M, gh = 30, step = gw / v.length; y += 2;
        doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(M, y + gh, W - M, y + gh);
        v.forEach((x, i) => { if (x) { const h = Math.max(0.6, x / max * gh); doc.setFillColor(59, 142, 232); doc.roundedRect(M + i * step + step * 0.2, y + gh - h, step * 0.6, h, 0.6, 0.6, 'F'); if (x >= max * 0.5) { doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(String(Math.round(x)), M + i * step + step / 2, y + gh - h - 1, { align: 'center' }); } } if ((i + 1) % 5 === 0 || i === 0) { doc.setFontSize(6.5); doc.setTextColor(...CINZA); doc.text(String(i + 1), M + i * step + step / 2, y + gh + 3.5, { align: 'center' }); } });
        y += gh + 9;
        tab(['Pluviômetro', 'Fazenda', 'Total do mês', 'Dias com chuva', 'Maior chuva'], D.chuvaPluv.map(x => [x.p.nome || '', D.fz(x.p.fazenda_id)?.nome || '', f1(x.total) + ' mm', String(x.dias), f1(x.max) + ' mm']), { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } });
      } else vazio('Nenhum pluviômetro cadastrado nas fazendas deste cliente.');
    }
    if (on('aplic')) {
      tit('Aplicações e operações');
      if (D.ordens.length) tab(['Data', 'Ordem', 'Situação', 'Área (ha)', 'Produtos e doses'], D.ordens.map(({ o, area }) => [I().fmtDate(I().dataCusto(o)), (o.titulo || o.tipo || '') + '\n' + (D.fz(o.fazenda_id)?.nome || ''), o.status || 'Planejada', I().fmtHa(area), (o.produtos || []).map(p => p.produto + (p.dose != null ? ' ' + String(p.dose).replace('.', ',') + ' ' + (p.unidade || '') : '')).join('\n') || '—']), { 0: { cellWidth: 21 }, 3: { halign: 'right', cellWidth: 18 } });
      else vazio('Nenhuma aplicação no mês.');
    }
    if (on('custos') && D.custos) {
      tit('Custos do mês', D.custos.porHa ? R$(D.custos.porHa) + ' por hectare' : '');
      const body = [['Insumos aplicados', R$(D.custos.ins)], ['Operações', R$(D.custos.op)], ...D.custos.desp.map(([t, v]) => ['Despesa de campo: ' + t, R$(v)]), [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: R$(D.custos.total), styles: { fontStyle: 'bold' } }]];
      tab(['Item', 'Valor'], body, { 1: { halign: 'right', cellWidth: 40 } });
    }
    // rodapé
    const np = doc.getNumberOfPages();
    for (let i = 1; i <= np; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.text('InovaAgro Consultoria Agrícola · emitido em ' + I().fmtDate(I().today()), M, H - 8); doc.text('página ' + i + ' de ' + np, W - M, H - 8, { align: 'right' }); }
    const nome = ('relatorio-mensal-' + (D.prod?.nome || 'cliente') + '-' + RM.mes).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase() + '.pdf';
    doc.save(nome); I().toast('PDF gerado.');
  }

  if (window.INOVA) {
    I().VIEWS.relmensal = view;
    document.addEventListener('inova:dados', () => { if (root && !root.hidden && document.body.contains(root)) render(); });
  }
  return { view, dados };
})();
