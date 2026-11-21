/* INOVAAGRO — Agenda da equipe: visitas planejadas por técnico e por semana, com aviso das atrasadas.
   Cada visita agendada fica na tabela "agenda" (supabase/06_agenda.sql). O administrador vê e planeja a agenda de todos;
   o técnico vê e planeja só a própria. Funciona sem internet como o resto do app (fila do aparelho).
   Uma visita agendada vira "feita" sozinha quando o técnico registra uma visita (monitoramento) naquela fazenda
   (ou num dos talhões escolhidos) a partir de 3 dias antes da data marcada. Também dá para marcar à mão. */
window.Agenda = (function () {
  'use strict';
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => I().esc(s);
  const lc = s => String(s == null ? '' : s).trim().toLowerCase();
  const S = () => I().S;

  // ---------- Datas (sempre no fuso do aparelho) ----------
  const p2 = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const dt = s => new Date(String(s).slice(0, 10) + 'T12:00:00');
  const hoje = () => iso(new Date());
  const somar = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };
  const somarMes = (s, n) => { const d = dt(s), dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
  const segunda = s => somar(s, -((dt(s).getDay() + 6) % 7));
  const entre = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
  const SEM = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const SEM_L = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
  const dSem = s => (dt(s).getDay() + 6) % 7;
  function rotSemana(seg) {
    const a = dt(seg), b = dt(somar(seg, 6));
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MES[b.getMonth()]}`;
    return `${a.getDate()} de ${MES[a.getMonth()].slice(0, 3)} a ${b.getDate()} de ${MES[b.getMonth()].slice(0, 3)}` + (a.getFullYear() !== b.getFullYear() ? ' ' + b.getFullYear() : '');
  }
  const diaLongo = s => { const d = dt(s); const r = `${SEM_L[dSem(s)]}, ${d.getDate()} de ${MES[d.getMonth()]}`; return s === hoje() ? 'Hoje, ' + r : s === somar(hoje(), 1) ? 'Amanhã, ' + r : r.charAt(0).toUpperCase() + r.slice(1); };
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

  // ---------- Cadastros ----------
  const OBJETIVOS = ['Levantamento de pragas', 'Acompanhamento da lavoura', 'Recomendação técnica', 'Acompanhar aplicação', 'Avaliação de plantio e brotação', 'Liberação de Cotesia', 'Pré-colheita e maturação', 'Reunião com o cliente', 'Outro'];
  const REPETIR = [['', 'Não repetir'], ['7', 'Toda semana'], ['14', 'A cada 2 semanas'], ['m', 'Todo mês']];
  const JANELA = 3; // uma visita até 3 dias antes da data marcada também conta

  // ---------- Estado e preferências ----------
  const LS = 'inovaagro.agenda.v1';
  const A = { semana: segunda(hoje()), tec: '', modo: 'semana' };
  try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); if (o.tec != null) A.tec = o.tec; if (o.modo) A.modo = o.modo; } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem(LS, JSON.stringify({ tec: A.tec, modo: A.modo })); } catch (e) { } };
  const M = { dia: hoje(), tec: null }; // tela do celular

  const online = () => I().Store.mode === 'supabase';
  const eu = () => lc((I().SB.user && I().SB.user.email) || 'local');
  const souAdmin = () => S().papel === 'admin' || !online();
  const podeEditar = () => I().podeEditar();
  const itens = () => S().data.agenda || [];
  // O banco já só entrega ao técnico a agenda dele; o filtro aqui vale também para a cópia do aparelho.
  const visiveis = () => souAdmin() ? itens() : itens().filter(x => lc(x.tecnico) === eu());
  const faz = id => I().get('fazendas', id);
  const tal = id => I().get('talhoes', id);
  const prod = id => I().get('produtores', id);
  const nomeFaz = x => (faz(x.fazenda_id) || {}).nome || 'Fazenda removida';
  const nomeCli = x => (prod(x.produtor_id || (faz(x.fazenda_id) || {}).produtor_id) || {}).nome || '';
  const ordTal = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true });
  const talsTxt = x => { const l = (x.talhao_ids || []).map(tal).filter(Boolean).sort(ordTal).map(t => t.nome); return l.length ? (l.length > 4 ? l.slice(0, 4).join(', ') + ' e mais ' + (l.length - 4) : l.join(', ')) : ''; };
  const ordItem = (a, b) => (a.data || '').localeCompare(b.data || '') || (a.hora || '99').localeCompare(b.hora || '99') || nomeFaz(a).localeCompare(nomeFaz(b), 'pt-BR');

  // ---------- Equipe (nomes guardados para usar sem internet) ----------
  let equipeCache = {};
  try { equipeCache = JSON.parse(localStorage.getItem(LS + '.equipe') || '{}'); } catch (e) { }
  let equipeOk = false;
  async function carregarEquipe() {
    if (equipeOk || !online() || !navigator.onLine || S().papel !== 'admin') return;
    equipeOk = true;
    try {
      const m = {};
      for (const x of await I().SB.membros()) if (x.ativo !== false && x.papel !== 'leitura') m[lc(x.email)] = x.nome || '';
      equipeCache = m; try { localStorage.setItem(LS + '.equipe', JSON.stringify(m)); } catch (e) { }
      if (root && !root.hidden) render();
    } catch (e) { equipeOk = false; }
  }
  const nome = em => { em = lc(em); if (!em) return 'Sem técnico'; if (em === 'local') return 'Eu'; return equipeCache[em] || (I().nomeDe ? I().nomeDe(em) : em); };
  const primeiro = em => { const n = nome(em); return n.includes('@') ? n.split('@')[0] : n.split(/\s+/)[0]; };
  const iniciais = em => { const n = nome(em); return n.includes('@') ? n.slice(0, 2).toUpperCase() : n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); };
  function equipe() {
    const s = new Set();
    if (souAdmin()) { for (const em of Object.keys(equipeCache)) s.add(em); for (const x of itens()) if (x.tecnico) s.add(lc(x.tecnico)); }
    s.add(eu());
    return [...s].sort((a, b) => (a === eu() ? -1 : b === eu() ? 1 : 0) || nome(a).localeCompare(nome(b), 'pt-BR'));
  }

  // ---------- Situação de cada visita agendada ----------
  // Índice das visitas registradas por fazenda; refeito quando os dados mudam.
  let idx = null, idxRef = null;
  const sitCache = new Map();
  document.addEventListener('inova:dados', () => { idx = null; sitCache.clear(); });
  function visitasPorFaz() {
    const mons = S().data.monitoramentos || [];
    if (idx && idxRef === mons) return idx;
    idx = new Map(); idxRef = mons; sitCache.clear();
    for (const m of mons) {
      if (!m.data) continue;
      const t = tal(m.talhao_id), f = String((t && t.fazenda_id) || m.fazenda_id || '');
      if (!f) continue;
      if (!idx.has(f)) idx.set(f, []);
      idx.get(f).push({ d: m.data.slice(0, 10), m, tal: String(m.talhao_id), quem: lc(m.responsavel || m.criado_por) });
    }
    for (const l of idx.values()) l.sort((a, b) => a.d.localeCompare(b.d));
    return idx;
  }
  function visitasDe(x) {
    const tl = (x.talhao_ids || []).map(String), quem = lc(x.tecnico), ini = somar(x.data, -JANELA), id = String(x.id);
    return (visitasPorFaz().get(String(x.fazenda_id)) || []).filter(v =>
      v.m.agenda_id != null ? String(v.m.agenda_id) === id
        : v.d >= ini && (!quem || quem === 'local' || v.quem === quem) && (!tl.length || tl.includes(v.tal)));
  }
  function situacao(x) {
    const ck = x.id + '|' + (x.atualizado_em || '') + '|' + hoje();
    visitasPorFaz();
    if (sitCache.has(ck)) return sitCache.get(ck);
    const h = hoje(); let r;
    if (x.status === 'Cancelada') r = { k: 'cancelada', txt: 'Cancelada', cls: '' };
    else {
      const vs = visitasDe(x);
      if (vs.length || x.status === 'Feita') {
        const d = vs.length ? vs[0].d : (x.feita_em || x.data).slice(0, 10), atraso = Math.max(0, entre(x.data, d));
        const tl = (x.talhao_ids || []).length, feitos = tl ? new Set(vs.map(v => v.tal)).size : 0;
        r = { k: 'feita', vs, d, atraso, cls: 'ok', manual: !vs.length, txt: atraso ? `Feita em ${dm(d)} (${plural(atraso, 'dia', 'dias')} depois)` : 'Feita', parcial: tl > 1 && feitos < tl ? `${feitos} de ${tl} talhões` : '' };
      } else if (x.data < h) { const n = entre(x.data, h); r = { k: 'atrasada', n, cls: 'bad', txt: `Atrasada ${plural(n, 'dia', 'dias')}` }; }
      else if (x.data === h) r = { k: 'hoje', cls: 'info', txt: 'Hoje' };
      else r = { k: 'agendada', cls: '', txt: 'Agendada' };
    }
    sitCache.set(ck, r); return r;
  }
  const atrasadas = (lista = visiveis()) => lista.filter(x => situacao(x).k === 'atrasada').sort(ordItem);
  const minhas = () => visiveis().filter(x => lc(x.tecnico) === eu());

  // ---------- Gravação ----------
  async function salvar(x) { await I().Store.save('agenda', x); }
  async function marcar(x, st) {
    const o = Object.assign({}, x, { status: st });
    if (st === 'Feita') o.feita_em = hoje(); else delete o.feita_em;
    await salvar(o);
    I().toast(st === 'Feita' ? 'Visita marcada como feita.' : st === 'Cancelada' ? 'Visita cancelada.' : 'Visita reaberta.');
  }
  async function reagendar(x, data, tec) {
    if (!data || (data === x.data && (tec == null || lc(tec) === lc(x.tecnico)))) return;
    const o = Object.assign({}, x, { data, status: 'Agendada' });
    if (!o.reagendada_de && data !== x.data) o.reagendada_de = x.data;
    if (tec != null) o.tecnico = tec;
    await salvar(o);
    I().toast(`Visita passada para ${SEM[dSem(data)]} ${dm(data)}` + (tec != null && lc(tec) !== lc(x.tecnico) ? ' · ' + primeiro(tec) : '') + '.');
  }

  // ---------- Avisos (Notificações) ----------
  function avisos() {
    if (!window.INOVA || !S().data.agenda) return [];
    const out = [], h = hoje(), me = eu();
    const atr = atrasadas();
    for (const x of atr.filter(x => lc(x.tecnico) === me))
      out.push({ id: 'agd-' + x.id + '-' + x.data, tipo: 'atividades', data: x.data, cor: '#d03b3b', t: `Visita atrasada: ${nomeFaz(x)}`, d: `Agendada para ${dm(x.data)}${x.objetivo ? ' · ' + x.objetivo : ''}`, go: 'agd:' + x.id });
    if (souAdmin()) {
      const por = new Map();
      for (const x of atr) { const k = lc(x.tecnico); if (k === me) continue; if (!por.has(k)) por.set(k, []); por.get(k).push(x); }
      for (const [k, l] of por) out.push({ id: 'agdt-' + k + '-' + l.length + '-' + l[l.length - 1].data, tipo: 'atividades', data: l[l.length - 1].data, cor: '#d03b3b', t: `${nome(k)}: ${plural(l.length, 'visita atrasada', 'visitas atrasadas')}`, d: l.slice(0, 3).map(nomeFaz).join(', ') + (l.length > 3 ? '…' : ''), go: 'agd:atrasadas' });
    }
    const hj = minhas().filter(x => x.data === h && situacao(x).k === 'hoje');
    if (hj.length) out.push({ id: 'agdh-' + h + '-' + hj.length, tipo: 'atividades', data: h, cor: '#2a78d6', t: `Você tem ${plural(hj.length, 'visita agendada', 'visitas agendadas')} para hoje`, d: hj.sort(ordItem).map(nomeFaz).join(', '), go: 'agd:hoje' });
    return out;
  }
  // número para o menu: atrasadas que a pessoa enxerga
  const contar = () => S().data.agenda ? atrasadas().length : 0;
  // celular: o que é meu para hoje (pendente) + atrasadas minhas
  const contarMeu = () => S().data.agenda ? minhas().filter(x => { const k = situacao(x).k; return k === 'hoje' || k === 'atrasada'; }).length : 0;

  // ---------- Rota do dia (modo campo) ----------
  // Paradas que vêm da agenda: as minhas de hoje e as atrasadas. Sem talhão escolhido, vai o talhão mais central da fazenda.
  function paraRota(fazFiltro) {
    if (!S().data.agenda) return [];
    const out = [];
    for (const x of minhas().sort(ordItem)) {
      const s = situacao(x); if (s.k !== 'hoje' && s.k !== 'atrasada') continue;
      if (fazFiltro && String(x.fazenda_id) !== String(fazFiltro)) continue;
      let ts = (x.talhao_ids || []).map(tal).filter(t => t && t.geometry);
      if (!ts.length) { const r = representante(x.fazenda_id); if (r) ts = [r]; }
      for (const t of ts) out.push({ t, x, txt: s.k === 'hoje' ? 'Agendada para hoje' + (x.hora ? ' · ' + x.hora : '') : 'Agendada · ' + s.txt.toLowerCase(), cl: s.k === 'atrasada' ? 'ag atr' : 'ag' });
    }
    return out;
  }
  function representante(fid) {
    const ts = (S().talPorFaz.get(String(fid)) || []).filter(t => t.geometry); if (!ts.length) return null;
    const f = faz(fid), c = I().centroFaz && f ? I().centroFaz(f) : null;
    if (!c || !window.L) return ts[0];
    const cen = t => { try { return L.geoJSON(t.geometry).getBounds().getCenter(); } catch (e) { return null; } };
    let best = ts[0], bd = Infinity;
    for (const t of ts) { const p = cen(t); if (!p) continue; const d = p.distanceTo(c); if (d < bd) { bd = d; best = t; } }
    return best;
  }

  // ---------- Ícones ----------
  const svg = (p, c = '') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17.5h2"/>',
    esq: '<path d="m15 5-7 7 7 7"/>', dir: '<path d="m9 5 7 7-7 7"/>', mais: '<path d="M12 5v14M5 12h14"/>',
    ok: '<path d="m5 12 4.5 4.5L19 7"/>', relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pino: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    whats: '<path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.6l1.2-1.2 1.8.8-.4 1.6c-3.5.4-7.6-3.6-7.2-7.2l1.6-.4.8 1.8z"/>',
    xls: '<path d="M6 3h9l4 4v14H6z"/><path d="M9.5 11l4 5M13.5 11l-4 5"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  };

  // ======================================================================
  // Tela do site (computador)
  // ======================================================================
  let root = null, arrastando = null;
  function view(entrando) {
    root = $('#v-agenda'); if (!root) return;
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.addEventListener('click', clique);
      root.addEventListener('change', mudou);
      root.addEventListener('dragstart', e => { const c = e.target.closest('[data-agd-abrir][draggable="true"]'); if (!c) return; arrastando = c.dataset.agdAbrir; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', arrastando); } catch (er) { } c.classList.add('arrastando'); });
      root.addEventListener('dragend', () => { arrastando = null; $$('.arrastando, .alvo', root).forEach(el => el.classList.remove('arrastando', 'alvo')); });
      root.addEventListener('dragover', e => { const c = arrastando && e.target.closest('.agd-cel[data-dia]'); if (!c) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!c.classList.contains('alvo')) { $$('.alvo', root).forEach(el => el.classList.remove('alvo')); c.classList.add('alvo'); } });
      root.addEventListener('drop', e => { const c = arrastando && e.target.closest('.agd-cel[data-dia]'); if (!c) return; e.preventDefault(); const x = I().get('agenda', arrastando); arrastando = null; if (x) reagendar(x, c.dataset.dia, c.dataset.tec && souAdmin() ? c.dataset.tec : null).catch(() => { }); });
    }
    if (entrando) carregarEquipe();
    render();
  }
  function card(x, comTec) {
    const s = situacao(x), mov = podeEditar() && (s.k === 'agendada' || s.k === 'hoje' || s.k === 'atrasada');
    const tt = talsTxt(x);
    return `<button class="agd-card st-${s.k}" data-agd-abrir="${esc(x.id)}" draggable="${mov}" title="${esc(nomeFaz(x) + (x.objetivo ? ' · ' + x.objetivo : ''))}">
      <span class="agd-ct">${x.hora ? `<time>${esc(x.hora)}</time>` : ''}<b>${esc(nomeFaz(x))}</b></span>
      ${nomeCli(x) ? `<small>${esc(nomeCli(x))}</small>` : ''}
      <span class="agd-meta">${esc(x.objetivo || 'Visita')}${tt ? ` · <span class="agd-tl">${(x.talhao_ids || []).length > 1 ? 'talhões' : 'talhão'} ${esc(tt)}</span>` : ''}</span>
      ${comTec ? `<span class="agd-quem">${esc(primeiro(x.tecnico))}</span>` : ''}
      ${s.k === 'feita' ? `<span class="agd-st ok">${svg(IC.ok)}${esc(s.atraso ? 'Feita ' + dm(s.d) : 'Feita')}${s.manual ? ' (manual)' : ''}</span>` : s.k === 'atrasada' ? `<span class="agd-st bad">${esc(s.txt)}</span>` : s.k === 'cancelada' ? '<span class="agd-st">Cancelada</span>' : ''}
    </button>`;
  }
  function render() {
    if (!root) return;
    const adm = souAdmin(), h = hoje(), seg = A.semana, dds = [0, 1, 2, 3, 4, 5, 6].map(i => somar(seg, i)), fim = dds[6];
    if (!adm) A.tec = '';
    const filtro = x => !A.tec || lc(x.tecnico) === A.tec;
    const base = visiveis().filter(filtro);
    const semana = base.filter(x => x.data >= seg && x.data <= fim);
    const ativas = semana.filter(x => x.status !== 'Cancelada');
    const feitas = ativas.filter(x => situacao(x).k === 'feita');
    const vencidas = ativas.filter(x => x.data <= h && x.data >= seg);
    const feitasVenc = vencidas.filter(x => situacao(x).k === 'feita').length;
    const atr = atrasadas(base);
    const prox = base.filter(x => x.data > h && x.data <= somar(h, 7) && x.status !== 'Cancelada').length;
    const pct = vencidas.length ? Math.round(feitasVenc / vencidas.length * 100) : null;
    const pode = podeEditar();
    const pessoas = equipe();
    const multi = adm && !A.tec;
    const rows = multi ? pessoas.filter(p => p !== 'local' || !pessoas.some(q => q !== 'local')) : [A.tec || eu()];
    for (const x of semana) { const k = lc(x.tecnico); if (multi && !rows.includes(k)) rows.push(k); }
    const aviso = S().faltaAgenda ? `<div class="note"><b>Falta um passo para salvar na nuvem.</b> O administrador precisa rodar uma vez o arquivo <code>supabase/06_agenda.sql</code> no editor SQL do Supabase. Até lá, o que for agendado fica guardado só neste aparelho.</div>` : '';
    const subt = adm ? 'Visitas planejadas por técnico e por semana. Arraste um cartão para mudar o dia ou o técnico.' : 'Suas visitas planejadas da semana. Arraste um cartão para mudar o dia.';
    root.innerHTML = `<div class="page agd">
      <div class="page-head"><div><h2>Agenda da equipe</h2><p>${subt}</p></div>
        <div class="head-acts"><button class="btn" data-agd="whats">${svg(IC.whats)} WhatsApp</button><button class="btn" data-agd="xls">${svg(IC.xls)} Excel</button>${pode ? `<button class="btn primary" data-agd="novo">${svg(IC.mais)} Agendar visita</button>` : ''}</div></div>
      ${aviso}
      <div class="agd-bar">
        <div class="agd-nav"><button class="btn small" data-agd="ant" aria-label="Semana anterior">${svg(IC.esq)}</button><button class="btn small" data-agd="hoje" ${seg === segunda(h) ? 'disabled' : ''}>Esta semana</button><button class="btn small" data-agd="prox" aria-label="Próxima semana">${svg(IC.dir)}</button><h3>${esc(rotSemana(seg))}</h3></div>
        <div class="agd-fil">
          ${adm ? `<label class="agd-sel">${svg(IC.pessoa)}<select data-agd="tec" aria-label="Técnico"><option value="">Equipe toda</option>${pessoas.map(p => `<option value="${esc(p)}" ${A.tec === p ? 'selected' : ''}>${esc(nome(p))}${p === eu() ? ' (eu)' : ''}</option>`).join('')}</select></label>` : ''}
          <div class="seg" role="group" aria-label="Visão"><button data-agd="modo" data-m="semana" aria-pressed="${A.modo === 'semana'}">Semana</button><button data-agd="modo" data-m="atrasadas" aria-pressed="${A.modo === 'atrasadas'}">Atrasadas${atr.length ? ` <span class="agd-n">${atr.length}</span>` : ''}</button></div>
        </div>
      </div>
      <div class="tiles agd-tiles">
        <div class="tile"><span class="lbl">Agendadas na semana</span><span class="val num">${ativas.length}</span><span class="sub">${semana.length - ativas.length ? plural(semana.length - ativas.length, 'cancelada', 'canceladas') : multi ? plural(new Set(ativas.map(x => lc(x.tecnico))).size, 'técnico', 'técnicos') : rotSemana(seg)}</span></div>
        <div class="tile"><span class="lbl">Feitas</span><span class="val num">${feitas.length}</span><span class="sub">${pct == null ? 'nada vencido ainda nesta semana' : `${pct}% das que já venceram`}</span>${pct == null ? '' : `<span class="agd-prog" style="--p:${pct}%"></span>`}</div>
        <div class="tile ${atr.length ? 'alert' : ''}"><span class="lbl">Atrasadas</span><span class="val num">${atr.length}</span><span class="sub">${atr.length ? 'a mais antiga é de ' + dm(atr[0].data) : 'nenhuma pendência'}</span></div>
        <div class="tile"><span class="lbl">Próximos 7 dias</span><span class="val num">${prox}</span><span class="sub">${plural(base.filter(x => x.data === h && situacao(x).k === 'hoje').length, 'visita hoje', 'visitas hoje')}</span></div>
      </div>
      ${A.modo === 'atrasadas' ? listaAtrasadas(atr, adm, pode) : grade(dds, rows, semana, multi, pode, h) + (atr.length ? resumoAtrasadas(atr, adm && !A.tec) : '')}
    </div>`;
  }
  function grade(dds, rows, semana, multi, pode, h) {
    const porCel = new Map();
    for (const x of semana) { const k = (multi ? lc(x.tecnico) : '') + '|' + x.data; if (!porCel.has(k)) porCel.set(k, []); porCel.get(k).push(x); }
    for (const l of porCel.values()) l.sort(ordItem);
    const cab = dds.map((d, i) => `<div class="agd-hd ${d === h ? 'hoje' : ''} ${i > 4 ? 'fds' : ''}"><span>${SEM[i]}</span><b>${dt(d).getDate()}</b></div>`).join('');
    const cel = (d, i, tec) => {
      const l = porCel.get((multi ? tec : '') + '|' + d) || [];
      return `<div class="agd-cel ${d === h ? 'hoje' : ''} ${i > 4 ? 'fds' : ''} ${d < h ? 'passado' : ''}" data-dia="${d}" ${multi ? `data-tec="${esc(tec)}"` : ''}>${l.map(x => card(x, false)).join('')}${pode ? `<button class="agd-add" data-agd="novo" data-dia="${d}" ${multi ? `data-tec="${esc(tec)}"` : ''} aria-label="Agendar em ${SEM_L[i]} ${dm(d)}${multi ? ' para ' + esc(nome(tec)) : ''}">${svg(IC.mais)}</button>` : ''}</div>`;
    };
    if (!multi) {
      const vazio = !semana.length;
      return `<div class="agd-grid um">${cab}${dds.map((d, i) => cel(d, i, '')).join('')}</div>${vazio ? `<p class="agd-vazio">Nenhuma visita nesta semana.${pode ? ' Passe o mouse num dia e clique em <b>+</b> para agendar.' : ''}</p>` : ''}`;
    }
    const linhas = rows.map(tec => {
      const l = semana.filter(x => lc(x.tecnico) === tec && x.status !== 'Cancelada'), f = l.filter(x => situacao(x).k === 'feita').length, a = l.filter(x => situacao(x).k === 'atrasada').length;
      return `<div class="agd-pes"><span class="avatar sm">${esc(iniciais(tec))}</span><span><b>${esc(nome(tec))}${tec === eu() ? ' <small>(eu)</small>' : ''}</b><small>${l.length ? `${f} de ${l.length} feitas${a ? ` · <em>${a} atrasada${a > 1 ? 's' : ''}</em>` : ''}` : 'nada agendado'}</small></span></div>${dds.map((d, i) => cel(d, i, tec)).join('')}`;
    }).join('');
    return `<div class="agd-scroll"><div class="agd-grid multi"><div class="agd-hd agd-corner">Técnico</div>${cab}${linhas}</div></div>`;
  }
  function linhaAtr(x, adm, pode) {
    const s = situacao(x), tt = talsTxt(x);
    return `<tr><td class="num">${esc(SEM[dSem(x.data)] + ' ' + dm(x.data))}${x.hora ? `<small>${esc(x.hora)}</small>` : ''}</td>
      ${adm ? `<td><span class="agd-tecc"><span class="avatar xs">${esc(iniciais(x.tecnico))}</span>${esc(nome(x.tecnico))}</span></td>` : ''}
      <td><button class="lnk" data-agd-abrir="${esc(x.id)}"><b>${esc(nomeFaz(x))}</b></button><small>${esc([nomeCli(x), tt].filter(Boolean).join(' · '))}</small></td>
      <td>${esc(x.objetivo || '')}</td><td><span class="pill bad">${esc(s.txt.replace('Atrasada ', ''))}</span></td>
      <td class="agd-acts">${pode ? `<div><label class="agd-reag" title="Escolher a nova data">${svg(IC.agenda)}<span>Reagendar</span><input type="date" data-agd-reag="${esc(x.id)}" min="${hoje()}" aria-label="Nova data para ${esc(nomeFaz(x))}"></label><button class="btn small" data-agd="feita" data-id="${esc(x.id)}">${svg(IC.ok)} Feita</button><button class="btn small ghost" data-agd="cancelar" data-id="${esc(x.id)}">Cancelar</button></div>` : ''}</td></tr>`;
  }
  function tabelaAtr(l, adm, pode) {
    return `<div class="table-wrap"><table class="agd-tab"><colgroup><col class="c-data">${adm ? '<col class="c-tec">' : ''}<col><col class="c-obj"><col class="c-atr"><col class="c-acts"></colgroup><thead><tr><th>Data</th>${adm ? '<th>Técnico</th>' : ''}<th>Fazenda</th><th>Objetivo</th><th>Atraso</th><th></th></tr></thead><tbody>${l.map(x => linhaAtr(x, adm, pode)).join('')}</tbody></table></div>`;
  }
  function resumoAtrasadas(atr, adm) {
    const l = atr.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
    return `<section class="card-box agd-atr"><h3><span><i class="agd-dot bad"></i>Visitas atrasadas</span><small>${plural(atr.length, 'visita passou', 'visitas passaram')} da data sem registro de visita${atr.length > 5 ? ` · <button class="lnk" data-agd="modo" data-m="atrasadas">ver todas</button>` : ''}</small></h3>${tabelaAtr(l, adm, podeEditar())}</section>`;
  }
  function listaAtrasadas(atr, adm, pode) {
    if (!atr.length) return `<section class="card-box agd-ok"><span class="agd-okic">${svg(IC.ok)}</span><div><b>Nenhuma visita atrasada</b><p class="muted">Tudo o que estava agendado até hoje foi visitado, reagendado ou cancelado.</p></div></section>`;
    if (!adm || A.tec) return `<section class="card-box agd-atr">${tabelaAtr(atr, adm, pode)}</section>`;
    const por = new Map(); for (const x of atr) { const k = lc(x.tecnico); if (!por.has(k)) por.set(k, []); por.get(k).push(x); }
    return [...por].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `<section class="card-box agd-atr"><h3><span class="agd-tecc"><span class="avatar xs">${esc(iniciais(k))}</span>${esc(nome(k))}</span><small>${plural(l.length, 'atrasada', 'atrasadas')}</small></h3>${tabelaAtr(l, false, pode)}</section>`).join('');
  }

  async function clique(e) {
    const ab = e.target.closest('[data-agd-abrir]'); if (ab) { const x = I().get('agenda', ab.dataset.agdAbrir); if (x) formulario(x); return; }
    const b = e.target.closest('[data-agd]'); if (!b || b.tagName === 'SELECT') return;
    const a = b.dataset.agd;
    if (a === 'ant' || a === 'prox') { A.semana = somar(A.semana, a === 'ant' ? -7 : 7); render(); return; }
    if (a === 'hoje') { A.semana = segunda(hoje()); render(); return; }
    if (a === 'modo') { A.modo = b.dataset.m; salvarPref(); render(); return; }
    if (a === 'novo') { formulario(null, { data: b.dataset.dia || (A.semana === segunda(hoje()) ? hoje() : A.semana), tecnico: b.dataset.tec || A.tec || eu() }); return; }
    if (a === 'feita' || a === 'cancelar') { const x = I().get('agenda', b.dataset.id); if (x) await marcar(x, a === 'feita' ? 'Feita' : 'Cancelada').catch(() => { }); return; }
    if (a === 'xls') { excel(); return; }
    if (a === 'whats') { whats(); return; }
  }
  function mudou(e) {
    const t = e.target;
    if (t.matches('[data-agd="tec"]')) { A.tec = t.value; salvarPref(); render(); return; }
    if (t.matches('[data-agd-reag]') && t.value) { const x = I().get('agenda', t.dataset.agdReag); if (x) reagendar(x, t.value).catch(() => { }); }
  }

  // ---------- Excel e WhatsApp ----------
  function linhasExport() {
    const adm = souAdmin(), seg = A.semana, fim = somar(seg, 6);
    const base = visiveis().filter(x => !A.tec || lc(x.tecnico) === A.tec);
    return (A.modo === 'atrasadas' ? atrasadas(base) : base.filter(x => x.data >= seg && x.data <= fim)).sort(ordItem);
  }
  async function excel() {
    const l = linhasExport();
    if (!l.length) { I().toast('Não há visitas para exportar.'); return; }
    try {
      await I().loadLib('xlsx'); const X = window.XLSX, wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(l.map(x => { const s = situacao(x); return { Data: dt(x.data), Dia: SEM[dSem(x.data)], Hora: x.hora || '', Técnico: nome(x.tecnico), Cliente: nomeCli(x), Fazenda: nomeFaz(x), Talhões: (x.talhao_ids || []).map(tal).filter(Boolean).map(t => t.nome).join(', '), Objetivo: x.objetivo || '', Situação: s.txt, 'Visita registrada em': s.vs && s.vs.length ? dt(s.vs[0].d) : '', Observações: x.obs || '' }; }), { cellDates: true }), 'Agenda');
      X.writeFile(wb, 'inovaagro-agenda-' + (A.modo === 'atrasadas' ? 'atrasadas-' + hoje() : A.semana) + '.xlsx');
      I().toast('Planilha gerada.');
    } catch (err) { I().toast('Não foi possível gerar a planilha. Verifique a internet.'); }
  }
  function textoWhats(l, titulo) {
    const por = new Map(); for (const x of l) { if (!por.has(x.data)) por.set(x.data, []); por.get(x.data).push(x); }
    let t = `*${titulo}*\n`;
    for (const [d, xs] of por) {
      t += `\n*${SEM_L[dSem(d)].charAt(0).toUpperCase() + SEM_L[dSem(d)].slice(1)} ${dm(d)}*\n`;
      for (const x of xs) { const tt = talsTxt(x); t += `• ${x.hora ? x.hora + ' ' : ''}${nomeFaz(x)}${nomeCli(x) ? ' (' + nomeCli(x) + ')' : ''}${x.objetivo ? ' — ' + x.objetivo : ''}${tt ? ' — talhões ' + tt : ''}${souAdmin() && !A.tec ? ' — ' + primeiro(x.tecnico) : ''}${situacao(x).k === 'feita' ? ' ✅' : situacao(x).k === 'atrasada' ? ' ⚠️ atrasada' : ''}\n`; }
    }
    return t.trim();
  }
  function whats() {
    const l = linhasExport().filter(x => x.status !== 'Cancelada');
    if (!l.length) { I().toast('Não há visitas para enviar.'); return; }
    const quem = A.tec ? ' · ' + nome(A.tec) : !souAdmin() ? ' · ' + nome(eu()) : '';
    const tit = A.modo === 'atrasadas' ? 'Visitas atrasadas' + quem : 'Agenda de ' + rotSemana(A.semana) + quem;
    window.open('https://wa.me/?text=' + encodeURIComponent(textoWhats(l, tit)), '_blank', 'noopener');
  }

  // ======================================================================
  // Formulário (site e celular)
  // ======================================================================
  function formulario(x, def) {
    const novo = !x, adm = souAdmin(), pode = podeEditar();
    const d = Object.assign({ data: hoje(), tecnico: eu(), objetivo: OBJETIVOS[0], talhao_ids: [] }, def || {}, x ? JSON.parse(JSON.stringify(x)) : {});
    d.tecnico = lc(d.tecnico) || eu();
    if (!d.produtor_id && d.fazenda_id) d.produtor_id = (faz(d.fazenda_id) || {}).produtor_id || '';
    let tals = new Set((d.talhao_ids || []).map(String));
    const s = x ? situacao(x) : null;
    const pessoas = equipe(); if (!pessoas.includes(d.tecnico)) pessoas.push(d.tecnico);
    const bg = document.createElement('div'); bg.className = 'modal-bg agd-mbg';
    const prods = S().data.produtores.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
    const stBox = s ? `<div class="agd-stbox st-${s.k}"><span class="pill ${s.cls}">${esc(s.k === 'feita' ? 'Feita' : s.k === 'atrasada' ? 'Atrasada' : s.k === 'hoje' ? 'Hoje' : s.k === 'cancelada' ? 'Cancelada' : 'Agendada')}</span><span>${
      s.k === 'feita' ? (s.vs && s.vs.length ? `Visita registrada em <b>${dm(s.vs[0].d)}</b>${s.vs[0].quem && s.vs[0].quem !== lc(d.tecnico) ? ' por ' + esc(nome(s.vs[0].quem)) : ''}${s.atraso ? ` · ${plural(s.atraso, 'dia', 'dias')} depois do combinado` : ''}${s.parcial ? ' · ' + s.parcial : ''}` : 'Marcada como feita à mão.')
      : s.k === 'atrasada' ? `Passou ${plural(s.n, 'dia', 'dias')} da data e ainda não há visita registrada nesta fazenda.` : s.k === 'cancelada' ? 'Esta visita foi cancelada.' : s.k === 'hoje' ? 'Marcada para hoje.' : `Faltam ${plural(entre(hoje(), d.data), 'dia', 'dias')}.`
      }${x.reagendada_de ? ` <small class="muted">Reagendada (era ${dm(x.reagendada_de)}).</small>` : ''}</span>${s.vs && s.vs.length ? `<button type="button" class="btn small" data-agf="ver" data-id="${esc(s.vs[0].m.id)}">Abrir visita</button>` : ''}</div>` : '';
    bg.innerHTML = `<div class="modal agd-modal" role="dialog" aria-modal="true" aria-labelledby="agd-mt"><header><h2 id="agd-mt">${novo ? 'Agendar visita' : 'Visita agendada'}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
      ${stBox}
      <form novalidate ${pode ? '' : 'inert'}>
        <label class="field"><span>Técnico</span><select name="tecnico" ${adm ? '' : 'disabled'}>${pessoas.map(p => opt(p, nome(p) + (p === eu() ? ' (eu)' : ''), d.tecnico)).join('')}</select></label>
        <div class="agd-dh"><label class="field"><span>Data</span><input type="date" name="data" value="${esc(d.data)}" required></label><label class="field"><span>Hora <small class="muted">(opcional)</small></span><input type="time" name="hora" value="${esc(d.hora || '')}"></label></div>
        <label class="field"><span>Cliente</span><select name="produtor_id"><option value="">Todos os clientes</option>${prods.map(p => opt(p.id, p.nome, d.produtor_id)).join('')}</select></label>
        <label class="field"><span>Fazenda</span><select name="fazenda_id" required></select></label>
        <div class="field full"><span>Talhões <small class="muted" id="agd-tc"></small></span><div class="agd-tals" id="agd-tals"></div></div>
        <label class="field"><span>Objetivo</span><select name="objetivo">${OBJETIVOS.concat(d.objetivo && !OBJETIVOS.includes(d.objetivo) ? [d.objetivo] : []).map(o => opt(o, o, d.objetivo)).join('')}</select></label>
        ${novo ? `<div class="agd-dh"><label class="field"><span>Repetir</span><select name="repetir">${REPETIR.map(([v, l]) => opt(v, l, '')).join('')}</select></label><label class="field" id="agd-vz" hidden><span>Quantas vezes</span><input type="number" name="vezes" min="2" max="26" step="1" value="4" inputmode="numeric"></label></div>` : '<span></span>'}
        <label class="field full"><span>O que fazer / observações</span><textarea name="obs" rows="2" placeholder="Ex.: conferir broca nos talhões de 2º corte; levar armadilhas">${esc(d.obs || '')}</textarea></label>
      </form>
      <footer>${!novo && pode ? '<button class="btn danger" data-agf="del">Excluir</button>' : ''}<div class="right">
        ${!novo && pode && s.k !== 'feita' && s.k !== 'cancelada' ? '<button class="btn" data-agf="cancelar">Cancelar visita</button><button class="btn" data-agf="feita">Marcar como feita</button>' : ''}
        ${!novo && pode && (s.k === 'cancelada' || (s.k === 'feita' && s.manual)) ? '<button class="btn" data-agf="reabrir">Reabrir</button>' : ''}
        <button class="btn" data-close>${novo ? 'Cancelar' : 'Fechar'}</button>${pode ? `<button class="btn primary" data-agf="salvar">${novo ? 'Agendar' : 'Salvar'}</button>` : ''}</div></footer></div>`;
    document.body.appendChild(bg);
    const f = $('form', bg), selProd = f.elements.produtor_id, selFaz = f.elements.fazenda_id;
    function listaFaz() {
      const pid = selProd.value;
      const l = S().data.fazendas.filter(z => !pid || String(z.produtor_id) === pid).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
      selFaz.innerHTML = `<option value="">Escolha a fazenda…</option>` + l.map(z => opt(z.id, z.nome + (pid ? '' : ' · ' + ((prod(z.produtor_id) || {}).nome || '')), d.fazenda_id)).join('');
      if (d.fazenda_id && !l.some(z => String(z.id) === String(d.fazenda_id))) { d.fazenda_id = ''; tals.clear(); }
      listaTal();
    }
    function listaTal() {
      const box = $('#agd-tals', bg), ts = (S().talPorFaz.get(String(selFaz.value)) || []).slice().sort(ordTal);
      if (!selFaz.value) { box.innerHTML = '<p class="muted">Escolha a fazenda para ver os talhões.</p>'; $('#agd-tc', bg).textContent = ''; return; }
      box.innerHTML = `<label class="agd-tchip todos"><input type="checkbox" data-agf="todos" ${tals.size ? '' : 'checked'}><span>Fazenda toda</span></label>` + ts.map(t => `<label class="agd-tchip"><input type="checkbox" value="${esc(t.id)}" ${tals.has(String(t.id)) ? 'checked' : ''}><span>${esc(t.nome)}</span></label>`).join('');
      $('#agd-tc', bg).textContent = tals.size ? `(${tals.size} escolhido${tals.size > 1 ? 's' : ''})` : '(opcional: escolha só se for olhar talhões específicos)';
    }
    selProd.addEventListener('change', () => { d.produtor_id = selProd.value; listaFaz(); });
    selFaz.addEventListener('change', () => { d.fazenda_id = selFaz.value; tals.clear(); if (!selProd.value && d.fazenda_id) { selProd.value = (faz(d.fazenda_id) || {}).produtor_id || ''; listaFaz(); } else listaTal(); });
    $('#agd-tals', bg).addEventListener('change', e => {
      const c = e.target; if (c.type !== 'checkbox') return;
      if (c.dataset.agf === 'todos') { if (c.checked) tals.clear(); else c.checked = !tals.size; }
      else if (c.checked) tals.add(c.value); else tals.delete(c.value);
      listaTal();
    });
    if (novo) f.elements.repetir.addEventListener('change', e => { $('#agd-vz', bg).hidden = !e.target.value; });
    listaFaz();
    const fechar = () => { bg.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = e => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc_);
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) { fechar(); return; }
      const b = e.target.closest('[data-agf]'); if (!b || b.tagName === 'INPUT') return;
      e.preventDefault();
      const a = b.dataset.agf;
      if (a === 'ver') { fechar(); abrirVisita(b.dataset.id); return; }
      if (a === 'feita' || a === 'cancelar' || a === 'reabrir') { fechar(); await marcar(x, a === 'feita' ? 'Feita' : a === 'cancelar' ? 'Cancelada' : 'Agendada').catch(() => { }); return; }
      if (a === 'del') {
        if (!confirmar(b, 'Excluir de vez?')) return;
        fechar(); await I().Store.remove('agenda', x.id).then(() => I().toast('Visita excluída da agenda.')).catch(() => { }); return;
      }
      if (a === 'salvar') {
        const v = { data: f.elements.data.value, hora: f.elements.hora.value, tecnico: adm ? f.elements.tecnico.value : (novo ? eu() : d.tecnico), fazenda_id: selFaz.value, objetivo: f.elements.objetivo.value, obs: f.elements.obs.value.trim() };
        if (!v.fazenda_id) { selFaz.focus(); I().toast('Escolha a fazenda.'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) { f.elements.data.focus(); I().toast('Escolha a data.'); return; }
        const o = Object.assign({}, x || {}, v, { produtor_id: (faz(v.fazenda_id) || {}).produtor_id || '', talhao_ids: [...tals] });
        if (!o.hora) delete o.hora; if (!o.obs) delete o.obs;
        if (novo) {
          o.status = 'Agendada';
          const rep = f.elements.repetir.value, n = rep ? Math.max(2, Math.min(26, Math.round(Number(f.elements.vezes.value) || 2))) : 1;
          const serie = n > 1 ? I().newId() : null;
          b.disabled = true;
          try {
            for (let i = 0; i < n; i++) {
              const di = i === 0 ? o.data : rep === 'm' ? somarMes(o.data, i) : somar(o.data, i * Number(rep));
              await salvar(Object.assign({}, o, { id: I().newId(), data: di }, serie ? { serie } : {}));
            }
            I().toast(n > 1 ? `${n} visitas agendadas.` : 'Visita agendada.');
            A.semana = segunda(o.data); M.dia = o.data;
            fechar(); if (root && !root.hidden) render();
          } catch (err) { b.disabled = false; }
          return;
        }
        if (o.data !== x.data && !o.reagendada_de && x.data < hoje()) o.reagendada_de = x.data;
        try { await salvar(o); I().toast('Alterações salvas.'); fechar(); } catch (err) { }
      }
    });
    setTimeout(() => { (novo && !d.fazenda_id ? (selProd.value ? selFaz : selProd) : $('[data-close]', bg)).focus(); }, 30);
  }
  // botão de dois toques para ações sem volta (sem janelas do navegador)
  function confirmar(b, txt) {
    if (b.dataset.conf) return true;
    b.dataset.conf = 1; const t0 = b.textContent; b.textContent = txt; b.classList.add('agd-conf');
    setTimeout(() => { if (b.isConnected) { delete b.dataset.conf; b.textContent = t0; b.classList.remove('agd-conf'); } }, 3500);
    return false;
  }
  function abrirVisita(id) {
    const m = I().get('monitoramentos', id); if (!m) return;
    if (location.hash === '#campo' && window.Campo && window.Campo.abrirVisita) window.Campo.abrirVisita(m, false);
    else I().openForm('monitoramentos', m);
  }

  // ======================================================================
  // Tela do celular (modo campo)
  // ======================================================================
  let cel = null;
  const C = () => window.Campo && window.Campo.ui;
  function celular(foco) {
    const c = C(); if (!c) { location.hash = 'agenda'; return; }
    if (M.tec == null) M.tec = eu();
    if (!souAdmin()) M.tec = eu();
    if (foco === 'hoje') M.dia = hoje();
    if (cel && cel.isConnected) { renderCel(); return; }
    c.fecharMenu(); c.fecharSheet();
    cel = c.tela(`<header class="cp-bar"><button class="cp-ib" data-cp="voltar" aria-label="Voltar">${c.ic('voltar')}</button><h1>Agenda</h1>${podeEditar() ? `<button class="cp-ib" data-agm="novo" aria-label="Agendar visita">${c.ic('mais')}</button>` : '<span></span>'}</header><div class="agm" id="agm"></div>`, { cls: 'agm-tela', aoFechar: () => { cel = null; } });
    cel.addEventListener('click', cliqueCel);
    renderCel();
    carregarEquipe();
  }
  function cardCel(x, mostraTec) {
    const s = situacao(x), c = C(), tt = talsTxt(x), pend = s.k === 'hoje' || s.k === 'atrasada' || s.k === 'agendada';
    return `<article class="agm-card st-${s.k}">
      <div class="agm-h">${x.hora ? `<time>${esc(x.hora)}</time>` : ''}<span class="agm-st ${s.cls}">${esc(s.k === 'feita' ? (s.atraso ? 'Feita ' + dm(s.d) : 'Feita') : s.txt)}</span>${mostraTec ? `<span class="agm-tec">${esc(primeiro(x.tecnico))}</span>` : ''}</div>
      <b>${esc(nomeFaz(x))}</b>
      <small>${esc([nomeCli(x), tt ? 'Talhões ' + tt : 'Fazenda toda'].filter(Boolean).join(' · '))}</small>
      <span class="agm-obj">${esc(x.objetivo || 'Visita')}</span>
      ${x.obs ? `<p class="agm-obs">${esc(x.obs)}</p>` : ''}
      <div class="agm-b">${pend && podeEditar() && lc(x.tecnico) === eu() ? `<button class="cp-btn pri" data-agm="iniciar" data-id="${esc(x.id)}">${c.ic('lupa')}Iniciar visita</button>` : s.vs && s.vs.length ? `<button class="cp-btn" data-agm="ver" data-id="${esc(s.vs[0].m.id)}">${c.ic('lupa')}Abrir visita</button>` : '<span></span>'}
        <button class="cp-btn" data-agm="ir" data-id="${esc(x.id)}">${c.ic('navegar')}Navegar</button>
        ${podeEditar() ? `<button class="cp-ib agm-mais" data-agm="mais" data-id="${esc(x.id)}" aria-label="Mais opções">${c.ic('editar')}</button>` : ''}</div>
    </article>`;
  }
  function renderCel() {
    const box = cel && $('#agm', cel); if (!box) return;
    const c = C(), h = hoje(), adm = souAdmin();
    if (!adm) M.tec = eu();
    const todos = adm && M.tec === '*';
    const base = visiveis().filter(x => todos || lc(x.tecnico) === M.tec);
    const atr = atrasadas(base);
    const seg = segunda(M.dia), dds = [0, 1, 2, 3, 4, 5, 6].map(i => somar(seg, i));
    const porDia = new Map(); for (const x of base) if (x.data >= seg && x.data <= dds[6] && x.status !== 'Cancelada') porDia.set(x.data, (porDia.get(x.data) || 0) + 1);
    const doDia = base.filter(x => x.data === M.dia).sort(ordItem);
    const pessoas = adm ? equipe() : [];
    box.innerHTML = `${adm && pessoas.length > 1 ? `<div class="cp-chips agm-chips"><button class="cp-chip" data-agm="tec" data-t="${esc(eu())}" aria-pressed="${M.tec === eu()}">Minha agenda</button><button class="cp-chip" data-agm="tec" data-t="*" aria-pressed="${todos}">Equipe toda</button>${pessoas.filter(p => p !== eu()).map(p => `<button class="cp-chip" data-agm="tec" data-t="${esc(p)}" aria-pressed="${M.tec === p}">${esc(primeiro(p))}</button>`).join('')}</div>` : ''}
      ${S().faltaAgenda ? '<p class="cp-aviso agm-aviso">A agenda ainda não está ativada no servidor. O que você agendar fica guardado neste celular até o administrador rodar o arquivo supabase/06_agenda.sql.</p>' : ''}
      ${atr.length ? `<section class="agm-atr"><h2><i></i>${plural(atr.length, 'visita atrasada', 'visitas atrasadas')}</h2><ul>${atr.slice(0, 6).map(x => `<li><button data-agm="dia" data-d="${x.data}"><span><b>${esc(nomeFaz(x))}</b><small>${esc(SEM[dSem(x.data)] + ' ' + dm(x.data))}${todos ? ' · ' + esc(primeiro(x.tecnico)) : ''}${x.objetivo ? ' · ' + esc(x.objetivo) : ''}</small></span><em>${situacao(x).n} d</em></button></li>`).join('')}</ul>${atr.length > 6 ? `<p>e mais ${atr.length - 6}</p>` : ''}</section>` : ''}
      <div class="agm-sem">
        <div class="agm-semh"><button class="cp-ib" data-agm="sem" data-n="-7" aria-label="Semana anterior">${svg(IC.esq, 'ic')}</button><b>${esc(rotSemana(seg))}</b><button class="cp-ib" data-agm="sem" data-n="7" aria-label="Próxima semana">${svg(IC.dir, 'ic')}</button></div>
        <div class="agm-dias" role="tablist">${dds.map((d, i) => { const n = porDia.get(d) || 0, at = base.some(x => x.data === d && situacao(x).k === 'atrasada'); return `<button role="tab" data-agm="dia" data-d="${d}" aria-selected="${d === M.dia}" class="${d === h ? 'hoje' : ''}"><span>${SEM[i]}</span><b>${dt(d).getDate()}</b><i class="${n ? at ? 'atr' : 'tem' : ''}">${n > 1 ? n : ''}</i></button>`; }).join('')}</div>
      </div>
      <div class="agm-dia"><h2>${esc(diaLongo(M.dia))}</h2><span>${doDia.length ? plural(doDia.filter(x => x.status !== 'Cancelada').length, 'visita', 'visitas') : ''}</span></div>
      <div class="agm-lista">${doDia.map(x => cardCel(x, todos)).join('') || `<div class="agm-vazio">${svg(IC.agenda, 'ic')}<p>Nada agendado para este dia.</p>${podeEditar() ? `<button class="cp-btn" data-agm="novo">${c.ic('mais')}Agendar visita</button>` : ''}</div>`}</div>
      ${M.dia === h && minhas().some(x => x.data <= h && ['hoje', 'atrasada'].includes(situacao(x).k)) ? `<button class="cp-btn agm-rota" data-agm="rota">${c.ic('rota')}Montar a rota de hoje</button>` : ''}`;
    const sel = $('.agm-dias [aria-selected="true"]', box); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function cliqueCel(e) {
    const b = e.target.closest('[data-agm]'); if (!b) return;
    const c = C(), a = b.dataset.agm, x = b.dataset.id ? I().get('agenda', b.dataset.id) : null;
    if (a === 'tec') { M.tec = b.dataset.t; renderCel(); return; }
    if (a === 'dia') { M.dia = b.dataset.d; renderCel(); cel.scrollTop = 0; return; }
    if (a === 'sem') { M.dia = somar(M.dia, Number(b.dataset.n)); renderCel(); return; }
    if (a === 'novo') { formulario(null, { data: M.dia < hoje() ? hoje() : M.dia, tecnico: M.tec && M.tec !== '*' ? M.tec : eu() }); return; }
    if (a === 'rota') { c.rota(); return; }
    if (a === 'ver') { abrirVisita(b.dataset.id); return; }
    if (!x) return;
    if (a === 'iniciar') { iniciar(x); return; }
    if (a === 'ir') { const t = (x.talhao_ids || []).map(tal).find(t => t && t.geometry) || representante(x.fazenda_id); if (t) c.navegar(t); else I().toast('Esta fazenda não tem contorno no mapa.'); return; }
    if (a === 'mais') { opcoesCel(x); return; }
  }
  function iniciar(x) {
    const c = C();
    let ts = (x.talhao_ids || []).map(tal).filter(Boolean);
    if (ts.length === 1) { c.novaVisita(ts[0], { agenda_id: x.id }); return; }
    if (!ts.length) ts = (S().talPorFaz.get(String(x.fazenda_id)) || []).slice();
    ts.sort(ordTal);
    if (!ts.length) { I().toast('Esta fazenda não tem talhões cadastrados.'); return; }
    const vs = new Set((situacao(x).vs || []).map(v => v.tal));
    const sh = c.sheet(`<header class="cp-sh-h"><h2>Em qual talhão?</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${c.ic('fechar')}</button></header>
      <p class="cp-mut agm-shp">${esc(nomeFaz(x))} · a visita fica ligada a esta agenda.</p>
      <ul class="cp-plist">${ts.map(t => `<li><button data-agm-t="${esc(t.id)}"><b>${/^\d/.test(t.nome) ? 'Talhão ' : ''}${esc(t.nome)}${vs.has(String(t.id)) ? ' <small class="agm-ja">já visitado</small>' : ''}</b><small>${I().fmtHa(t.area_ha)} ha</small></button></li>`).join('')}</ul>`, ts.length > 6 ? 'alto agm-sh' : 'agm-sh');
    sh.onclick = ev => { const tb = ev.target.closest('[data-agm-t]'); if (!tb) return; sh.onclick = null; const t = tal(tb.dataset.agmT); if (t) c.novaVisita(t, { agenda_id: x.id }); };
  }
  function opcoesCel(x) {
    const c = C(), s = situacao(x), am = somar(hoje(), 1), pend = s.k !== 'feita' && s.k !== 'cancelada';
    const sh = c.sheet(`<header class="cp-sh-h"><h2>${esc(nomeFaz(x))}</h2><button class="cp-ib" data-cp="fechar-sheet" aria-label="Fechar">${c.ic('fechar')}</button></header>
      <p class="cp-mut agm-shp">${esc(diaLongo(x.data))}${x.hora ? ' · ' + esc(x.hora) : ''} · ${esc(s.txt)}</p>
      <div class="agm-ops">
        ${pend && x.data !== am ? `<button class="cp-btn" data-ago="amanha">${c.ic('sync')}Passar para amanhã</button>` : ''}
        ${pend ? `<button class="cp-btn" data-ago="feita">${svg(IC.ok, 'ic')}Marcar como feita</button>` : ''}
        <button class="cp-btn" data-ago="editar">${c.ic('editar')}Editar ou mudar a data</button>
        ${pend ? `<button class="cp-btn" data-ago="cancelar">${c.ic('fechar')}Cancelar visita</button>` : `<button class="cp-btn" data-ago="reabrir">${c.ic('sync')}Reabrir</button>`}
        <button class="cp-btn cp-btn-del" data-ago="del">${c.ic('lixo')}Excluir da agenda</button>
      </div>`);
    sh.onclick = async ev => {
      const b = ev.target.closest('[data-ago]'); if (!b) return;
      const a = b.dataset.ago;
      if (a === 'del' && !confirmar(b, 'Toque de novo para excluir')) return;
      sh.onclick = null; c.fecharSheet();
      try {
        if (a === 'amanha') { await reagendar(x, am); M.dia = am; }
        else if (a === 'feita') await marcar(x, 'Feita');
        else if (a === 'cancelar') await marcar(x, 'Cancelada');
        else if (a === 'reabrir') await marcar(x, 'Agendada');
        else if (a === 'editar') formulario(x);
        else if (a === 'del') { await I().Store.remove('agenda', x.id); I().toast('Visita excluída da agenda.'); }
      } catch (err) { }
      renderCel();
    };
  }

  // ---------- Abrir pelas notificações ----------
  function abrir(id) {
    if (location.hash === '#campo' && C()) { if (id && id !== 'hoje' && id !== 'atrasadas') { const x = I().get('agenda', id); if (x) M.dia = x.data; } else M.dia = hoje(); celular(); return; }
    if (id === 'atrasadas') A.modo = 'atrasadas';
    else if (id === 'hoje') { A.modo = 'semana'; A.semana = segunda(hoje()); }
    const x = id && I().get('agenda', id);
    if (x) { A.modo = 'semana'; A.semana = segunda(x.data); }
    salvarPref();
    if (location.hash !== '#agenda') location.hash = 'agenda'; else render();
    if (x) setTimeout(() => formulario(x), 60);
  }

  if (window.INOVA) {
    I().VIEWS.agenda = view;
    document.addEventListener('inova:dados', () => {
      if (root && !root.hidden && root.isConnected && !document.querySelector('.agd-mbg')) render();
      if (cel && cel.isConnected) renderCel();
    });
  }
  return { view, avisos, contar, contarMeu, paraRota, celular, abrir, situacao, IC };
})();
