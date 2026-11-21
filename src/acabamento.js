/* INOVAAGRO — Acabamento: tema claro/escuro, animações entre telas, resumo do dia, busca rápida e ditado por voz.
   Funciona no site e no modo campo (celular). Usa os dados do app (window.INOVA) e do modo campo (window.Campo). */
window.Acab = (function () {
  'use strict';
  const I = () => window.INOVA;
  const C = () => window.Campo;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const emCampo = () => document.body.classList.contains('campo-on');
  const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = (p, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    lua: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
    lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    parar: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
    visita: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    alerta: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/>',
    chuva: '<path d="M7 15a4 4 0 1 1 1.6-7.7A5 5 0 0 1 18 9a3 3 0 0 1 0 6z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    contas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    ordem: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    rota: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
    seta: '<path d="m9 6 6 6-6 6"/>',
    fazenda: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
    talhao: '<path d="M4 7l7-4 9 5-2 11-10 2-4-6z"/><path d="M11 3l-1 18"/>',
    produtor: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    ok: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17.5h2"/>',
  };

  // =====================================================================
  // 1. Tema claro / escuro
  // =====================================================================
  const TEMAS = { auto: ['Automático', 'Segue o celular ou o computador', IC.auto], claro: ['Claro', 'Sempre claro', IC.sol], escuro: ['Escuro', 'Sempre escuro, bom à noite', IC.lua] };
  const escuroAgora = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
  const tema = () => { let t = 'auto'; try { t = localStorage.getItem('inovaagro.tema') || 'auto'; } catch (e) { } return TEMAS[t] ? t : 'auto'; };
  function aplicarTema(t, animar) {
    const go = () => {
      if (t === 'claro') document.documentElement.dataset.theme = 'light';
      else if (t === 'escuro') document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
      pintarTema();
    };
    // troca com um leve esmaecer (onde o navegador permite), sem piscar
    if (animar && document.startViewTransition && !semMovimento()) document.startViewTransition(go); else go();
  }
  function setTema(t) {
    try { if (t === 'auto') localStorage.removeItem('inovaagro.tema'); else localStorage.setItem('inovaagro.tema', t); } catch (e) { }
    aplicarTema(t, true);
  }
  function pintarTema() {
    const t = tema(), esc_ = escuroAgora();
    const mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.content = esc_ ? '#131611' : '#5e8145';
    for (const b of $$('[data-acab="tema"]')) { b.innerHTML = svg(t === 'auto' ? IC.auto : esc_ ? IC.lua : IC.sol); b.title = 'Tema: ' + TEMAS[t][0].toLowerCase(); }
    for (const b of $$('[data-acab-tema]')) b.setAttribute('aria-pressed', b.dataset.acabTema === t);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintarTema);
  function menuTema(btn) {
    fecharPop();
    const r = btn.getBoundingClientRect(), t = tema();
    const pop = document.createElement('div'); pop.className = 'acab-pop'; pop.setAttribute('role', 'menu');
    pop.innerHTML = `<div class="acab-pop-h">Aparência</div>` + Object.entries(TEMAS).map(([k, [n, d, i]]) => `<button role="menuitemradio" aria-checked="${k === t}" data-acab-tema="${k}">${svg(i)}<span><b>${n}</b><small>${d}</small></span></button>`).join('');
    document.body.appendChild(pop);
    pop.style.top = (r.bottom + 6) + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
    function fora(e) { if (!pop.contains(e.target)) { fecharPop(); document.removeEventListener('pointerdown', fora, true); } }
  }
  const fecharPop = () => $$('.acab-pop').forEach(p => p.remove());
  // botões de tema para o menu do celular
  const temaSeg = () => `<div class="acab-tseg" role="group" aria-label="Aparência">${Object.entries(TEMAS).map(([k, [n, , i]]) => `<button data-acab-tema="${k}" aria-pressed="${k === tema()}">${svg(i)}<span>${n}</span></button>`).join('')}</div>`;

  // =====================================================================
  // 2. Animações entre telas (leves; desligadas com "reduzir movimento")
  // =====================================================================
  function entrou(nome) {
    if (nome === 'campo' || semMovimento()) return;
    const el = document.getElementById('v-' + nome); if (!el) return;
    el.classList.remove('acab-in'); void el.offsetWidth; el.classList.add('acab-in');
  }
  document.addEventListener('animationend', e => { if (e.target.classList && e.animationName === 'acab-entra') e.target.classList.remove('acab-in'); });

  // =====================================================================
  // 3. Resumo do dia
  // =====================================================================
  const hojeISO = () => I().today();
  const addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const dias = iso => I().diasDesde(iso);
  const meuEmail = () => (I().SB && I().SB.user && I().SB.user.email) || '';
  const R$ = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const mm = v => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('pt-BR') + ' mm';
  function saudacao() {
    const h = new Date().getHours(), nm = I().nomeDe ? I().nomeDe(meuEmail()) : '';
    const pn = nm && nm !== meuEmail() ? nm.split(/\s+/)[0] : '';
    return (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (pn ? ', ' + pn : '');
  }
  const dataLonga = () => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const nomeFaz = id => (I().get('fazendas', id) || {}).nome || '';
  function dados() {
    const S = I().S, hoje = hojeISO(), eu = meuEmail();
    const fazCampo = emCampo() && C() && C().fazAtual ? C().fazAtual() : null;
    const noEscopo = t => !fazCampo || (t && String(t.fazenda_id) === String(fazCampo.id));
    // visitas de hoje
    const vis = S.data.monitoramentos.filter(m => m.data === hoje && noEscopo(I().get('talhoes', m.talhao_id)));
    const minhas = eu ? vis.filter(m => m.criado_por === eu).length : 0;
    // alertas de praga: última visita de cada talhão nos últimos 15 dias em vermelho ou amarelo
    const alertas = [];
    let semVisita = 0;
    for (const t of S.data.talhoes) {
      if (!noEscopo(t)) continue;
      const l = S.monPorTal.get(String(t.id)) || [];
      let v = null; for (const m of l) if (m.data && (!v || m.data > v.data)) v = m;
      if (!v) continue;
      const d = dias(v.data);
      if (d > 15 && I().culturaAtual(t)) semVisita++;
      if (d < 0 || d > 15) continue;
      const s = I().semaforo(v);
      if (s === 'vermelho' || s === 'amarelo') alertas.push({ t, v, s, d });
    }
    alertas.sort((a, b) => (a.s === b.s ? 0 : a.s === 'vermelho' ? -1 : 1) || a.d - b.d);
    // ordens
    const pend = o => o.status !== 'Concluída' && o.status !== 'Cancelada';
    const escOrd = o => !fazCampo || String(o.fazenda_id) === String(fazCampo.id);
    const ordHoje = S.data.ordens.filter(o => pend(o) && o.data_prevista === hoje && escOrd(o));
    const ordAtr = S.data.ordens.filter(o => I().atrasada(o) && escOrd(o));
    // chuva registrada hoje e ontem
    const ontem = addDias(hoje, -1);
    const chuvas = (S.data.chuvas || []).filter(c => c.data === hoje || c.data === ontem).filter(c => { if (!fazCampo) return true; const p = I().get('pluviometros', c.pluviometro_id); return !p || !p.fazenda_id || String(p.fazenda_id) === String(fazCampo.id); });
    const chHoje = chuvas.filter(c => c.data === hoje), chOntem = chuvas.filter(c => c.data === ontem);
    const maxMm = l => l.reduce((a, c) => Math.max(a, Number(c.mm) || 0), 0);
    // contas (só administrador)
    let contas = null;
    if (I().ehAdmin()) {
      const cs = (S.data.contas || []).filter(c => c.kind !== 'contrato' && !c.pago_em && c.vencimento);
      const venc = cs.filter(c => c.vencimento < hoje), hj = cs.filter(c => c.vencimento === hoje), sem = cs.filter(c => c.vencimento > hoje && c.vencimento <= addDias(hoje, 7));
      const soma = (l, t) => l.filter(c => !t || c.tipo === t).reduce((a, c) => a + (Number(c.valor) || 0), 0);
      contas = { venc, hj, sem, recV: soma(venc, 'Receber'), pagV: soma(venc, 'Pagar'), recH: soma([...hj, ...sem], 'Receber'), pagH: soma([...hj, ...sem], 'Pagar') };
    }
    // agenda da equipe (src/agenda.js): no celular só as minhas; no site, todas as que a pessoa enxerga
    let agenda = null;
    if (window.Agenda && S.data.agenda) {
      const l = S.data.agenda.filter(x => (!emCampo() || !eu || x.tecnico === eu) && (!fazCampo || String(x.fazenda_id) === String(fazCampo.id)));
      let h = 0, feitas = 0, atr = 0;
      for (const x of l) { const st = window.Agenda.situacao(x); if (x.data === hoje && st.k !== 'cancelada') { h++; if (st.k === 'feita') feitas++; } if (st.k === 'atrasada') atr++; }
      agenda = { h, feitas, atr };
    }
    return { agenda, hoje, vis, minhas, alertas, semVisita, ordHoje, ordAtr, chHoje, chOntem, maxH: maxMm(chHoje), maxO: maxMm(chOntem), contas, fazCampo };
  }
  // fazenda usada para a previsão do tempo: a do modo campo, ou a da visita mais recente
  function fazPrevisao(D) {
    if (D.fazCampo) return D.fazCampo;
    let m = null; for (const x of I().S.data.monitoramentos) if (x.data && (!m || x.data > m.data)) m = x;
    const t = m && I().get('talhoes', m.talhao_id);
    return (t && I().get('fazendas', t.fazenda_id)) || I().S.data.fazendas[0] || null;
  }
  async function previsaoHoje(f) {
    const k = 'inovaagro.prev.' + f.id;
    try {
      if (!navigator.onLine) throw new Error('off');
      if (window.Tempo) {
        const F = await window.Tempo.obter(f); const a = F && F.dias.find(x => x.d === hojeISO()), b = F && F.dias.find(x => x.d > hojeISO()); if (!a) throw new Error('sem');
        const r = { mm: a.mm, prob: a.prob, max: a.max, min: a.min, vento: a.vento, amanha: b ? b.mm : null, probA: b ? b.prob : null, em: hojeISO() };
        ls.set(k, r); return r;
      }
      const p = await I().previsao(f); if (!p || !p.daily) throw new Error('sem');
      const i = p.daily.time.indexOf(hojeISO()); if (i < 0) throw new Error('sem');
      const d = p.daily, r = { mm: d.precipitation_sum[i], prob: d.precipitation_probability_max[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], vento: d.wind_speed_10m_max[i], amanha: d.precipitation_sum[i + 1], probA: d.precipitation_probability_max[i + 1], em: hojeISO() };
      ls.set(k, r); return r;
    } catch (e) { const r = ls.get(k, null); return r && r.em === hojeISO() ? r : null; }
  }
  // previsão de hoje + janela para aplicar hoje e amanhã (src/tempo.js)
  function mostrarPrev(box, f) {
    previsaoHoje(f).then(p => {
      if (!box.isConnected) return;
      box.innerHTML = htmlPrev(p, f);
      if (p && window.Tempo) window.Tempo.linhaHoje(f).then(h => { if (h && box.isConnected) box.insertAdjacentHTML('beforeend', h); }).catch(() => { });
    });
  }
  const fmtGraus = v => v == null ? '—' : Math.round(v) + '°';
  function htmlPrev(p, f) {
    if (!p) return `<p class="acab-mut">${navigator.onLine ? 'Previsão indisponível agora.' : 'Sem internet: a previsão aparece quando a conexão voltar.'}</p>`;
    const chuva = p.prob >= 60 || p.mm >= 5;
    return `<div class="acab-prev"><span class="acab-prev-t">${svg(chuva ? IC.chuva : IC.sol)}<b>${fmtGraus(p.max)}</b><small>mín. ${fmtGraus(p.min)}</small></span>
      <span class="acab-prev-d"><b>${chuva ? 'Chance de chuva' : p.prob >= 30 ? 'Pode chover' : 'Tempo firme'}</b><small>${p.prob != null ? p.prob + '% · ' : ''}${mm(p.mm)} previstos${p.vento != null ? ' · vento ' + Math.round(p.vento) + ' km/h' : ''}</small><small>Amanhã: ${p.probA != null ? p.probA + '% · ' : ''}${mm(p.amanha)}</small></span></div>
      <p class="acab-mut acab-fonte">${esc(f.nome)} · Open-Meteo</p>`;
  }
  const corSem = s => s === 'vermelho' ? 'var(--bad)' : 'var(--warn)';
  const quando = d => d === 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias';

  // ---------- Site (Início) ----------
  function resumoSite(el) {
    if (!el) return;
    const D = dados();
    const al = D.alertas.slice(0, 3), nv = D.alertas.filter(a => a.s === 'vermelho').length;
    const card = (ico, tit, corpo, extra = '') => `<section class="acab-hc ${extra}"><h4>${svg(ico)}<span>${tit}</span></h4>${corpo}</section>`;
    el.innerHTML = `<div class="acab-hoje">
      <div class="acab-hoje-h"><div><span class="acab-kick">Resumo do dia</span><h3>${esc(saudacao())}</h3><p>${esc(dataLonga())}</p></div></div>
      <div class="acab-hgrid ${D.contas ? 'c4' : 'c3'}">
        ${card(IC.visita, 'Visitas', `<div class="acab-big"><b class="num">${D.vis.length}</b><span>${D.vis.length === 1 ? 'visita hoje' : 'visitas hoje'}</span></div>
          <ul class="acab-mini">${D.vis.slice(0, 2).map(m => `<li><button data-acab-vis="${esc(m.id)}"><span>${esc(I().nomeTal(I().get('talhoes', m.talhao_id)) || 'Talhão')}</span><small>${esc(nomeFaz((I().get('talhoes', m.talhao_id) || {}).fazenda_id))}</small></button></li>`).join('')}
          ${D.agenda && (D.agenda.h || D.agenda.atr) ? `<li class="acab-nota">${svg(IC.agenda)}<span>Agenda: <b>${D.agenda.feitas} de ${D.agenda.h}</b> feitas hoje${D.agenda.atr ? ` · <b class="acab-v">${D.agenda.atr}</b> ${D.agenda.atr === 1 ? 'atrasada' : 'atrasadas'}` : ''} · <a href="#agenda">abrir</a></span></li>` : ''}
          ${D.semVisita ? `<li class="acab-nota">${svg(IC.relogio)}<span><b>${D.semVisita}</b> talhões com cana sem visita há mais de 15 dias</span></li>` : ''}</ul>`)}
        ${card(IC.alerta, 'Alertas de praga', D.alertas.length ? `<div class="acab-big"><b class="num">${D.alertas.length}</b><span>talhões em alerta${nv ? ` · <em class="acab-v">${nv} no vermelho</em>` : ''}</span></div>
          <ul class="acab-mini">${al.map(a => `<li><button data-acab-tal="${esc(a.t.id)}"><i class="acab-dot" style="background:${corSem(a.s)}"></i><span>${esc(a.t.nome)}${a.v.alvo ? ' · ' + esc(a.v.alvo) : ''}</span><small>${esc(nomeFaz(a.t.fazenda_id))} · ${quando(a.d)}</small></button></li>`).join('')}</ul>`
          : `<div class="acab-okbox">${svg(IC.ok)}<span>Nenhum talhão em alerta nos últimos 15 dias.</span></div>`, D.alertas.length ? 'alerta' : '')}
        ${card(IC.chuva, 'Chuva e tempo', `<div class="acab-chv"><span><small>Hoje</small><b class="num">${D.chHoje.length ? mm(D.maxH) : '—'}</b></span><span><small>Ontem</small><b class="num">${D.chOntem.length ? mm(D.maxO) : '—'}</b></span></div><div class="acab-prevbox" data-acab-prev><p class="acab-mut">Carregando previsão…</p></div>`)}
        ${D.contas ? card(IC.contas, 'Contas', contasHtml(D.contas), D.contas.venc.length ? 'alerta' : '') : ''}
      </div>
      ${D.ordHoje.length || D.ordAtr.length ? `<div class="acab-faixa-ord">${svg(IC.ordem)}<span>${D.ordHoje.length ? `<b>${D.ordHoje.length}</b> ${D.ordHoje.length === 1 ? 'ordem prevista' : 'ordens previstas'} para hoje` : ''}${D.ordHoje.length && D.ordAtr.length ? ' · ' : ''}${D.ordAtr.length ? `<b class="acab-v">${D.ordAtr.length}</b> ${D.ordAtr.length === 1 ? 'atrasada' : 'atrasadas'}` : ''}</span><a href="#ordens">Ver ordens${svg(IC.seta)}</a></div>` : ''}
    </div>`;
    const f = fazPrevisao(D), box = $('[data-acab-prev]', el);
    if (f) mostrarPrev(box, f); else box.innerHTML = '<p class="acab-mut">Cadastre uma fazenda para ver a previsão.</p>';
  }
  function contasHtml(c) {
    const nV = c.venc.length, n7 = c.hj.length + c.sem.length;
    if (!nV && !n7) return `<div class="acab-okbox">${svg(IC.ok)}<span>Nada vencido nem vencendo nos próximos 7 dias.</span></div>`;
    return `${nV ? `<div class="acab-big"><b class="num acab-v">${nV}</b><span>${nV === 1 ? 'conta vencida' : 'contas vencidas'}</span></div>` : `<div class="acab-big"><b class="num">${n7}</b><span>vencem em até 7 dias</span></div>`}
      <ul class="acab-kv">${c.recV ? `<li><span>A receber vencido</span><b class="num">${R$(c.recV)}</b></li>` : ''}${c.pagV ? `<li><span>A pagar vencido</span><b class="num">${R$(c.pagV)}</b></li>` : ''}${c.recH ? `<li><span>A receber em 7 dias</span><b class="num">${R$(c.recH)}</b></li>` : ''}${c.pagH ? `<li><span>A pagar em 7 dias</span><b class="num">${R$(c.pagH)}</b></li>` : ''}</ul>
      <a class="acab-lnk" href="#financeiro" data-acab-contas>Abrir contas${svg(IC.seta)}</a>`;
  }

  // ---------- Celular (aba Hoje do modo campo) ----------
  function resumoCampo(el) {
    const D = dados(), adm = I().ehAdmin();
    const al = D.alertas.slice(0, 5);
    el.innerHTML = `<header class="acab-ch">
        <div class="acab-ch-t"><div><span class="acab-kick">${esc(dataLonga())}</span><h1>${esc(saudacao())}</h1></div></div>
        <button class="acab-cbusca" data-acab="buscar">${svg(IC.lupa)}<span>Buscar fazenda, talhão ou visita</span></button>
        ${D.fazCampo ? `<p class="acab-escopo">Mostrando <b>${esc(D.fazCampo.nome)}</b> · <button data-cp="pick">trocar</button></p>` : ''}
      </header>
      <div class="acab-cbody">
        <div class="acab-stats">
          <button data-cp="tab" data-p="historico"><b class="num">${D.vis.length}</b><span>${D.vis.length === 1 ? 'visita hoje' : 'visitas hoje'}</span>${D.minhas && D.minhas !== D.vis.length ? `<small>${D.minhas} suas</small>` : ''}</button>
          <button data-acab-alertas class="${D.alertas.length ? 'tem' : ''}"><b class="num">${D.alertas.length}</b><span>${D.alertas.length === 1 ? 'talhão em alerta' : 'talhões em alerta'}</span></button>
          <button data-cp="rota"><b class="num">${D.semVisita}</b><span>sem visita há 15+ dias</span></button>
        </div>
        <div class="acab-acts"><button class="cp-btn pri" data-cp="visita-nova">${svg(IC.mais)}Nova visita</button><button class="cp-btn" data-cp="rota">${svg(IC.rota)}Rota do dia</button></div>
        ${D.agenda ? `<button class="acab-agenda" data-cp="agenda">${svg(IC.agenda)}<span><b>Agenda de hoje</b><small>${D.agenda.h ? `${D.agenda.feitas} de ${D.agenda.h} ${D.agenda.h === 1 ? 'visita feita' : 'visitas feitas'}` : 'Nenhuma visita agendada para hoje'}</small></span>${D.agenda.atr ? `<em>${D.agenda.atr} ${D.agenda.atr === 1 ? 'atrasada' : 'atrasadas'}</em>` : ''}${svg(IC.seta, 'acab-chev')}</button>` : ''}
        <section class="acab-cc" id="acab-alertas"><h2>${svg(IC.alerta)}Alertas de praga<small>últimos 15 dias</small></h2>
          ${al.length ? `<ul class="acab-clist">${al.map(a => `<li><button data-acab-tal="${esc(a.t.id)}"><i class="acab-sem" style="background:${corSem(a.s)}"></i><span><b>${esc(a.t.nome)}</b><small>${esc(nomeFaz(a.t.fazenda_id))}${a.v.alvo ? ' · ' + esc(a.v.alvo) : ''}</small></span><em>${quando(a.d)}</em>${svg(IC.seta, 'acab-chev')}</button></li>`).join('')}</ul>${D.alertas.length > al.length ? `<p class="acab-mais">e mais ${D.alertas.length - al.length} no mapa de calor</p>` : ''}`
          : `<div class="acab-okbox">${svg(IC.ok)}<span>Nenhum talhão em alerta. Tudo no verde.</span></div>`}
        </section>
        <section class="acab-cc"><h2>${svg(IC.chuva)}Chuva e tempo</h2>
          <div class="acab-chv"><span><small>Chuva hoje</small><b class="num">${D.chHoje.length ? mm(D.maxH) : '—'}</b></span><span><small>Ontem</small><b class="num">${D.chOntem.length ? mm(D.maxO) : '—'}</b></span><button class="cp-btn" data-cp="chuva">Registrar</button></div>
          <div class="acab-prevbox" data-acab-prev><p class="acab-mut">Carregando previsão…</p></div>
        </section>
        ${D.ordHoje.length || D.ordAtr.length ? `<section class="acab-cc"><h2>${svg(IC.ordem)}Ordens de trabalho</h2><ul class="acab-clist">${[...D.ordAtr.slice(0, 3).map(o => [o, 1]), ...D.ordHoje.slice(0, 3).map(o => [o, 0])].map(([o, atr]) => `<li><button data-acab-ord="${esc(o.id)}"><i class="acab-sem" style="background:${atr ? 'var(--bad)' : 'var(--info)'}"></i><span><b>${esc(o.titulo || o.tipo || 'Ordem')}</b><small>${esc(nomeFaz(o.fazenda_id))}</small></span><em>${atr ? 'atrasada' : 'hoje'}</em>${svg(IC.seta, 'acab-chev')}</button></li>`).join('')}</ul></section>` : ''}
        ${adm && D.contas ? `<section class="acab-cc"><h2>${svg(IC.contas)}Contas<small>só você vê</small></h2>${contasHtml(D.contas)}</section>` : ''}
      </div>`;
    const f = fazPrevisao(D), box = $('[data-acab-prev]', el);
    if (f) mostrarPrev(box, f); else box.innerHTML = '';
  }

  // =====================================================================
  // 4. Busca rápida (Ctrl K no computador; lupa no celular)
  // =====================================================================
  const TIPO = { faz: ['Fazendas', IC.fazenda], tal: ['Talhões', IC.talhao], vis: ['Visitas', IC.visita], prod: ['Produtores', IC.produtor], ord: ['Ordens', IC.ordem] };
  let idx = null, idxVer = null;
  function indice() {
    const S = I().S, ver = S.data.talhoes.length + ':' + S.data.monitoramentos.length + ':' + S.data.fazendas.length + ':' + S.data.ordens.length;
    if (idx && idxVer === ver) return idx;
    const out = [];
    for (const p of S.data.produtores) out.push({ k: 'prod', id: p.id, t: p.nome, s: (S.fazPorProd.get(String(p.id)) || []).length + ' fazendas' });
    for (const f of S.data.fazendas) { const ts = S.talPorFaz.get(String(f.id)) || []; out.push({ k: 'faz', id: f.id, t: f.nome, s: ((I().get('produtores', f.produtor_id) || {}).nome || '') + ' · ' + ts.length + ' talhões' }); }
    for (const t of S.data.talhoes) { const c = I().culturaAtual(t); out.push({ k: 'tal', id: t.id, t: t.nome, s: nomeFaz(t.fazenda_id) + ' · ' + I().fmtHa(t.area_ha) + ' ha' + (c && c.variedade ? ' · ' + c.variedade : ''), x: c && c.variedade }); }
    for (const m of S.data.monitoramentos) { const t = I().get('talhoes', m.talhao_id); out.push({ k: 'vis', id: m.id, t: 'Visita ' + I().fmtDate(m.data) + (t ? ' · ' + t.nome : ''), s: (t ? nomeFaz(t.fazenda_id) : '') + (m.alvo ? ' · ' + m.alvo : m.tipo ? ' · ' + m.tipo : ''), x: [m.obs, m.alvo, m.estadio].filter(Boolean).join(' '), d: m.data }); }
    for (const o of S.data.ordens) out.push({ k: 'ord', id: o.id, t: o.titulo || o.tipo || 'Ordem', s: nomeFaz(o.fazenda_id) + (o.status ? ' · ' + o.status : '') + (o.data_prevista ? ' · ' + I().fmtDate(o.data_prevista) : ''), d: o.data_prevista });
    for (const r of out) { r.n = norm(r.t); r.a = norm(r.t + ' ' + r.s + ' ' + (r.x || '')); }
    idxVer = ver; return idx = out;
  }
  function procurar(q) {
    const qs = norm(q).split(/\s+/).filter(Boolean); if (!qs.length) return [];
    const res = [];
    for (const r of indice()) {
      if (emCampo() && r.k === 'prod') continue;
      if (!qs.every(w => r.a.includes(w))) continue;
      let p = r.n.startsWith(qs[0]) ? 0 : r.n.includes(qs[0]) ? 1 : 2;
      if (r.k === 'vis' || r.k === 'ord') p += 1;
      res.push([p, r]);
    }
    res.sort((a, b) => a[0] - b[0] || (b[1].d || '').localeCompare(a[1].d || '') || a[1].t.localeCompare(b[1].t, 'pt-BR', { numeric: true }));
    const lim = { faz: 5, tal: 8, vis: 6, prod: 4, ord: 4 }, grupos = {}, melhor = {};
    for (const [p, r] of res) { (grupos[r.k] = grupos[r.k] || []); if (grupos[r.k].length < lim[r.k]) grupos[r.k].push(r); if (melhor[r.k] == null) melhor[r.k] = p; }
    const ordem = ['faz', 'tal', 'prod', 'vis', 'ord'];
    return Object.keys(grupos).sort((a, b) => melhor[a] - melhor[b] || ordem.indexOf(a) - ordem.indexOf(b)).flatMap(k => grupos[k]);
  }
  const RECENTES = 'inovaagro.busca.recentes';
  let B = null;
  function buscar() {
    if (!I() || !I().S || !I().S.data || !I().S.data.talhoes) return;
    if (B) { B.q.focus(); return; }
    const el = document.createElement('div'); el.className = 'acab-busca-bg' + (emCampo() ? ' campo' : '');
    el.innerHTML = `<div class="acab-busca" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <div class="acab-bq">${svg(IC.lupa)}<input type="search" placeholder="Fazenda, talhão, visita${emCampo() ? '' : ', produtor'} ou ordem" aria-label="Buscar" autocomplete="off" enterkeyhint="search"><button class="acab-bx" data-acab="fechar-busca">${emCampo() ? 'Cancelar' : '<kbd>Esc</kbd>'}</button></div>
      <div class="acab-br" role="listbox"></div></div>`;
    document.body.appendChild(el);
    B = { el, q: $('input', el), res: $('.acab-br', el), sel: 0, itens: [] };
    B.q.addEventListener('input', () => { B.sel = 0; lista(); });
    B.q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!B.itens.length) return; B.sel = (B.sel + (e.key === 'ArrowDown' ? 1 : -1) + B.itens.length) % B.itens.length; marcar(); }
      else if (e.key === 'Enter') { e.preventDefault(); const r = B.itens[B.sel]; if (r) abrir(r); }
      else if (e.key === 'Escape') fecharBusca();
    });
    el.addEventListener('pointerdown', e => { if (e.target === el) fecharBusca(); });
    lista();
    requestAnimationFrame(() => { el.classList.add('on'); B.q.focus(); });
  }
  function lista() {
    const q = B.q.value.trim();
    let itens;
    if (!q) {
      itens = ls.get(RECENTES, []).map(x => indice().find(r => r.k === x.k && String(r.id) === String(x.id))).filter(Boolean).filter(r => !(emCampo() && r.k === 'prod'));
      B.itens = itens;
      B.res.innerHTML = itens.length ? `<div class="acab-bg">Abertos recentemente</div>` + itens.map((r, i) => linha(r, i, '')).join('') : `<div class="acab-bvazio">${svg(IC.lupa)}<p>Digite poucas letras do nome da fazenda, do talhão ou da praga.<br><small>Ex.: "bocaina 004", "broca", "20/01"</small></p></div>`;
    } else {
      itens = procurar(q); B.itens = itens;
      let g = null, i = 0, h = '';
      for (const r of itens) { if (r.k !== g) { g = r.k; h += `<div class="acab-bg">${TIPO[g][0]}</div>`; } h += linha(r, i++, q); }
      B.res.innerHTML = h || `<div class="acab-bvazio"><p>Nada encontrado para "<b>${esc(q)}</b>".</p></div>`;
    }
    marcar();
  }
  function realce(txt, q) {
    const s = esc(txt); if (!q) return s;
    const w = norm(q).split(/\s+/).filter(Boolean)[0]; if (!w) return s;
    const i = norm(txt).indexOf(w); if (i < 0) return s;
    return esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + w.length)) + '</mark>' + esc(txt.slice(i + w.length));
  }
  const linha = (r, i, q) => `<button class="acab-bi" role="option" data-i="${i}"><i>${svg(TIPO[r.k][1])}</i><span><b>${realce(r.t, q)}</b><small>${esc(r.s)}</small></span>${svg(IC.seta, 'acab-chev')}</button>`;
  function marcar() {
    $$('.acab-bi', B.res).forEach(b => { const on = +b.dataset.i === B.sel; b.setAttribute('aria-selected', on); if (on && !emCampo()) b.scrollIntoView({ block: 'nearest' }); });
  }
  document.addEventListener('click', e => { if (!B) return; const b = e.target.closest('.acab-bi'); if (b && B.el.contains(b)) abrir(B.itens[+b.dataset.i]); });
  function fecharBusca() { if (!B) return; const el = B.el; B = null; el.classList.remove('on'); setTimeout(() => el.remove(), semMovimento() ? 0 : 160); }
  function abrir(r) {
    if (!r) return;
    const rec = ls.get(RECENTES, []).filter(x => !(x.k === r.k && String(x.id) === String(r.id))); rec.unshift({ k: r.k, id: r.id }); ls.set(RECENTES, rec.slice(0, 6));
    fecharBusca();
    irPara(r.k, r.id);
  }
  function irPara(k, id) {
    const A = I();
    if (emCampo() && C()) {
      if (k === 'faz') C().irFazenda(id);
      else if (k === 'tal') C().irTalhao(id);
      else if (k === 'vis') { const m = A.get('monitoramentos', id); if (m) C().abrirVisita(m); }
      else if (k === 'ord') { const o = A.get('ordens', id); if (o) A.openForm('ordens', o); }
      return;
    }
    if (k === 'faz') { location.hash = 'mapa'; setTimeout(() => A.selectFazenda(id, true), 80); }
    else if (k === 'tal') { location.hash = 'mapa'; setTimeout(() => A.selectTalhao(id, true), 80); }
    else if (k === 'prod') { location.hash = 'mapa'; setTimeout(() => A.selectProdutor(id), 80); }
    else if (k === 'vis') { const m = A.get('monitoramentos', id); if (m) A.openForm('monitoramentos', m); }
    else if (k === 'ord') { const o = A.get('ordens', id); if (o) A.openForm('ordens', o); }
  }

  // =====================================================================
  // 5. Ditado por voz nas observações
  // =====================================================================
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, recTa = null, recBtn = null;
  function prepararTextos(raiz) {
    for (const ta of $$('textarea', raiz)) {
      if (ta.dataset.voz || ta.dataset.semVoz != null || ta.readOnly || ta.closest('.acab-voz')) continue;
      ta.dataset.voz = 1;
      const w = document.createElement('div'); w.className = 'acab-voz';
      ta.parentNode.insertBefore(w, ta); w.appendChild(ta);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'acab-mic'; b.setAttribute('aria-label', 'Ditar por voz'); b.title = 'Falar em vez de digitar'; b.innerHTML = svg(IC.mic) + '<span>Falar</span>';
      w.appendChild(b);
    }
  }
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; if (n.tagName === 'TEXTAREA') prepararTextos(n.parentNode); else if (n.getElementsByTagName('textarea').length) prepararTextos(n); } }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', e => { const b = e.target.closest('.acab-mic'); if (!b) return; e.preventDefault(); e.stopPropagation(); const ta = $('textarea', b.parentNode); if (rec && recTa === ta) pararVoz(); else ditar(ta, b); }, true);
  const aviso = t => (I() && I().toast ? I().toast(t) : alert(t));
  function ditar(ta, btn) {
    pararVoz();
    if (!SR) { ta.focus(); aviso('Para falar, toque no microfone do teclado do celular.'); return; }
    if (!navigator.onLine) { ta.focus(); aviso('O ditado precisa de internet. Sem sinal, use o microfone do teclado.'); return; }
    let r; try { r = new SR(); } catch (e) { ta.focus(); aviso('Para falar, toque no microfone do teclado do celular.'); return; }
    r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
    const antes = ta.value.slice(0, ta.selectionStart ?? ta.value.length), depois = ta.value.slice(ta.selectionEnd ?? ta.value.length);
    const sep = antes && !/\s$/.test(antes) ? ' ' : '';
    let final = '';
    const montar = (txt) => { const t = (final + txt).replace(/\s+/g, ' ').trim(); const frase = t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; ta.value = antes + (frase ? sep + frase : '') + depois; ta.dispatchEvent(new Event('input', { bubbles: true })); };
    r.onresult = ev => { let inter = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const x = ev.results[i]; if (x.isFinal) final += x[0].transcript + ' '; else inter += x[0].transcript; } montar(inter); };
    r.onerror = ev => { const m = { 'not-allowed': 'Permita o uso do microfone para ditar.', 'service-not-allowed': 'Ditado indisponível aqui. Toque no microfone do teclado do celular.', network: 'O ditado precisa de internet. Sem sinal, use o microfone do teclado.', 'no-speech': 'Não ouvi nada. Toque em Falar e fale perto do celular.' }[ev.error]; if (m) aviso(m); };
    r.onend = () => { if (rec !== r) return; montar(''); ta.dispatchEvent(new Event('change', { bubbles: true })); limparVoz(); };
    rec = r; recTa = ta; recBtn = btn;
    btn.classList.add('on'); btn.innerHTML = svg(IC.parar) + '<span>Ouvindo… toque para parar</span>'; btn.setAttribute('aria-label', 'Parar o ditado');
    try { r.start(); } catch (e) { limparVoz(); aviso('Não foi possível ligar o microfone.'); }
  }
  function pararVoz() { if (rec) { try { rec.stop(); } catch (e) { } } }
  function limparVoz() { if (recBtn) { recBtn.classList.remove('on'); recBtn.innerHTML = svg(IC.mic) + '<span>Falar</span>'; recBtn.setAttribute('aria-label', 'Ditar por voz'); } rec = recTa = recBtn = null; }

  // =====================================================================
  // Cliques gerais
  // =====================================================================
  document.addEventListener('click', e => {
    const tb = e.target.closest('[data-acab-tema]'); if (tb) { setTema(tb.dataset.acabTema); if (tb.closest('.acab-pop')) setTimeout(fecharPop, 120); return; }
    const a = e.target.closest('[data-acab]');
    if (a) { const v = a.dataset.acab; if (v === 'buscar') { e.preventDefault(); buscar(); } else if (v === 'fechar-busca') fecharBusca(); else if (v === 'tema') menuTema(a); return; }
    const t = e.target.closest('[data-acab-tal]'); if (t) { irPara('tal', t.dataset.acabTal); return; }
    const v = e.target.closest('[data-acab-vis]'); if (v) { irPara('vis', v.dataset.acabVis); return; }
    const o = e.target.closest('[data-acab-ord]'); if (o) { irPara('ord', o.dataset.acabOrd); return; }
    if (e.target.closest('[data-acab-alertas]')) { const s = $('#acab-alertas'); if (s) s.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'start' }); return; }
    if (e.target.closest('[data-acab-contas]') && emCampo() && window.Financeiro) { e.preventDefault(); window.Financeiro.celular(); }
  });

  pintarTema();
  if (document.readyState !== 'loading') prepararTextos(document); else document.addEventListener('DOMContentLoaded', () => { prepararTextos(document); pintarTema(); });
  return { entrou, resumoSite, resumoCampo, buscar, temaSeg, setTema, pintarTema };
})();
