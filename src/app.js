/* INOVAAGRO — gestão agrícola. Dados base importados do SIMA + alterações salvas (Supabase, nuvem do Claude ou navegador).
   Telas: Painel, Mapa, cadastros, Monitoramentos, Ordens, Relatórios (PDF/Excel) e Equipe (usuários e permissões). */
(function () {
  'use strict';

  // ---------- Configuração dos cadastros ----------
  const CULTURAS = ['Soja', 'Milho', 'Milho safrinha', 'Sorgo', 'Feijão', 'Algodão', 'Cana-de-açúcar', 'Café', 'Trigo', 'Pastagem', 'Pousio', 'Outra'];
  const STATUS = ['Planejada', 'Em andamento', 'Concluída', 'Cancelada'];
  const STATUS_CLS = { 'Planejada': 'info', 'Em andamento': 'warn', 'Concluída': 'ok', 'Cancelada': '' };
  const NIVEL_CLS = { 'Baixo': 'ok', 'Médio': 'warn', 'Alto': 'bad' };
  const KINDS = ['produtores', 'fazendas', 'talhoes', 'safras', 'monitoramentos', 'ordens'];
  const NOME = { produtores: 'produtor', fazendas: 'fazenda', talhoes: 'talhão', safras: 'plantio', monitoramentos: 'monitoramento', ordens: 'ordem de trabalho' };
  const PAPEIS = {
    admin: { l: 'Administrador', d: 'Vê e edita tudo, cadastra e remove pessoas da equipe.' },
    editor: { l: 'Técnico', d: 'Vê tudo e pode cadastrar e editar fazendas, talhões, safras, monitoramentos e ordens.' },
    leitura: { l: 'Consulta', d: 'Só visualiza: mapa, painel, cadastros e relatórios. Não altera nada.' },
  };

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
      { k: 'produtividade', l: 'Produtividade (sc/ha ou t/ha)', t: 'number' },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    monitoramentos: [
      { k: 'data', l: 'Data', t: 'date', req: 1 },
      { k: 'responsavel', l: 'Responsável' },
      { k: 'talhao_id', l: 'Talhão', t: 'talhao', req: 1, full: 1 },
      { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Praga', 'Doença', 'Planta daninha', 'Estádio fenológico', 'Falha de estande', 'Outro'], req: 1 },
      { k: 'alvo', l: 'Praga / doença / alvo', ph: 'Ex.: cigarrinha-das-raízes' },
      { k: 'nivel', l: 'Nível', t: 'select', opts: ['Baixo', 'Médio', 'Alto'] },
      { k: 'estadio', l: 'Estádio da cultura', ph: 'Ex.: Perfilhamento' },
      { k: 'estado_talhao', l: 'Condição do talhão', t: 'select', opts: ['Excelente', 'Muito bom', 'Bom', 'Regular', 'Ruim'] },
      { k: 'obs', l: 'Observações', t: 'textarea', full: 1 },
    ],
    ordens: [
      { k: 'titulo', l: 'Título', req: 1, full: 1, ph: 'Ex.: Pulverização herbicida' },
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
    colorBy: 'produtor', base_map: 'sat',
    papel: 'admin', equipePendente: false,
  };

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtHa = n => n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtHa0 = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const fmtInt = n => Number(n || 0).toLocaleString('pt-BR');
  const fmtDate = d => d ? d.slice(0, 10).split('-').reverse().join('/') : '—';
  const today = () => new Date().toISOString().slice(0, 10);
  const diasDesde = d => d ? Math.floor((Date.now() - new Date(d.slice(0, 10) + 'T12:00:00').getTime()) / 864e5) : 1e9;
  const key = id => String(id);
  const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const podeEditar = () => S.papel !== 'leitura';
  const num = v => Number(v) || 0;

  // Cores: categorias em ordem fixa (validadas para daltonismo); situação usa cores de status reservadas.
  const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const OUTROS = '#9a9a8a';
  const CULT_COLOR = { 'Soja': '#1baf7a', 'Milho': '#eda100', 'Milho safrinha': '#eb6834', 'Sorgo': '#e34948', 'Feijão': '#6250d6', 'Algodão': '#e87ba4', 'Cana-de-açúcar': '#b1d243', 'Café': '#8a5a2b', 'Trigo': '#d9c27a', 'Pastagem': '#008300', 'Pousio': OUTROS, 'Outra': '#2a78d6' };
  const SIT = {
    atrasada: { l: 'Ordem atrasada', c: '#d03b3b', cls: 'bad' },
    alerta: { l: 'Alerta no monitoramento', c: '#ec835a', cls: 'warn' },
    programada: { l: 'Ordem programada', c: '#2a78d6', cls: 'info' },
    emdia: { l: 'Em dia', c: '#0ca30c', cls: 'ok' },
    semplantio: { l: 'Sem plantio cadastrado', c: OUTROS, cls: '' },
  };
  const COND = { 'Excelente': '#0ca30c', 'Muito bom': '#6cc04a', 'Bom': '#c7d93a', 'Regular': '#fab219', 'Ruim': '#d03b3b' };

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
    S.ordPorFaz = by(S.data.ordens, 'fazenda_id');
    S.ordPorTal = new Map();
    for (const o of S.data.ordens) for (const id of (o.talhao_ids || [])) { const k = key(id); if (!S.ordPorTal.has(k)) S.ordPorTal.set(k, []); S.ordPorTal.get(k).push(o); }
    for (const t of S.data.talhoes) { const f = get('fazendas', t.fazenda_id); t._prod = f ? f.produtor_id : t.produtor_id; }
    S.data.produtores.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    S.colors = new Map(S.data.produtores.map((p, i) => [key(p.id), i < SERIES.length ? SERIES[i] : OUTROS]));
    // variedades: cor pela ordem de área (maior primeiro)
    const va = new Map();
    for (const t of S.data.talhoes) { const c = culturaAtual(t); if (c && c.variedade) va.set(c.variedade, (va.get(c.variedade) || 0) + num(t.area_ha)); }
    S.varColors = new Map([...va.entries()].sort((a, b) => b[1] - a[1]).map(([v], i) => [v, i < SERIES.length - 1 ? SERIES[i] : OUTROS]));
    updateBadges();
  }
  const get = (k, id) => id == null ? null : S.idx[k]?.get(key(id)) || null;
  const nomeTal = t => t ? (/^\d+$/.test(t.nome) ? 'Talhão ' + t.nome : t.nome) : '—';
  const culturaAtual = (t, safra) => {
    const s = (S.safPorTal.get(key(t.id)) || []).filter(x => !safra || x.safra === safra).sort((a, b) => (b.safra || '').localeCompare(a.safra || '') || (b.data_plantio || '').localeCompare(a.data_plantio || ''));
    return s[0] || null;
  };
  const ultimoMon = t => { let best = null; for (const m of S.monPorTal.get(key(t.id)) || []) if (!best || (m.data || '') > (best.data || '')) best = m; return best; };
  const pendente = o => !o.status || o.status === 'Planejada' || o.status === 'Em andamento';
  const atrasada = o => pendente(o) && o.data_prevista && o.data_prevista < today();
  function situacao(t) {
    const ords = (S.ordPorTal.get(key(t.id)) || []).filter(pendente);
    if (ords.some(atrasada)) return 'atrasada';
    const m = ultimoMon(t);
    if (m && (m.nivel === 'Alto' || m.nivel === 'Médio') && diasDesde(m.data) <= 60) return 'alerta';
    if (ords.length) return 'programada';
    if (!culturaAtual(t)) return 'semplantio';
    return 'emdia';
  }
  const condicao = t => { let best = null; for (const m of S.monPorTal.get(key(t.id)) || []) if (m.estado_talhao && (!best || (m.data || '') > (best.data || ''))) best = m; return best ? best.estado_talhao : null; };
  function grupoTal(t) {
    switch (S.colorBy) {
      case 'cultura': { const c = culturaAtual(t); return c ? [c.cultura, CULT_COLOR[c.cultura] || OUTROS] : ['Sem plantio cadastrado', OUTROS]; }
      case 'variedade': { const c = culturaAtual(t); const v = c && c.variedade; return v ? [S.varColors.get(v) === OUTROS ? 'Outras variedades' : v, S.varColors.get(v) || OUTROS] : ['Sem variedade', OUTROS]; }
      case 'situacao': { const s = SIT[situacao(t)]; return [s.l, s.c]; }
      case 'condicao': { const c = condicao(t); return c ? [c, COND[c] || OUTROS] : ['Sem monitoramento', OUTROS]; }
      default: { const p = get('produtores', t._prod); return [p ? p.nome : 'Sem produtor', S.colors.get(key(t._prod)) || OUTROS]; }
    }
  }
  const corTal = t => grupoTal(t)[1];

  // ---------- Armazenamento ----------
  const LS = 'gleba.alteracoes.v1';
  const Store = {
    mode: 'local', db: null,
    async init() {
      if (SB.on) { this.mode = 'supabase'; setSync(); return; }
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
      if (!podeEditar()) { toast('Seu acesso é só de consulta.'); throw new Error('somente leitura'); }
      S.version = (S.version || 0) + 1;
      obj = Object.assign({}, obj, { atualizado_em: new Date().toISOString() });
      delete obj._prod;
      if (this.mode === 'supabase') {
        // Grava primeiro no aparelho (fila) e depois tenta enviar; sem internet fica na fila.
        await Off.enfileirar(k, obj);
        if (obj._del) S.base[k] = S.base[k].filter(r => key(r.id) !== key(obj.id));
        else { const i = S.base[k].findIndex(r => key(r.id) === key(obj.id)); if (i >= 0) S.base[k][i] = obj; else S.base[k].push(obj); }
        rebuild(); refresh(); sincronizar(true); return;
      }
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
    const el = $('#sync');
    $('span', el).textContent = Store.mode === 'supabase' ? syncTexto() : Store.mode === 'nuvem' ? 'Salvo na nuvem' : 'Salvo neste navegador';
    el.dataset.mode = Store.mode === 'local' ? 'local' : Store.mode === 'supabase' && (!navigator.onLine || Sync.pend) ? 'offline' : 'nuvem';
    el.title = Sync.pend ? Sync.pend + ' alteração(ões) esperando internet para enviar' : '';
    $('#acct').hidden = Store.mode !== 'supabase';
    if (SB.user) { $('#who-email').textContent = SB.user.email; $('#who-papel').textContent = PAPEIS[S.papel]?.l || S.papel; }
  }
  function setPapel(p) { S.papel = PAPEIS[p] ? p : 'editor'; document.body.dataset.papel = S.papel; renderNav(); setSync(); }

  // ---------- Modo offline (celular no campo) ----------
  const Off = window.GlebaOffline;
  const Sync = { pend: 0, rodando: false, offline: false };
  function syncTexto() {
    if (Sync.rodando) return 'Enviando…';
    if (!navigator.onLine || Sync.offline) return Sync.pend ? 'Sem internet · ' + Sync.pend + ' para enviar' : 'Sem internet';
    if (Sync.pend) return Sync.pend + ' para enviar';
    return SB.user ? SB.user.email : 'Online';
  }
  async function sincronizar(avisar) {
    if (Store.mode !== 'supabase' || Sync.rodando) return;
    let fila = await Off.fila(); Sync.pend = fila.length;
    if (!fila.length || !navigator.onLine) { setSync(); if (fila.length && avisar) toast('Salvo no aparelho. Será enviado quando a internet voltar.'); return; }
    Sync.rodando = true; setSync();
    let falhou = false;
    try {
      if (!(await SB.session().catch(() => null))) { falhou = true; if (avisar !== false) toast('Entre de novo no app para enviar as alterações salvas no aparelho.'); return; }
      for (const it of fila) {
        try { if (it.del) await SB.del(it.k, it.id); else await SB.upsert(it.k, [it.obj]); await Off.tirar(it); }
        catch (e) {
          if (Off.erroDeRede(e)) { falhou = true; break; }
          await Off.tirar(it);
          toast(/permission|policy|JWT|RLS/i.test(e.message || '') ? 'Você não tem permissão para alterar estes dados.' : 'Uma alteração não foi aceita pelo servidor: ' + (e.message || e));
        }
      }
      Sync.offline = falhou && !SB.user;
    } finally {
      Sync.rodando = false; Sync.pend = (await Off.fila()).length; setSync();
      if (falhou && avisar) toast('Salvo no aparelho. Será enviado quando a internet voltar.');
    }
  }
  window.addEventListener('online', () => { Sync.offline = false; setSync(); sincronizar(false); });
  window.addEventListener('offline', setSync);
  setInterval(() => { if (Sync.pend) sincronizar(false); }, 60000);
  async function abrirSemInternet() {
    const c = await Off.lerCopia();
    if (!c) return false;
    for (const k of KINDS) { S.base[k] = c.base[k] || []; S.over[k] = {}; }
    Off.aplicar(S.base, await Off.fila());
    SB.user = SB.user || { email: c.email }; Sync.offline = true;
    usarPapelSalvo();
    $('#login').hidden = true;
    return true;
  }
  function usarPapelSalvo() { let p = null; try { p = localStorage.getItem('inovaagro.papel'); } catch (e) { } S.papel = PAPEIS[p] ? p : 'leitura'; document.body.dataset.papel = S.papel; }
  async function sair() {
    const n = (await Off.fila()).length;
    if (n && !confirm(n + ' alteração(ões) ainda não foram enviadas e serão perdidas se você sair agora. Sair mesmo assim?')) return;
    await Off.limpar().catch(() => {});
    try { localStorage.removeItem('inovaagro.papel'); } catch (e) { }
    SB.cli.auth.signOut().finally(() => location.reload());
  }

  // ---------- Supabase (versão hospedada: banco + login) ----------
  const CFG = window.GLEBA_CONFIG || {};
  const SB = {
    on: !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase),
    cli: null, user: null,
    init() { this.cli = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey); },
    async session() { const { data } = await this.cli.auth.getSession(); this.user = data.session ? data.session.user : null; return this.user; },
    async loadAll() {
      for (const k of KINDS) {
        const rows = []; let from = 0;
        for (;;) {
          const { data, error } = await this.cli.from(k).select('id,dados').range(from, from + 999);
          if (error) throw error;
          rows.push(...data.map(r => Object.assign({}, r.dados, { id: r.dados && r.dados.id != null ? r.dados.id : r.id })));
          if (data.length < 1000) break; from += 1000;
        }
        S.base[k] = rows; S.over[k] = {};
      }
      Off.salvarCopia(S.base, this.user && this.user.email).catch(() => {});
      Off.aplicar(S.base, await Off.fila());
    },
    async upsert(k, list) {
      for (let i = 0; i < list.length; i += 200) {
        const chunk = list.slice(i, i + 200).map(o => ({ id: key(o.id), dados: o }));
        const { error } = await this.cli.from(k).upsert(chunk);
        if (error) throw error;
      }
    },
    async del(k, id) { const { error } = await this.cli.from(k).delete().eq('id', key(id)); if (error) throw error; },
    // Equipe
    async meuPapel() { const r = await this.cli.rpc('meu_papel'); if (r.error) throw r.error; return r.data; },
    async membros() { const { data, error } = await this.cli.from('membros').select('email,nome,papel,ativo,criado_em').order('email'); if (error) throw error; return data; },
    async addMembro(m) { const { error } = await this.cli.from('membros').insert(m); if (error) throw error; },
    async updMembro(email, patch) { const { error } = await this.cli.from('membros').update(patch).eq('email', email); if (error) throw error; },
    async delMembro(email) { const { error } = await this.cli.from('membros').delete().eq('email', email); if (error) throw error; },
  };
  function showLogin(msg) {
    const el = $('#login'); el.hidden = false; $('#loading').hidden = true;
    $('#login-msg').textContent = msg || '';
  }
  async function doLogin(e) {
    e.preventDefault();
    const email = $('#lg-email').value.trim(), senha = $('#lg-senha').value;
    const criar = e.submitter && e.submitter.dataset.criar;
    $('#login-msg').textContent = 'Entrando…';
    const r = criar ? await SB.cli.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } })
                    : await SB.cli.auth.signInWithPassword({ email, password: senha });
    if (r.error) { $('#login-msg').textContent = /Invalid login/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : /registered/i.test(r.error.message) ? 'Este e-mail já tem cadastro. Use "Entrar".' : /least/i.test(r.error.message) ? 'A senha precisa ter pelo menos 6 caracteres.' : 'Não foi possível entrar: ' + r.error.message; return; }
    if (criar && !r.data.session) { $('#login-msg').textContent = 'Conta criada. Abra o e-mail de confirmação que enviamos e depois clique em Entrar.'; return; }
    location.reload();
  }
  async function importarArquivo(file) {
    let json; try { json = JSON.parse(await file.text()); } catch (e) { toast('Arquivo inválido: escolha o JSON exportado.'); return; }
    const kinds = KINDS.filter(k => Array.isArray(json[k]));
    if (!kinds.length) { toast('Este arquivo não tem dados do aplicativo.'); return; }
    try {
      let n = 0;
      for (const k of kinds) { toast('Importando ' + k + '…'); await SB.upsert(k, json[k].map(r => { const c = Object.assign({}, r); delete c._prod; return c; })); n += json[k].length; }
      toast(fmtInt(n) + ' registros importados.'); setTimeout(() => location.reload(), 1200);
    } catch (e) { toast('Falhou ao importar: ' + (e.message || e)); }
  }

  // ---------- Carregar dados base ----------
  async function loadBase() {
    if (SB.on) return;
    const pre = window.GLEBA_DATA || {};
    await Promise.all(KINDS.map(async k => {
      if (pre[k]) { S.base[k] = pre[k]; return; }
      try { const r = await fetch('data/' + k + '.json'); if (r.ok) S.base[k] = await r.json(); } catch (e) { }
    }));
  }

  // ---------- Menu e roteamento ----------
  const IC = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    produtores: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    fazendas: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
    talhoes: '<path d="M4 7l7-4 9 5-2 11-10 2-4-6z"/><path d="M11 3l-1 18"/>',
    safras: '<path d="M12 21V11"/><path d="M12 11c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 14c0-3-2-5-7-5 0 4 2 5 7 5z"/>',
    monitoramentos: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    ordens: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    relatorios: '<path d="M6 3h9l4 4v14H6z"/><path d="M10 17v-3M13 17v-6M16 17v-4"/>',
    equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c3 0 5.5 1.6 5.5 4.9"/>',
    pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M12 10v7M9 14l3 3 3-3"/>',
    xls: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const NAV = [
    ['painel', 'Painel'], ['mapa', 'Mapa'],
    'Cadastros', ['produtores', 'Produtores'], ['fazendas', 'Fazendas'], ['talhoes', 'Talhões'], ['safras', 'Safras'],
    'Campo', ['monitoramentos', 'Monitoramentos'], ['ordens', 'Ordens de trabalho'],
    'Gestão', ['relatorios', 'Relatórios'], ['equipe', 'Equipe e permissões'],
  ];
  const TITULO = Object.fromEntries(NAV.filter(Array.isArray));
  const mostraEquipe = () => S.papel === 'admin' || S.equipePendente;
  function renderNav() {
    $('#nav-links').innerHTML = NAV.map(n => {
      if (!Array.isArray(n)) return `<div class="grp">${n}</div>`;
      if (n[0] === 'equipe' && !mostraEquipe()) return '';
      return `<a href="#${n[0]}" data-nav="${n[0]}">${icon(n[0])}<span>${n[1]}</span>${n[0] === 'ordens' ? '<span class="badge" id="badge-ordens" hidden></span>' : ''}</a>`;
    }).join('');
    markNav(); updateBadges();
  }
  function markNav() { document.querySelectorAll('#nav-links a').forEach(a => { if (a.dataset.nav === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
  function updateBadges() {
    const b = $('#badge-ordens'); if (!b || !S.data.ordens) return;
    const n = S.data.ordens.filter(atrasada).length;
    b.hidden = !n; b.textContent = n; b.title = n + ' ordens atrasadas';
  }
  const VIEWS = { painel: viewPainel, mapa: viewMapa, produtores: viewProdutores, fazendas: viewFazendas, talhoes: viewTalhoes, safras: viewSafras, monitoramentos: viewMonitoramentos, ordens: viewOrdens, relatorios: viewRelatorios, equipe: viewEquipe };
  let current = null;
  function route() {
    const v = (location.hash || '#painel').slice(1);
    let name = VIEWS[v] ? v : 'painel';
    if (name === 'equipe' && !mostraEquipe()) name = 'painel';
    document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== 'v-' + name);
    current = name; markNav();
    $('#page-title').textContent = TITULO[name] || 'INOVAAGRO';
    document.title = (TITULO[name] ? TITULO[name] + ' · ' : '') + 'INOVAAGRO';
    document.body.classList.remove('nav-open');
    VIEWS[name](true);
  }
  function refresh() { if (current) VIEWS[current](false); }

  // ---------- Painel ----------
  function barras(items, opt = {}) {
    const max = Math.max(...items.map(i => i.v), 0) || 1;
    return `<div class="bars">${items.map(i => `<div class="bar ${i.go ? 'click' : ''}" ${i.go ? `data-go="${esc(i.go)}"` : ''} title="${esc(i.n)}: ${esc(i.tip || i.lbl)}">
      <span class="name">${i.c ? `<i class="dot" style="background:${i.c}"></i>` : ''}${esc(i.n)}</span>
      <span class="track"><span class="fill" style="width:${(i.v / max * 100).toFixed(1)}%;${i.c && opt.colorFill ? 'background:' + i.c : ''}"></span></span>
      <span class="v">${i.lbl}</span></div>`).join('') || '<p class="empty">Sem dados.</p>'}</div>`;
  }
  const safrasLista = () => [...new Set(S.data.safras.map(s => s.safra).filter(Boolean))].sort().reverse();
  function viewPainel() {
    const root = $('#v-painel');
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.innerHTML = `<div class="page"><div class="page-head"><div><h2>Visão geral</h2><p id="pn-sub">Resumo das fazendas, safras e operações.</p></div>
        <div class="toolbar"><select id="pn-prod" aria-label="Produtor"></select><select id="pn-safra" aria-label="Safra"></select></div></div>
        <div class="tiles" id="pn-tiles"></div>
        <div class="grid2" id="pn-grid"></div></div>`;
      root.addEventListener('change', () => viewPainel());
      root.addEventListener('click', e => {
        const g = e.target.closest('[data-go]'); if (!g) return;
        const [a, b] = g.dataset.go.split(':');
        if (a === 'cor') { S.colorBy = b; $('#color-by').value = b; location.hash = 'mapa'; }
        else if (a === 'faz') { location.hash = 'mapa'; setTimeout(() => selectFazenda(b, true), 80); }
        else if (a === 'prod') { location.hash = 'mapa'; setTimeout(() => selectProdutor(b), 80); }
      });
    }
    const sp = $('#pn-prod'), vp = sp.value; sp.innerHTML = prodOpts(); sp.value = vp;
    const ss = $('#pn-safra'), vs = ss.value; const sl = safrasLista(); ss.innerHTML = sl.map(s => `<option>${esc(s)}</option>`).join('') || '<option value="">Sem safras</option>'; ss.value = vs && sl.includes(vs) ? vs : (sl[0] || '');
    const prod = sp.value, safra = ss.value;
    const fazs = prod ? (S.fazPorProd.get(prod) || []) : S.data.fazendas;
    const fset = new Set(fazs.map(f => key(f.id)));
    const tals = S.data.talhoes.filter(t => fset.has(key(t.fazenda_id)));
    const tset = new Set(tals.map(t => key(t.id)));
    const area = tals.reduce((s, t) => s + num(t.area_ha), 0);
    const ords = S.data.ordens.filter(o => fset.has(key(o.fazenda_id)));
    const pend = ords.filter(pendente), atr = pend.filter(atrasada);
    const mons = S.data.monitoramentos.filter(m => tset.has(key(m.talhao_id)));
    const mon30 = mons.filter(m => diasDesde(m.data) <= 30);
    const safT = S.data.safras.filter(s => s.safra === safra && tset.has(key(s.talhao_id)));
    const areaSafra = safT.reduce((s, x) => s + (num(x.area_ha) || num(get('talhoes', x.talhao_id)?.area_ha)), 0);
    $('#pn-sub').textContent = prod ? 'Produtor: ' + (get('produtores', prod)?.nome || '') : 'Todos os produtores · ' + fmtInt(S.data.produtores.length) + ' produtores';
    $('#pn-tiles').innerHTML = [
      ['Área total', fmtHa0(area) + ' ha', fmtInt(tals.length) + ' talhões em ' + fmtInt(fazs.length) + ' fazendas'],
      ['Safra ' + (safra || '—'), fmtHa0(areaSafra) + ' ha', fmtInt(safT.length) + ' talhões plantados'],
      ['Ordens pendentes', fmtInt(pend.length), atr.length ? fmtInt(atr.length) + ' atrasadas' : 'Nenhuma atrasada', atr.length],
      ['Monitoramentos', fmtInt(mon30.length), 'nos últimos 30 dias · ' + fmtInt(mons.length) + ' no total'],
    ].map(([l, v, s, alert]) => `<div class="tile ${alert ? 'alert' : ''}"><span class="lbl">${esc(l)}</span><span class="val">${v}</span><span class="sub">${esc(s)}</span></div>`).join('');

    // variedades da safra
    const vmap = new Map();
    for (const s of safT) { const k = s.variedade || ((s.cultura || 'Plantio') + ' (sem variedade)'); vmap.set(k, (vmap.get(k) || 0) + (num(s.area_ha) || num(get('talhoes', s.talhao_id)?.area_ha))); }
    const vItems = [...vmap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, v]) => ({ n, v, lbl: fmtHa0(v) + ' ha' }));
    // situação
    const sc = {}; for (const t of tals) { const s = situacao(t); sc[s] = sc[s] || { n: 0, a: 0 }; sc[s].n++; sc[s].a += num(t.area_ha); }
    const sItems = Object.keys(SIT).filter(k => sc[k]).map(k => ({ n: SIT[k].l, c: SIT[k].c, v: sc[k].n, lbl: fmtInt(sc[k].n) + ' · ' + fmtHa0(sc[k].a) + ' ha', go: 'cor:situacao' }));
    // condição
    const cc = {}; for (const t of tals) { const c = condicao(t) || 'Sem monitoramento'; cc[c] = (cc[c] || 0) + num(t.area_ha); }
    const cItems = [...Object.keys(COND), 'Sem monitoramento'].filter(k => cc[k]).map(k => ({ n: k, c: COND[k] || OUTROS, v: cc[k], lbl: fmtHa0(cc[k]) + ' ha', go: 'cor:condicao' }));
    // área por produtor / fazenda
    let aItems;
    if (prod) aItems = fazs.map(f => ({ n: f.nome, v: areaTal(S.talPorFaz.get(key(f.id)) || []), go: 'faz:' + f.id })).sort((a, b) => b.v - a.v).slice(0, 10);
    else aItems = S.data.produtores.map(p => ({ n: p.nome, c: S.colors.get(key(p.id)), v: (S.fazPorProd.get(key(p.id)) || []).reduce((s, f) => s + areaTal(S.talPorFaz.get(key(f.id)) || []), 0), go: 'prod:' + p.id })).sort((a, b) => b.v - a.v);
    aItems.forEach(i => i.lbl = fmtHa0(i.v) + ' ha');
    const pendList = pend.slice().sort((a, b) => (atrasada(b) - atrasada(a)) || (a.data_prevista || '9').localeCompare(b.data_prevista || '9')).slice(0, 8);
    const monList = mons.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 8);
    $('#pn-grid').innerHTML = `
      <section class="card-box"><h3>Situação dos talhões <small>clique para ver no mapa</small></h3>${barras(sItems, { colorFill: 1 })}</section>
      <section class="card-box"><h3>Área por variedade <small>safra ${esc(safra || '—')}</small></h3>${barras(vItems)}</section>
      <section class="card-box"><h3>Ordens pendentes <small><a href="#ordens">ver todas</a></small></h3><div class="list">${pendList.map(o => {
        const f = get('fazendas', o.fazenda_id);
        return `<div class="row" data-edit="ordens:${esc(o.id)}"><b>${esc(o.titulo)}</b>${atrasada(o) ? '<span class="pill bad">Atrasada</span>' : `<span class="pill ${STATUS_CLS[o.status] || ''}">${esc(o.status || 'Planejada')}</span>`}<small>${esc(f?.nome || '—')} · prevista ${fmtDate(o.data_prevista)}${o.area_ha ? ' · ' + fmtHa(o.area_ha) + ' ha' : ''}</small></div>`;
      }).join('') || '<p class="empty">Nenhuma ordem pendente.</p>'}</div></section>
      <section class="card-box"><h3>Últimos monitoramentos <small><a href="#monitoramentos">ver todos</a></small></h3><div class="list">${monList.map(m => {
        const t = get('talhoes', m.talhao_id), f = t && get('fazendas', t.fazenda_id);
        return `<div class="row" data-edit="monitoramentos:${esc(m.id)}"><b>${esc(m.alvo || m.tipo || 'Monitoramento')}</b>${m.nivel ? `<span class="pill ${NIVEL_CLS[m.nivel] || ''}">${esc(m.nivel)}</span>` : '<span></span>'}<small>${fmtDate(m.data)} · ${esc(f?.nome || '')} · ${esc(nomeTal(t))}${m.estado_talhao ? ' · ' + esc(m.estado_talhao) : ''}</small></div>`;
      }).join('') || '<p class="empty">Nenhum monitoramento.</p>'}</div></section>
      <section class="card-box"><h3>${prod ? 'Área por fazenda' : 'Área por produtor'} <small>${prod ? 'maiores 10' : ''}</small></h3>${barras(aItems)}</section>
      <section class="card-box"><h3>Condição dos talhões <small>último monitoramento, em hectares</small></h3>${barras(cItems, { colorFill: 1 })}</section>`;
  }

  // ---------- Mapa ----------
  let map, layerTal, layerFaz, layerLbl, layersById = new Map(), mapReady = false, baseLayers = {};
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  function initMap() {
    if (mapReady || !window.L) return;
    mapReady = true;
    map = L.map('map', { zoomControl: false, preferCanvas: true, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
    const img = L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagem: Esri, Maxar' });
    const nomes = L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    baseLayers = { sat: [img], hib: [img, nomes], ruas: [ruas] };
    let tileErrors = 0, tileOk = 0;
    img.on('tileerror', () => {
      if (!navigator.onLine) { const n = $('#mapnote'); n.textContent = 'Sem internet: a imagem de satélite aparece só nas áreas guardadas com "Salvar mapa offline". Os contornos dos talhões aparecem sempre.'; n.hidden = false; return; }
      if (++tileErrors > 3 && !tileOk) $('#mapnote').hidden = false;
    });
    img.on('tileload', () => { tileOk++; $('#mapnote').hidden = true; });
    setBase(S.base_map);
    window.addEventListener('online', () => { $('#mapnote').hidden = true; });
    layerTal = L.featureGroup().addTo(map);
    layerFaz = L.featureGroup().addTo(map);
    layerLbl = L.layerGroup().addTo(map);
    map.on('zoomend', syncFazMarkers);
    map.on('moveend', syncLabels);
    map.on('click', () => { if (S.sel.talhao) { S.sel.talhao = null; drawSheet(); styleAll(); renderTree(); } });
    $('#color-by').value = S.colorBy;
  }
  function setBase(b) {
    S.base_map = b;
    for (const ls of Object.values(baseLayers)) for (const l of ls) if (map.hasLayer(l)) map.removeLayer(l);
    for (const l of baseLayers[b]) { l.addTo(map); l.bringToBack && l.bringToBack(); }
    if (b === 'hib') baseLayers.hib[1].bringToFront();
    document.querySelectorAll('[data-base]').forEach(x => x.setAttribute('aria-pressed', x.dataset.base === b));
  }
  function drawLayers() {
    layerTal.clearLayers(); layerFaz.clearLayers(); layersById.clear();
    for (const t of S.data.talhoes) {
      if (!t.geometry) continue;
      const lyr = L.geoJSON(t.geometry, { style: () => styleFor(t) });
      lyr.on('click', e => { L.DomEvent.stopPropagation(e); selectTalhao(t.id, false); });
      lyr.bindTooltip(() => `<b>${esc(nomeTal(t))}</b> · ${fmtHa(t.area_ha)} ha<br><span style="font-weight:400">${esc(grupoTal(t)[0])}</span>`, { sticky: true, className: 'lbl' });
      lyr.addTo(layerTal); layersById.set(key(t.id), lyr);
    }
    for (const f of S.data.fazendas) {
      const c = fazCenter(f); if (!c) continue;
      const ts = S.talPorFaz.get(key(f.id)) || [], g = new Map();
      for (const t of ts) { const [n, cor] = grupoTal(t); g.set(cor, (g.get(cor) || 0) + (num(t.area_ha) || 1)); }
      // fazenda ganha a cor do grupo com mais área (por situação: a pior situação presente)
      let cor = S.colors.get(key(f.produtor_id)) || OUTROS;
      if (S.colorBy === 'situacao') { for (const k of Object.keys(SIT)) if (g.has(SIT[k].c)) { cor = SIT[k].c; break; } }
      else if (S.colorBy !== 'produtor' && g.size) cor = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0];
      L.circleMarker(c, { radius: 7, color: '#fff', weight: 2, fillColor: cor, fillOpacity: 1 })
        .bindTooltip(esc(f.nome) + ' · ' + fmtHa0(areaTal(ts)) + ' ha', { className: 'lbl' })
        .on('click', () => selectFazenda(f.id, true)).addTo(layerFaz);
    }
    syncFazMarkers(); syncLabels();
    drawLegend();
  }
  function fazCenter(f) {
    const b = boundsOf(S.talPorFaz.get(key(f.id)) || []);
    if (b) return b.getCenter();
    return f.lat != null && f.lng != null ? L.latLng(f.lat, f.lng) : null;
  }
  function boundsOf(ts) {
    let b = null;
    for (const t of ts) { const l = layersById.get(key(t.id)); if (l) { const lb = l.getBounds(); b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast()); } }
    return b;
  }
  function syncFazMarkers() { if (!map || !map._loaded) return; const show = map.getZoom() < 12; if (show && !map.hasLayer(layerFaz)) map.addLayer(layerFaz); if (!show && map.hasLayer(layerFaz)) map.removeLayer(layerFaz); }
  function syncLabels() {
    if (!map || !layerLbl || !map._loaded) return;
    layerLbl.clearLayers();
    if (map.getZoom() < 15) return;
    const vb = map.getBounds(); let n = 0;
    for (const t of S.data.talhoes) {
      const l = layersById.get(key(t.id)); if (!l) continue;
      const c = l.getBounds().getCenter(); if (!vb.contains(c)) continue;
      if (++n > 250) break;
      L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: null, html: `<div class="tal-lbl">${esc(t.nome)}</div>` }) }).addTo(layerLbl);
    }
  }
  function inSel(t) {
    if (S.sel.fazenda) return key(t.fazenda_id) === key(S.sel.fazenda);
    if (S.sel.produtor) return key(t._prod) === key(S.sel.produtor);
    return true;
  }
  function styleFor(t) {
    const sel = key(t.id) === key(S.sel.talhao), on = inSel(t), c = corTal(t);
    return { color: sel ? '#ffffff' : c, weight: sel ? 3 : 1.5, fillColor: c, fillOpacity: sel ? 0.6 : on ? 0.38 : 0.08, opacity: on ? 1 : 0.35 };
  }
  function styleAll() { for (const t of S.data.talhoes) { const l = layersById.get(key(t.id)); if (l) l.setStyle(styleFor(t)); } }
  function fitSel() {
    let ts = S.data.talhoes.filter(inSel);
    if (S.sel.talhao) ts = [get('talhoes', S.sel.talhao)].filter(Boolean);
    const b = boundsOf(ts);
    if (b) map.fitBounds(b, { padding: [30, 30], maxZoom: 17 });
  }
  function drawLegend() {
    const g = new Map();
    for (const t of S.data.talhoes) { if (!inSel(t)) continue; const [n, c] = grupoTal(t); const x = g.get(n) || { c, n: 0, a: 0 }; x.n++; x.a += num(t.area_ha); g.set(n, x); }
    let items = [...g.entries()];
    if (S.colorBy === 'situacao') items.sort((a, b) => Object.values(SIT).findIndex(s => s.l === a[0]) - Object.values(SIT).findIndex(s => s.l === b[0]));
    else if (S.colorBy === 'condicao') { const ord = [...Object.keys(COND), 'Sem monitoramento']; items.sort((a, b) => ord.indexOf(a[0]) - ord.indexOf(b[0])); }
    else if (S.colorBy === 'produtor') items.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    else items.sort((a, b) => (a[1].c === OUTROS) - (b[1].c === OUTROS) || b[1].a - a[1].a);
    $('#legend').innerHTML = items.map(([n, x]) => `<div class="li" title="${esc(n)}: ${fmtInt(x.n)} talhões, ${fmtHa(x.a)} ha"><i class="dot" style="background:${x.c}"></i><span class="grow">${esc(n)}</span><span class="num">${fmtHa0(x.a)} ha</span></div>`).join('') || '<span class="muted">Nenhum talhão.</span>';
  }

  function selectProdutor(id) { S.sel = { produtor: id, fazenda: null, talhao: null }; afterSel(true); }
  function selectFazenda(id, fit) { const f = get('fazendas', id); S.sel = { produtor: f ? f.produtor_id : null, fazenda: id, talhao: null }; afterSel(fit); }
  function selectTalhao(id, fit) { const t = get('talhoes', id); if (!t) return; S.sel = { produtor: t._prod, fazenda: t.fazenda_id, talhao: id }; afterSel(fit); }
  function afterSel(fit) {
    if (location.hash !== '#mapa') { location.hash = 'mapa'; setTimeout(() => { styleAll(); drawLegend(); fitSel(); }, 50); }
    styleAll(); drawLegend(); renderTree(); drawSheet(); if (fit) fitSel();
  }

  function renderKpis() {
    const area = S.data.talhoes.reduce((s, t) => s + num(t.area_ha), 0);
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
        const area = ts.reduce((s, t) => s + num(t.area_ha), 0);
        const fOpen = (q && tsShow.length && !fm) || key(S.sel.fazenda) === key(f.id);
        inner += `<details class="f" ${fOpen ? 'open' : ''}><summary data-f="${esc(f.id)}" class="${key(S.sel.fazenda) === key(f.id) && !S.sel.talhao ? 'sel' : ''}">${CHEV}<span class="grow">${esc(f.nome)}</span><span class="muted num">${fmtHa(area)} ha</span></summary>`
          + tsShow.map(t => `<div class="t ${key(S.sel.talhao) === key(t.id) ? 'sel' : ''}" data-t="${esc(t.id)}"><i class="dot" style="background:${corTal(t)}"></i><span class="grow">${esc(nomeTal(t))}</span><span class="num">${fmtHa(t.area_ha)}</span></div>`).join('')
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
    const ords = (S.ordPorTal.get(key(t.id)) || []).slice().sort((a, b) => (b.data_prevista || '').localeCompare(a.data_prevista || '')).slice(0, 6);
    const sit = SIT[situacao(t)], cond = condicao(t);
    el.hidden = false;
    el.innerHTML = `<header><div class="row"><div><div class="eyebrow">${esc(f ? f.nome : '')}</div><h2>${esc(nomeTal(t))}</h2></div><button class="x" data-act="close" aria-label="Fechar">×</button></div>
        <div><span class="pill ${sit.cls}"><i class="dot" style="background:${sit.c}"></i>${esc(sit.l)}</span></div></header>
      <div class="body">
        <dl class="facts"><dt>Área</dt><dd class="num">${fmtHa(t.area_ha)} ha</dd><dt>Produtor</dt><dd>${esc(p ? p.nome : '—')}</dd>
        <dt>Cultura atual</dt><dd>${saf[0] ? esc(saf[0].cultura + (saf[0].variedade ? ' · ' + saf[0].variedade : '') + ' · ' + saf[0].safra) : '<span class="muted">Sem plantio cadastrado</span>'}</dd>
        <dt>Condição</dt><dd>${cond ? `<i class="dot" style="background:${COND[cond] || OUTROS}"></i> ${esc(cond)}` : '<span class="muted">Sem monitoramento</span>'}</dd>
        ${t.obs ? `<dt>Obs.</dt><dd>${esc(t.obs)}</dd>` : ''}<dt>Código SIMA</dt><dd class="num muted">${/^\d+$/.test(key(t.id)) ? esc(t.id) : '—'}</dd></dl>
        <div class="so-edita" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-act="edit-tal">Editar talhão</button></div>
        <section class="mini"><div class="sec-title">Safras <button class="btn small so-edita" data-act="new-saf">+ Plantio</button></div>
          ${saf.length ? saf.map(s => `<div class="it" data-edit="safras:${esc(s.id)}"><div class="top"><b>${esc(s.cultura)}</b><span class="muted">${esc(s.safra)}</span></div><span class="muted">${esc(s.variedade || '')}${s.data_plantio ? ' · plantio ' + fmtDate(s.data_plantio) : ''}${s.produtividade ? ' · ' + esc(s.produtividade) : ''}</span></div>`).join('') : '<p class="empty">Nenhum plantio cadastrado.</p>'}</section>
        <section class="mini"><div class="sec-title">Monitoramentos <button class="btn small so-edita" data-act="new-mon">+ Registrar</button></div>
          ${mon.length ? mon.map(m => `<div class="it" data-edit="monitoramentos:${esc(m.id)}"><div class="top"><b>${esc(m.alvo || m.tipo)}</b><span class="muted">${fmtDate(m.data)}</span></div><span>${m.nivel ? `<span class="pill ${NIVEL_CLS[m.nivel] || ''}">${esc(m.nivel)}</span> ` : ''}<span class="muted">${esc(m.tipo || '')}${m.estadio ? ' · ' + esc(m.estadio) : ''}</span></span></div>`).join('') : '<p class="empty">Nenhum monitoramento.</p>'}</section>
        <section class="mini"><div class="sec-title">Ordens de trabalho <button class="btn small so-edita" data-act="new-ord">+ Nova</button></div>
          ${ords.length ? ords.map(o => `<div class="it" data-edit="ordens:${esc(o.id)}"><div class="top"><b>${esc(o.titulo)}</b>${atrasada(o) ? '<span class="pill bad">Atrasada</span>' : `<span class="pill ${STATUS_CLS[o.status] || ''}">${esc(o.status)}</span>`}</div><span class="muted">${esc(o.tipo || '')} · ${fmtDate(o.data_prevista)}</span></div>`).join('') : '<p class="empty">Nenhuma ordem.</p>'}</section>
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
      root.innerHTML = `<div class="page"><div class="page-head"><div><h2>${opts.title}</h2><p>${opts.sub}</p></div><button class="btn primary" data-new="${opts.kind}">+ Novo ${esc(NOME[opts.kind])}</button></div>
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
      $('#tb-' + id, root).onclick = e => { const tr = e.target.closest('tr[data-row]'); if (tr && !e.target.closest('button')) opts.click(tr.dataset.row); };
    }
    fill();
  }
  const prodOpts = () => '<option value="">Todos os produtores</option>' + S.data.produtores.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
  const areaTal = ts => ts.reduce((s, t) => s + num(t.area_ha), 0);

  function viewProdutores() {
    tablePage('produtores', {
      kind: 'produtores', title: 'Produtores', sub: 'Clientes e proprietários das fazendas.',
      rows: () => S.data.produtores, text: r => r.nome + ' ' + (r.documento || ''),
      cols: [
        { l: 'Nome', v: r => `<i class="dot" style="background:${S.colors.get(key(r.id))};margin-right:6px"></i>${esc(r.nome)}` },
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
      kind: 'fazendas', title: 'Fazendas', sub: 'Propriedades e seus talhões. Clique para ver ou editar.',
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
        { l: '', v: r => `<button class="btn small" data-map-faz="${esc(r.id)}">Ver no mapa</button> <button class="btn small" data-rep-faz="${esc(r.id)}">Relatório</button>` },
      ],
      click: id => openForm('fazendas', get('fazendas', id)),
    });
  }
  function viewTalhoes() {
    tablePage('talhoes', {
      kind: 'talhoes', title: 'Talhões', sub: 'Áreas de plantio com contorno no mapa.',
      rows: () => S.data.talhoes.slice().sort((a, b) => (get('fazendas', a.fazenda_id)?.nome || '').localeCompare(get('fazendas', b.fazenda_id)?.nome || '', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
      text: r => r.nome + ' ' + (get('fazendas', r.fazenda_id)?.nome || '') + ' ' + (get('produtores', r._prod)?.nome || ''),
      filter: () => '<option value="">Todas as situações</option>' + Object.entries(SIT).map(([k, s]) => `<option value="${k}">${esc(s.l)}</option>`).join(''),
      match: (r, v) => situacao(r) === v,
      cols: [
        { l: 'Talhão', v: r => esc(nomeTal(r)) },
        { l: 'Fazenda', v: r => esc(get('fazendas', r.fazenda_id)?.nome || '—') },
        { l: 'Produtor', v: r => esc(get('produtores', r._prod)?.nome || '—') },
        { l: 'Cultura atual', v: r => { const c = culturaAtual(r); return c ? esc(c.cultura + (c.variedade ? ' · ' + c.variedade : '') + ' · ' + c.safra) : '<span class="muted">—</span>'; } },
        { l: 'Situação', v: r => { const s = SIT[situacao(r)]; return `<span class="pill ${s.cls}">${esc(s.l)}</span>`; } },
        { l: 'Área (ha)', r: 1, v: r => fmtHa(r.area_ha) },
      ],
      click: id => { const t = get('talhoes', id); if (t && t.geometry) { location.hash = 'mapa'; setTimeout(() => selectTalhao(id, true), 60); } else openForm('talhoes', t); },
    });
  }
  function viewSafras() {
    tablePage('safras', {
      kind: 'safras', title: 'Safras', sub: 'O que foi plantado em cada talhão, por safra.',
      rows: () => S.data.safras.slice().sort((a, b) => (b.safra || '').localeCompare(a.safra || '')),
      text: r => [r.safra, r.cultura, r.variedade, nomeTal(get('talhoes', r.talhao_id)), get('fazendas', get('talhoes', r.talhao_id)?.fazenda_id)?.nome].join(' '),
      filter: () => '<option value="">Todas as safras</option>' + safrasLista().map(s => `<option>${esc(s)}</option>`).join(''),
      match: (r, v) => r.safra === v,
      cols: [
        { l: 'Safra', v: r => esc(r.safra) },
        { l: 'Cultura', v: r => `<i class="dot" style="background:${CULT_COLOR[r.cultura] || OUTROS};margin-right:6px"></i>${esc(r.cultura)}` },
        { l: 'Variedade', v: r => esc(r.variedade || '—') },
        { l: 'Talhão', v: r => esc(nomeTal(get('talhoes', r.talhao_id))) },
        { l: 'Fazenda', v: r => esc(get('fazendas', get('talhoes', r.talhao_id)?.fazenda_id)?.nome || '—') },
        { l: 'Plantio', v: r => fmtDate(r.data_plantio) },
        { l: 'Colheita', v: r => fmtDate(r.data_colheita) },
        { l: 'Área (ha)', r: 1, v: r => fmtHa(r.area_ha ?? get('talhoes', r.talhao_id)?.area_ha) },
      ],
      click: id => openForm('safras', get('safras', id)),
    });
  }
  function viewMonitoramentos() {
    tablePage('monitoramentos', {
      kind: 'monitoramentos', title: 'Monitoramentos', sub: 'Visitas de campo: pragas, doenças, estádio e condição da cultura.',
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
        { l: 'Condição', v: r => r.estado_talhao ? `<i class="dot" style="background:${COND[r.estado_talhao] || OUTROS};margin-right:6px"></i>${esc(r.estado_talhao)}` : '—' },
        { l: 'Responsável', v: r => esc(r.responsavel || '—') },
      ],
      click: id => openForm('monitoramentos', get('monitoramentos', id)),
    });
  }
  function viewOrdens() {
    const root = $('#v-ordens');
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.innerHTML = `<div class="page"><div class="page-head"><div><h2>Ordens de trabalho</h2><p>Pulverizações, plantio, colheita e demais operações, por situação. Atrasadas ficam marcadas em vermelho.</p></div><button class="btn primary" data-new="ordens">+ Nova ordem</button></div>
        <div class="toolbar"><input type="search" id="q-ordens" placeholder="Buscar por título, produto, fazenda…" aria-label="Buscar ordens"><select id="f-ordens" aria-label="Filtrar por produtor"></select><label class="rep-checks"><label><input type="checkbox" id="so-atrasadas"> Só atrasadas</label></label></div><div class="board" id="board"></div></div>`;
      $('#q-ordens').addEventListener('input', viewOrdens);
      $('#f-ordens').addEventListener('change', viewOrdens);
      $('#so-atrasadas').addEventListener('change', viewOrdens);
    }
    const s = $('#f-ordens'), v = s.value; s.innerHTML = prodOpts(); s.value = v;
    const q = $('#q-ordens').value.trim().toLowerCase(), soAtr = $('#so-atrasadas').checked;
    const rows = S.data.ordens.filter(o => {
      const f = get('fazendas', o.fazenda_id);
      if (s.value && key(f?.produtor_id) !== s.value) return false;
      if (soAtr && !atrasada(o)) return false;
      return !q || [o.titulo, o.tipo, o.responsavel, o.insumos, f?.nome].join(' ').toLowerCase().includes(q);
    }).sort((a, b) => (a.data_prevista || '9').localeCompare(b.data_prevista || '9'));
    $('#board').innerHTML = STATUS.map(st => {
      let it = rows.filter(o => (o.status || 'Planejada') === st);
      if (st === 'Concluída' || st === 'Cancelada') it = it.reverse();
      return `<div class="col"><h3>${esc(st)} <span class="muted num">${it.length}</span></h3>${it.slice(0, 200).map(o => {
        const f = get('fazendas', o.fazenda_id); const ts = (o.talhao_ids || []).map(id => get('talhoes', id)).filter(Boolean);
        return `<div class="card ${atrasada(o) ? 'late' : ''}" data-edit="ordens:${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc(o.tipo || '')} · ${atrasada(o) ? '<b style="color:var(--bad)">atrasada</b> · ' : ''}${fmtDate(o.data_prevista)}</small><small>${esc(f?.nome || '—')}${ts.length ? ' · ' + ts.length + (ts.length === 1 ? ' talhão' : ' talhões') + ' · ' + fmtHa(o.area_ha || areaTal(ts)) + ' ha' : ''}</small></div>`;
      }).join('') || '<p class="empty">Nenhuma.</p>'}</div>`;
    }).join('');
  }

  // ---------- Relatórios ----------
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const LIBS = { jspdf: CDN + 'jspdf/2.5.1/jspdf.umd.min.js', autotable: CDN + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', xlsx: CDN + 'xlsx/0.18.5/xlsx.full.min.js' };
  const libP = {};
  function loadLib(n) {
    return libP[n] = libP[n] || new Promise((ok, fail) => { const s = document.createElement('script'); s.src = LIBS[n]; s.onload = ok; s.onerror = () => { delete libP[n]; fail(new Error('Não carregou ' + n)); }; document.head.appendChild(s); });
  }
  const R = { prod: '', faz: '', safra: '', de: '', ate: '', secs: { tal: true, ord: true, mon: true } };
  function repData() {
    let fazs = R.faz ? [get('fazendas', R.faz)].filter(Boolean) : R.prod ? (S.fazPorProd.get(R.prod) || []) : S.data.fazendas;
    fazs = fazs.slice().sort((a, b) => (get('produtores', a.produtor_id)?.nome || '').localeCompare(get('produtores', b.produtor_id)?.nome || '', 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
    const noPeriodo = d => (!R.de || (d || '') >= R.de) && (!R.ate || (d || '') <= R.ate);
    const out = [], tot = { faz: 0, tal: 0, area: 0, pend: 0, atr: 0, conc: 0, mon: 0 };
    for (const f of fazs) {
      const p = get('produtores', f.produtor_id);
      const ts = (S.talPorFaz.get(key(f.id)) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
      const tset = new Set(ts.map(t => key(t.id)));
      const tal = ts.map(t => {
        const c = culturaAtual(t, R.safra), m = ultimoMon(t), sit = SIT[situacao(t)], cnd = condicao(t);
        return { talhao: nomeTal(t), area: num(t.area_ha) || null, cultura: c?.cultura || '', variedade: c?.variedade || '', safra: c?.safra || '', plantio: c?.data_plantio || '', condicao: cnd || '', ult_mon: m?.data || '', situacao: sit.l };
      });
      const ords = (S.ordPorFaz.get(key(f.id)) || []).filter(o => noPeriodo(o.data_prevista)).sort((a, b) => (a.data_prevista || '').localeCompare(b.data_prevista || '')).map(o => ({
        titulo: o.titulo || '', tipo: o.tipo || '', situacao: atrasada(o) ? 'Atrasada' : (o.status || 'Planejada'), prevista: o.data_prevista || '', conclusao: o.data_conclusao || '',
        area: num(o.area_ha) || areaTal((o.talhao_ids || []).map(id => get('talhoes', id)).filter(Boolean)) || null,
        talhoes: (o.talhao_ids || []).map(id => get('talhoes', id)).filter(Boolean).map(t => t.nome).join(', '),
        produtos: (o.produtos && o.produtos.length ? o.produtos.map(x => `${x.produto} ${x.dose != null ? String(x.dose).replace('.', ',') : ''} ${x.unidade || ''}`.replace(/\s+/g, ' ').trim()) : String(o.insumos || '').split(/\r?\n/).filter(Boolean)).join('; '),
        responsavel: o.responsavel || '', obs: o.obs || '', _o: o,
      }));
      const mons = S.data.monitoramentos.filter(m => tset.has(key(m.talhao_id)) && noPeriodo(m.data)).sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(m => ({
        data: m.data || '', talhao: nomeTal(get('talhoes', m.talhao_id)), tipo: m.tipo || '', alvo: m.alvo || '', nivel: m.nivel || '', estadio: m.estadio || '', condicao: m.estado_talhao || '', responsavel: m.responsavel || '', obs: m.obs || '',
      }));
      const area = ts.reduce((s, t) => s + num(t.area_ha), 0);
      tot.faz++; tot.tal += ts.length; tot.area += area; tot.mon += mons.length;
      for (const o of ords) { if (pendente(o._o)) tot.pend++; if (atrasada(o._o)) tot.atr++; if (o._o.status === 'Concluída') tot.conc++; }
      out.push({ f, p, area, tal, ords, mons });
    }
    return { fazendas: out, tot };
  }
  const repTitulo = () => R.faz ? (get('fazendas', R.faz)?.nome || 'Fazenda') : R.prod ? (get('produtores', R.prod)?.nome || 'Produtor') : 'Todas as fazendas';
  const repFiltro = () => [R.safra ? 'Safra ' + R.safra : 'Safra mais recente', R.de || R.ate ? 'Período ' + (R.de ? fmtDate(R.de) : 'início') + ' a ' + (R.ate ? fmtDate(R.ate) : 'hoje') : 'Todo o período'].join(' · ');
  const COLS = {
    tal: [['talhao', 'Talhão'], ['area', 'Área (ha)', 'ha'], ['cultura', 'Cultura'], ['variedade', 'Variedade'], ['safra', 'Safra'], ['plantio', 'Plantio', 'd'], ['condicao', 'Condição'], ['ult_mon', 'Últ. monitoramento', 'd'], ['situacao', 'Situação']],
    ord: [['titulo', 'Ordem'], ['tipo', 'Tipo'], ['situacao', 'Situação'], ['prevista', 'Prevista', 'd'], ['conclusao', 'Conclusão', 'd'], ['area', 'Área (ha)', 'ha'], ['talhoes', 'Talhões', 'w'], ['produtos', 'Produtos e doses', 'w']],
    mon: [['data', 'Data', 'd'], ['talhao', 'Talhão'], ['tipo', 'Tipo'], ['alvo', 'Alvo'], ['nivel', 'Nível'], ['estadio', 'Estádio'], ['condicao', 'Condição'], ['responsavel', 'Responsável'], ['obs', 'Observações', 'w']],
  };
  const SEC_NOME = { tal: 'Talhões', ord: 'Ordens de trabalho', mon: 'Monitoramentos' };
  const cellTxt = (c, v) => c[2] === 'd' ? (v ? fmtDate(v) : '') : c[2] === 'ha' ? (v == null ? '' : fmtHa(v)) : String(v ?? '');
  function viewRelatorios() {
    const root = $('#v-relatorios');
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.innerHTML = `<div class="page"><div class="page-head no-print"><div><h2>Relatórios</h2><p>Escolha o produtor ou a fazenda e baixe em PDF ou Excel.</p></div>
          <div class="rep-actions"><button class="btn primary" data-rep="pdf">${icon('pdf')}Baixar PDF</button><button class="btn" data-rep="xlsx">${icon('xls')}Baixar Excel</button><button class="btn" data-rep="print">${icon('print')}Imprimir</button></div></div>
        <div class="card-box no-print"><div class="rep-controls">
          <label class="field"><span>Produtor</span><select id="r-prod"></select></label>
          <label class="field"><span>Fazenda</span><select id="r-faz"></select></label>
          <label class="field"><span>Safra (talhões)</span><select id="r-safra"></select></label>
          <label class="field"><span>Ordens e monitoramentos de</span><input type="date" id="r-de"></label>
          <label class="field"><span>até</span><input type="date" id="r-ate"></label>
        </div><div class="rep-checks"><span class="muted">Incluir:</span>${Object.entries(SEC_NOME).map(([k, l]) => `<label><input type="checkbox" data-sec="${k}" checked> ${l}</label>`).join('')}</div></div>
        <div id="r-prev"></div></div>`;
      root.addEventListener('change', e => {
        if (e.target.id === 'r-prod') { R.prod = e.target.value; R.faz = ''; }
        else if (e.target.id === 'r-faz') R.faz = e.target.value;
        else if (e.target.id === 'r-safra') R.safra = e.target.value;
        else if (e.target.id === 'r-de') R.de = e.target.value;
        else if (e.target.id === 'r-ate') R.ate = e.target.value;
        else if (e.target.dataset.sec) R.secs[e.target.dataset.sec] = e.target.checked;
        viewRelatorios();
      });
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-rep]'); if (!b) return;
        if (b.dataset.rep === 'print') { window.print(); return; }
        const txt = b.innerHTML; b.disabled = true; b.textContent = 'Gerando…';
        try { if (b.dataset.rep === 'pdf') await gerarPDF(); else await gerarExcel(); }
        catch (err) { console.error(err); toast('Não foi possível gerar o arquivo. Verifique a internet e tente de novo.'); }
        finally { b.disabled = false; b.innerHTML = txt; }
      });
    }
    $('#r-prod').innerHTML = prodOpts(); $('#r-prod').value = R.prod;
    const fz = (R.prod ? (S.fazPorProd.get(R.prod) || []) : S.data.fazendas).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    $('#r-faz').innerHTML = '<option value="">Todas as fazendas</option>' + fz.map(f => `<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join(''); $('#r-faz').value = R.faz;
    $('#r-safra').innerHTML = '<option value="">Mais recente de cada talhão</option>' + safrasLista().map(s => `<option>${esc(s)}</option>`).join(''); $('#r-safra').value = R.safra;
    $('#r-de').value = R.de; $('#r-ate').value = R.ate;
    const D = repData(), t = D.tot;
    const logo = $('.nav-brand .logo-claro')?.getAttribute('src') || '';
    const MAX = 25;
    $('#r-prev').innerHTML = `<article class="report">
      <div class="rep-head"><img src="${esc(logo)}" alt="InovaAgro"><div class="t"><b>${esc(repTitulo())}</b><span class="muted">${esc(repFiltro())} · emitido em ${fmtDate(today())}</span></div></div>
      <div class="rep-sum">${[[t.faz, 'Fazendas'], [t.tal, 'Talhões'], [fmtHa0(t.area), 'Hectares'], [t.pend, 'Ordens pendentes'], [t.atr, 'Ordens atrasadas'], [t.mon, 'Monitoramentos']].map(([v, l]) => `<div><b>${typeof v === 'number' ? fmtInt(v) : v}</b><span>${l}</span></div>`).join('')}</div>
      ${D.fazendas.slice(0, MAX).map(x => `<section class="faz"><h3>${esc(x.f.nome)}</h3><span class="muted">${esc(x.p?.nome || '')}${x.f.municipio ? ' · ' + esc(x.f.municipio) : ''}${x.f.codigo ? ' · código ' + esc(x.f.codigo) : ''} · ${fmtInt(x.tal.length)} talhões · ${fmtHa(x.area)} ha</span>
        ${Object.keys(SEC_NOME).filter(k => R.secs[k]).map(k => { const rows = k === 'tal' ? x.tal : k === 'ord' ? x.ords : x.mons; return `<h4>${SEC_NOME[k]} (${rows.length})</h4>` + (rows.length ? `<div class="table-wrap"><table><thead><tr>${COLS[k].map(c => `<th class="${c[2] === 'ha' ? 'r' : ''}">${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${COLS[k].map(c => `<td class="${c[2] === 'ha' ? 'r' : c[2] === 'w' ? 'wrap' : ''}">${esc(cellTxt(c, r[c[0]]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhum registro.</p>'); }).join('')}
      </section>`).join('')}
      ${D.fazendas.length > MAX ? `<p class="muted">Prévia mostra ${MAX} de ${fmtInt(D.fazendas.length)} fazendas. O PDF e o Excel trazem todas.</p>` : ''}
      ${D.fazendas.length ? '' : '<p class="empty">Nenhuma fazenda encontrada.</p>'}
    </article>`;
  }
  function imgDataUrl(sel) {
    const img = $(sel); if (!img || !img.complete || !img.naturalWidth) return null;
    try { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return { url: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }; } catch (e) { return null; }
  }
  const nomeArq = ext => ('relatorio-' + repTitulo() + '-' + today()).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase() + '.' + ext;
  async function gerarPDF() {
    await loadLib('jspdf'); await loadLib('autotable');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
    const VERDE = [94, 129, 69], LIMA = [177, 210, 67], TINTA = [32, 30, 30], CINZA = [100, 106, 95];
    const D = repData(), t = D.tot;
    const logo = imgDataUrl('.nav-brand .logo-claro');
    if (logo) doc.addImage(logo.url, 'PNG', M, M, 60, 60 * logo.h / logo.w);
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...VERDE); doc.text('InovaAgro', M, M + 8); }
    doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(repTitulo(), W - M, M + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
    doc.text(repFiltro() + ' · emitido em ' + fmtDate(today()), W - M, M + 10, { align: 'right' });
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.8); doc.line(M, M + 15, W - M, M + 15);
    // resumo
    const sum = [[t.faz, 'Fazendas'], [t.tal, 'Talhões'], [fmtHa0(t.area), 'Hectares'], [t.pend, 'Ordens pendentes'], [t.atr, 'Ordens atrasadas'], [t.mon, 'Monitoramentos']];
    const bw = (W - 2 * M - 5 * 4) / 6;
    sum.forEach(([v, l], i) => {
      const x = M + i * (bw + 4), y = M + 19;
      doc.setFillColor(237, 241, 230); doc.roundedRect(x, y, bw, 15, 2, 2, 'F');
      doc.setFillColor(...(i === 4 && t.atr ? [208, 59, 59] : LIMA)); doc.rect(x, y, 1.2, 15, 'F');
      doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(typeof v === 'number' ? fmtInt(v) : v, x + 4, y + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.text(l.toUpperCase(), x + 4, y + 12);
    });
    let y = M + 42;
    const secs = Object.keys(SEC_NOME).filter(k => R.secs[k]);
    for (const x of D.fazendas) {
      if (y > H - 40) { doc.addPage(); y = M + 4; }
      doc.setTextColor(...VERDE); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text(x.f.nome, M, y);
      doc.setTextColor(...CINZA); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text([x.p?.nome, x.f.municipio, x.f.codigo ? 'código ' + x.f.codigo : '', fmtInt(x.tal.length) + ' talhões', fmtHa(x.area) + ' ha'].filter(Boolean).join(' · '), M, y + 5);
      y += 8;
      for (const k of secs) {
        const rows = k === 'tal' ? x.tal : k === 'ord' ? x.ords : x.mons;
        if (y > H - 30) { doc.addPage(); y = M + 4; }
        doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text(`${SEC_NOME[k]} (${rows.length})`, M, y + 3);
        y += 5;
        if (!rows.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text('Nenhum registro.', M, y + 3); y += 7; continue; }
        doc.autoTable({
          startY: y, margin: { left: M, right: M, top: M + 4, bottom: 14 },
          head: [COLS[k].map(c => c[1])], body: rows.map(r => COLS[k].map(c => cellTxt(c, r[c[0]]))),
          styles: { fontSize: 7.5, cellPadding: 1.4, textColor: TINTA, lineColor: [217, 223, 208], lineWidth: 0.1, overflow: 'linebreak' },
          headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 248, 242] },
          columnStyles: Object.fromEntries(COLS[k].map((c, i) => [i, c[2] === 'ha' ? { halign: 'right' } : c[2] === 'w' ? { cellWidth: k === 'ord' ? 70 : 60 } : {}])),
          didParseCell: d => { if (d.section === 'body' && d.cell.raw === 'Atrasada') { d.cell.styles.textColor = [176, 38, 30]; d.cell.styles.fontStyle = 'bold'; } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
      y += 4;
    }
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.setFont('helvetica', 'normal');
      doc.setFillColor(...LIMA); doc.rect(0, H - 3, W, 3, 'F');
      doc.text('InovaAgro Consultoria Agrícola · ' + repTitulo(), M, H - 6);
      doc.text('Página ' + i + ' de ' + n, W - M, H - 6, { align: 'right' });
    }
    doc.save(nomeArq('pdf'));
    toast('PDF gerado.');
  }
  async function gerarExcel() {
    await loadLib('xlsx');
    const X = window.XLSX, wb = X.utils.book_new(), D = repData();
    const base = x => ({ 'Produtor': x.p?.nome || '', 'Fazenda': x.f.nome, 'Código': x.f.codigo || '' });
    const conv = (c, v) => c[2] === 'd' ? (v ? fmtDate(v) : '') : c[2] === 'ha' ? (v == null ? null : Math.round(v * 100) / 100) : v;
    const resumo = D.fazendas.map(x => Object.assign(base(x), { 'Município': x.f.municipio || '', 'Talhões': x.tal.length, 'Área (ha)': Math.round(x.area * 100) / 100, 'Ordens pendentes': x.ords.filter(o => pendente(o._o)).length, 'Ordens atrasadas': x.ords.filter(o => atrasada(o._o)).length, 'Monitoramentos': x.mons.length }));
    const addSheet = (nome, rows) => { const ws = X.utils.json_to_sheet(rows.length ? rows : [{ 'Sem registros': '' }]); const keys = Object.keys(rows[0] || {}); ws['!cols'] = keys.map(k => ({ wch: Math.min(60, Math.max(k.length + 2, ...rows.slice(0, 200).map(r => String(r[k] ?? '').length + 1))) })); X.utils.book_append_sheet(wb, ws, nome); };
    addSheet('Resumo', resumo);
    for (const k of Object.keys(SEC_NOME).filter(k => R.secs[k])) {
      const rows = [];
      for (const x of D.fazendas) for (const r of (k === 'tal' ? x.tal : k === 'ord' ? x.ords : x.mons)) rows.push(Object.assign(base(x), Object.fromEntries(COLS[k].map(c => [c[1], conv(c, r[c[0]])]))));
      addSheet(SEC_NOME[k].replace('Ordens de trabalho', 'Ordens'), rows);
    }
    X.writeFile(wb, nomeArq('xlsx'));
    toast('Planilha gerada.');
  }

  // ---------- Equipe e permissões ----------
  const SQL_EQUIPE = /*SQL_EQUIPE*/'';
  const E = { lista: null, erro: null, carregando: false };
  async function carregarEquipe() {
    E.carregando = true;
    try { E.lista = await SB.membros(); E.erro = null; } catch (e) { E.erro = e; E.lista = null; }
    E.carregando = false; if (current === 'equipe') viewEquipe();
  }
  function viewEquipe(entering) {
    const root = $('#v-equipe');
    const head = `<div class="page-head"><div><h2>Equipe e permissões</h2><p>Quem pode entrar no sistema e o que cada pessoa pode fazer.</p></div></div>`;
    const roles = `<div class="roles">${Object.entries(PAPEIS).map(([k, p]) => `<div><b>${p.l}</b><span class="muted">${p.d}</span></div>`).join('')}</div>`;
    if (!SB.on) { root.innerHTML = `<div class="page">${head}${roles}<p class="note">O cadastro da equipe funciona na versão online do sistema, com login.</p></div>`; return; }
    if (entering && !E.carregando) { carregarEquipe(); }
    if (S.equipePendente || (E.erro && !E.lista)) {
      root.innerHTML = `<div class="page">${head}<div class="note"><b>Falta um passo para ativar esta tela.</b> É preciso atualizar o banco de dados uma única vez:
        <ol><li>Clique em <b>Copiar comando</b> aqui embaixo.</li><li>Abra o <a href="https://supabase.com/dashboard/project/xiffptiwszrtdfekqaxd/sql/new" target="_blank" rel="noopener">editor SQL do Supabase</a> (entre com sua conta).</li><li>Cole o comando na área de texto (Ctrl+V) e clique em <b>Run</b>.</li><li>Volte aqui e recarregue a página (F5).</li></ol>
        <p style="margin:8px 0 0"><button class="btn primary" data-act="copiar-sql">Copiar comando</button></p></div>${roles}</div>`;
      return;
    }
    if (!E.lista) { root.innerHTML = `<div class="page">${head}<p class="muted">Carregando equipe…</p></div>`; return; }
    const eu = (SB.user?.email || '').toLowerCase();
    root.innerHTML = `<div class="page">${head}${roles}
      <section class="card-box"><h3>Adicionar pessoa</h3>
        <form class="team-add" id="team-add"><label class="field"><span>E-mail</span><input type="email" name="email" required placeholder="nome@empresa.com"></label>
          <label class="field"><span>Nome</span><input type="text" name="nome" placeholder="Ex.: João (técnico)"></label>
          <label class="field"><span>Permissão</span><select name="papel">${Object.entries(PAPEIS).map(([k, p]) => `<option value="${k}" ${k === 'editor' ? 'selected' : ''}>${p.l}</option>`).join('')}</select></label>
          <button class="btn primary" type="submit">Adicionar</button></form>
        <p class="muted" style="margin:0;font-size:13px">Depois de adicionar, envie o endereço do sistema para a pessoa. No primeiro acesso ela digita este e-mail, escolhe uma senha e clica em <b>Primeiro acesso: criar minha senha</b>.</p></section>
      <div class="table-wrap"><table><thead><tr><th>E-mail</th><th>Nome</th><th>Permissão</th><th>Acesso</th><th></th></tr></thead><tbody>
        ${E.lista.map(m => { const self = m.email.toLowerCase() === eu; return `<tr data-email="${esc(m.email)}"><td>${esc(m.email)}${self ? ' <span class="pill info">você</span>' : ''}</td><td>${esc(m.nome || '—')}</td>
          <td><select data-m="papel" ${self ? 'disabled title="Você não pode mudar a própria permissão"' : ''}>${Object.entries(PAPEIS).map(([k, p]) => `<option value="${k}" ${m.papel === k ? 'selected' : ''}>${p.l}</option>`).join('')}${PAPEIS[m.papel] ? '' : `<option selected>${esc(m.papel)}</option>`}</select></td>
          <td>${m.ativo === false ? '<span class="pill">Bloqueado</span>' : '<span class="pill ok">Ativo</span>'}</td>
          <td>${self ? '' : `<button class="btn small" data-m="ativo">${m.ativo === false ? 'Liberar' : 'Bloquear'}</button> <button class="btn small danger" data-m="del">Remover</button>`}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    $('#team-add').addEventListener('submit', async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      const email = String(fd.get('email') || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Digite um e-mail válido.'); return; }
      if (E.lista.some(m => m.email.toLowerCase() === email)) { toast('Este e-mail já está na equipe.'); return; }
      try { await SB.addMembro({ email, nome: String(fd.get('nome') || '').trim() || null, papel: fd.get('papel') }); toast('Pessoa adicionada.'); carregarEquipe(); }
      catch (err) { toast('Não foi possível adicionar: ' + (err.message || err)); }
    });
  }
  async function acaoEquipe(e) {
    const tr = e.target.closest('tr[data-email]'); if (!tr) return;
    const email = tr.dataset.email, m = E.lista.find(x => x.email === email), el = e.target.closest('[data-m]'); if (!el || !m) return;
    try {
      if (el.dataset.m === 'papel' && e.type === 'change') { await SB.updMembro(email, { papel: el.value }); toast('Permissão alterada.'); }
      else if (el.dataset.m === 'ativo' && e.type === 'click') { await SB.updMembro(email, { ativo: m.ativo === false }); toast(m.ativo === false ? 'Acesso liberado.' : 'Acesso bloqueado.'); }
      else if (el.dataset.m === 'del' && e.type === 'click') { if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Confirmar'; return; } await SB.delMembro(email); toast('Removido da equipe.'); }
      else return;
    } catch (err) { toast(/ultimo|último/i.test(err.message || '') ? 'Precisa existir pelo menos um administrador ativo.' : 'Não foi possível alterar: ' + (err.message || err)); }
    carregarEquipe();
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
      case 'select': input = `<select id="${id}" name="${f.k}"${req}><option value="">Selecione…</option>${f.opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}${v && !f.opts.includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select>`; break;
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
      if (r.produtividade_estimada) rows.push(['Produtividade estimada', esc(r.produtividade_estimada.toLocaleString('pt-BR'))]);
      if (r.amostras) rows.push(['Amostras', esc(r.amostras)]);
      if (r.pontos_gps) rows.push(['Pontos GPS / fotos', esc(r.pontos_gps) + ' / ' + esc(r.fotos || 0)]);
      if (r.resultados) rows.push(['Resultados', r.resultados.map(x => `${esc(x.alvo)}: <b class="num">${esc(String(x.valor ?? '—').replace('.', ','))}</b> <span class="muted">${esc(x.medida || '')}</span>${x.nivel ? ` <span class="pill ${NIVEL_CLS[x.nivel] || ''}">${esc(x.nivel)}</span>` : ''}`).join('<br>')]);
    }
    if (kind === 'ordens' && r.produtos) {
      if (r.area_ha) rows.push(['Área da ordem', fmtHa(r.area_ha) + ' ha']);
      rows.push(['Produtos', '<div style="overflow-x:auto"><table style="font-size:12px"><thead><tr><th>Produto</th><th>Classe</th><th class="r">Dose</th><th class="r">Total</th><th class="r">Aplicado</th></tr></thead><tbody>' + r.produtos.map(p => `<tr><td>${esc(p.produto)}</td><td>${esc(p.classe || '')}</td><td class="r">${esc(String(p.dose ?? '—').replace('.', ','))} ${esc(p.unidade || '')}</td><td class="r">${esc(String(p.total ?? '—').replace('.', ','))} ${esc(p.unidade_total || '')}</td><td class="r">${p.aplicado_total != null ? esc(String(p.aplicado_total).replace('.', ',')) + ' ' + esc(p.unidade_total || '') : '—'}</td></tr>`).join('') + '</tbody></table></div>']);
    }
    if (!rows.length) return '';
    return `<div style="padding:12px 18px 0;display:grid;gap:8px"><div class="sec-title">Detalhes importados do SIMA</div><dl class="facts" style="font-size:13px">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></div>`;
  }
  function openForm(kind, rec, defaults) {
    const isNew = !rec;
    if (isNew && !podeEditar()) { toast('Seu acesso é só de consulta.'); return; }
    rec = Object.assign({}, defaults || {}, rec || {});
    const fields = FIELDS[kind];
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle">${isNew ? 'Novo ' : podeEditar() ? 'Editar ' : ''}${esc(NOME[kind])}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
      <form novalidate>${fields.map(f => fieldHtml(f, f.t === 'talhoes' ? talChecks(rec.fazenda_id, rec.talhao_ids) : rec[f.k])).join('')}</form>
      ${detalhes(kind, rec)}
      <footer>${isNew ? '' : '<button class="btn danger" data-del>Excluir</button>'}<div class="right"><button class="btn" data-close>${podeEditar() ? 'Cancelar' : 'Fechar'}</button><button class="btn primary" data-save>Salvar</button></div></footer></div>`;
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
    setTimeout(() => { const first = form.querySelector('input,select,textarea'); if (first && podeEditar()) first.focus(); }, 20);
  }

  // ---------- Exportar ----------
  async function exportar() {
    const all = { gerado_em: new Date().toISOString() };
    for (const k of KINDS) all[k] = S.data[k].map(r => { const c = Object.assign({}, r); delete c._prod; return c; });
    const json = JSON.stringify(all);
    const name = 'inovaagro-dados-' + today() + '.json';
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: name, data: json }); return; }
    } catch (e) { if (e && e.code) { toast('Download cancelado.'); return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
  }

  // ---------- Celular: localização, mapa offline e instalação ----------
  let gpsLayer = null, gpsWatch = null;
  function minhaLocalizacao() {
    if (!navigator.geolocation) { toast('Este aparelho não informa a localização.'); return; }
    if (gpsWatch != null) { navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; if (gpsLayer) map.removeLayer(gpsLayer); gpsLayer = null; toast('Localização desligada.'); return; }
    toast('Procurando sua localização…');
    let primeira = true;
    gpsWatch = navigator.geolocation.watchPosition(p => {
      const ll = [p.coords.latitude, p.coords.longitude];
      if (!gpsLayer) gpsLayer = L.layerGroup([L.circle(ll, { radius: p.coords.accuracy, color: '#3b8ee8', weight: 1, fillOpacity: 0.12 }), L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#3b8ee8', fillOpacity: 1 })]).addTo(map);
      else gpsLayer.eachLayer(l => { l.setLatLng(ll); if (l.setRadius && l instanceof L.Circle) l.setRadius(p.coords.accuracy); });
      if (primeira) { primeira = false; map.setView(ll, Math.max(map.getZoom(), 16)); const t = talhaoEm(ll); if (t) selectTalhao(t.id, false); }
    }, e => { toast(e.code === 1 ? 'Permita o acesso à localização nas configurações do celular.' : 'Não foi possível achar sua localização.'); gpsWatch = null; }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }
  function talhaoEm(ll) {
    const [y, x] = ll;
    const dentro = ring => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    for (const t of S.data.talhoes) {
      const g = t.geometry; if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      if (polys.some(pl => dentro(pl[0]))) return t;
    }
    return null;
  }
  // Baixa as imagens de satélite da área visível para usar sem internet (ficam no cache do app).
  async function baixarMapa() {
    if (!('caches' in window)) { toast('Este navegador não guarda mapas offline.'); return; }
    if (!navigator.onLine) { toast('Conecte na internet para baixar o mapa.'); return; }
    const b = map.getBounds(), z0 = Math.max(map.getZoom(), 10), urls = [];
    const tile = (lat, lng, z) => { const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n), r = lat * Math.PI / 180; return [x, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
    for (let z = z0; z <= Math.min(z0 + 4, 18); z++) {
      const [x1, y1] = tile(b.getNorth(), b.getWest(), z), [x2, y2] = tile(b.getSouth(), b.getEast(), z);
      if ((x2 - x1 + 1) * (y2 - y1 + 1) + urls.length > 3000) break;
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) urls.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`);
    }
    const cache = await caches.open('inovaagro-mapa');
    let feitos = 0, erros = 0;
    toast('Baixando mapa: 0 de ' + urls.length);
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(urls.slice(i, i + 8).map(async u => {
        try { if (!(await cache.match(u))) { const r = await fetch(u, { mode: 'no-cors' }); await cache.put(u, r); } } catch (e) { erros++; }
        feitos++;
      }));
      toast('Baixando mapa: ' + feitos + ' de ' + urls.length);
    }
    toast(erros ? 'Mapa baixado com ' + erros + ' falhas. Tente de novo para completar.' : 'Mapa desta área salvo para usar sem internet.');
  }
  let pedidoInstalar = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; const b = $('#btn-instalar'); if (b) b.hidden = false; });
  window.addEventListener('appinstalled', () => { const b = $('#btn-instalar'); if (b) b.hidden = true; toast('App instalado.'); });
  const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!instalado() && /iphone|ipad|ipod/i.test(navigator.userAgent)) setTimeout(() => { const b = $('#btn-instalar'); if (b) b.hidden = false; }, 0);
  function instalarApp() {
    if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; return; }
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-label="Instalar o app"><header><h2>Instalar o INOVAAGRO no celular</h2></header><div style="padding:4px 18px;line-height:1.55">
      <p><b>iPhone (Safari):</b> toque no botão <b>Compartilhar</b> (quadrado com seta para cima), depois em <b>Adicionar à Tela de Início</b> e em <b>Adicionar</b>.</p>
      <p><b>Android (Chrome):</b> toque nos <b>três pontinhos</b> no canto de cima e em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</p>
      <p class="muted">Depois de instalado, abra o app uma vez com internet para ele guardar os dados no celular.</p></div>
      <footer><div class="right"><button class="btn primary" type="button" data-fechar>Entendi</button></div></footer></div>`;
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-fechar]')) bg.remove(); });
    document.body.appendChild(bg);
  }

  // ---------- Diversos ----------
  let toastT;
  function toast(msg) { let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 2800); }

  document.addEventListener('click', e => {
    const n = e.target.closest('[data-new]'); if (n) { openForm(n.dataset.new, null, n.dataset.new === 'monitoramentos' ? { data: today() } : n.dataset.new === 'ordens' ? { status: 'Planejada' } : {}); return; }
    const ed = e.target.closest('[data-edit]'); if (ed) { const [k, id] = ed.dataset.edit.split(':'); openForm(k, get(k, id)); return; }
    const mf = e.target.closest('[data-map-faz]'); if (mf) { e.stopPropagation(); location.hash = 'mapa'; setTimeout(() => selectFazenda(mf.dataset.mapFaz, true), 60); return; }
    const rf = e.target.closest('[data-rep-faz]'); if (rf) { const f = get('fazendas', rf.dataset.repFaz); R.prod = key(f?.produtor_id || ''); R.faz = rf.dataset.repFaz; location.hash = 'relatorios'; return; }
    const bs = e.target.closest('[data-base]'); if (bs) { setBase(bs.dataset.base); return; }
    if (e.target.closest('#v-equipe')) acaoEquipe(e);
    if (e.target.closest('#nav-links a')) document.body.classList.remove('nav-open');
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
        case 'export': exportar(); break;
        case 'gps': minhaLocalizacao(); break;
        case 'baixar-mapa': baixarMapa(); break;
        case 'instalar': instalarApp(); break;
        case 'import': $('#imp-file').click(); break;
        case 'logout': sair(); break;
        case 'offline': abrirSemInternet().then(ok => ok ? boot() : toast('Ainda não há dados salvos neste aparelho. Entre uma vez com internet.')); break;
        case 'nav-open': document.body.classList.add('nav-open'); break;
        case 'nav-close': document.body.classList.remove('nav-open'); break;
        case 'copiar-sql': (navigator.clipboard ? navigator.clipboard.writeText(SQL_EQUIPE) : Promise.reject()).then(() => toast('Comando copiado. Agora cole no editor SQL do Supabase.'), () => { const ta = document.createElement('textarea'); ta.value = SQL_EQUIPE; ta.style.cssText = 'width:100%;height:240px'; act.after(ta); ta.select(); toast('Selecione o texto abaixo e copie com Ctrl+C.'); }); break;
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
  document.addEventListener('change', e => { if (e.target.closest('#v-equipe')) acaoEquipe(e); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('.modal-bg'); if (m) m.remove(); document.body.classList.remove('nav-open'); } });
  $('#q-mapa').addEventListener('input', renderTree);
  $('#color-by').addEventListener('change', e => { S.colorBy = e.target.value; styleAll(); drawLegend(); renderTree(); if (map) drawLayers(); });
  window.addEventListener('hashchange', route);

  $('#login-form').addEventListener('submit', doLogin);
  $('#imp-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importarArquivo(f); e.target.value = ''; });
  (async function start() {
    document.body.dataset.papel = S.papel;
    if (SB.on) {
      SB.init();
      const temCopia = !!(await Off.lerCopia());
      $('#login-offline').hidden = !temCopia;
      const user = await SB.session().catch(() => null);
      if (!user) {
        // Sem internet e com dados já salvos no aparelho: abre direto com a cópia local.
        if (temCopia && !navigator.onLine && await abrirSemInternet()) return boot();
        showLogin(temCopia && !navigator.onLine ? 'Sem internet.' : ''); return;
      }
      try { await SB.loadAll(); }
      catch (e) {
        if (Off.erroDeRede(e) && await abrirSemInternet()) return boot();
        showLogin('Não foi possível carregar os dados: ' + (e.message || e)); return;
      }
      const ok = await SB.cli.rpc('sou_membro');
      if (ok.error && Off.erroDeRede(ok.error)) { /* caiu a internet: segue com o que já carregou */ }
      else if (ok.error || !ok.data) { await Off.limpar().catch(() => {}); showLogin('O e-mail ' + SB.user.email + ' ainda não tem acesso ou está bloqueado. Peça ao administrador para liberar.'); $('#login-out').hidden = false; return; }
      try { const pp = await SB.meuPapel() || 'leitura'; setPapel(pp); try { localStorage.setItem('inovaagro.papel', pp); } catch (e) { } }
      catch (e) { if (Off.erroDeRede(e)) usarPapelSalvo(); else { S.equipePendente = true; setPapel('editor'); } } // sem internet / banco ainda sem a atualização de permissões
      if (!S.base.produtores.length) setTimeout(() => toast('Banco vazio. Use "Importar dados" para carregar o arquivo exportado.'), 800);
    }
    boot();
  })();
  async function boot() {
    await loadBase();
    S.version = 0;
    rebuild();
    renderNav();
    route();
    $('#loading').hidden = true;
    await Store.init();
    rebuild(); refresh();
    if (SB.on) sincronizar(false);
  }
})();
