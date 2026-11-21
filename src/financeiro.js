/* INOVAAGRO — Financeiro: veículos e despesas da equipe (combustível, manutenção, alimentação e outras).
   Funciona sem internet como o resto do app: lançamentos entram na fila do aparelho e os comprovantes (fotos)
   ficam guardados no celular até haver conexão. Usa os dados e o armazenamento do app (window.INOVA).
   Permissões (banco: supabase/04_financeiro.sql): o técnico lança e vê só as próprias despesas; o administrador vê tudo e aprova. */
window.Financeiro = (function () {
  'use strict';
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => I().esc(s);
  const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };
  const nn = v => v === '' || v == null || !isFinite(Number(v)) ? null : Number(v);
  const R$ = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const R0 = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const dec = (v, d = 1) => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const km = v => v == null ? '—' : Math.round(v).toLocaleString('pt-BR') + ' km';
  const fd = d => I().fmtDate(d);

  // ---------- Cadastros ----------
  const TIPOS = ['Combustível', 'Manutenção', 'Alimentação', 'Diária', 'Km rodado', 'Outra'];
  const REEMB_TIPOS = ['Diária', 'Km rodado']; // sempre reembolsados ao funcionário
  const TIPO_INFO = {
    'Combustível': { cls: 'fk1', ic: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M4 10h11"/><path d="M15 8h2a2 2 0 0 1 2 2v7a1.5 1.5 0 0 0 3 0V8l-3-3"/>', plural: 'Combustível' },
    'Manutenção': { cls: 'fk2', ic: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.5-.6-.6-2.5z"/>', plural: 'Manutenção' },
    'Alimentação': { cls: 'fk3', ic: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-4 2.5-4 6v4h4"/>', plural: 'Alimentação' },
    'Diária': { cls: 'fk5', ic: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>', plural: 'Diárias' },
    'Km rodado': { cls: 'fk6', ic: '<path d="M7 21 10 3M17 21 14 3"/><path d="M12 6v2M12 11v2M12 16v3"/>', plural: 'Km rodado (carro próprio)' },
    'Outra': { cls: 'fk4', ic: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M8 15h3"/>', plural: 'Outras' },
  };
  const COMBUST = ['Gasolina', 'Etanol', 'Diesel S10', 'Diesel S500', 'GNV'];
  const MANUT = ['Troca de óleo e filtros', 'Revisão', 'Pneus', 'Freios', 'Suspensão', 'Elétrica / bateria', 'Funilaria / pintura', 'Lavagem', 'Documentação / licenciamento', 'Seguro', 'Outro'];
  const REFEICAO = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche'];
  const OUTRAS = ['Pedágio', 'Estacionamento', 'Hospedagem', 'Material de campo', 'Telefone / internet', 'Outro'];
  const PAGTO = ['Cartão da empresa', 'Dinheiro / Pix próprio (reembolsar)', 'Faturado / boleto', 'Outro'];
  const STATUS = ['Pendente', 'Aprovada', 'Reembolsada', 'Recusada'];
  const REEMB_PAG = 'Dinheiro / Pix próprio (reembolsar)';
  const reembolsavel = d => REEMB_TIPOS.includes(d.tipo) || d.forma_pagamento === REEMB_PAG;
  const CFG = () => I().get('config', 'financeiro') || {};
  // O orçamento fica num registro separado, que só o administrador lê (ver supabase/04_financeiro.sql)
  const ORC = () => (I().get('config', 'financeiro_orcamento') || {}).orcamento || CFG().orcamento || {};
  // Rateio: uma despesa pode ser dividida em partes iguais entre as fazendas visitadas
  const fazendasDe = d => (Array.isArray(d.fazenda_ids) && d.fazenda_ids.length ? d.fazenda_ids : d.fazenda_id ? [d.fazenda_id] : []).map(String);
  const partes = d => { const f = fazendasDe(d); return f.map(id => [id, n(d.valor) / f.length]); };
  const ST_CLS = { 'Pendente': 'warn', 'Aprovada': 'info', 'Reembolsada': 'ok', 'Recusada': 'bad' };
  const ICV = '<path d="M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v5h-2.5M5.5 18H3v-5h18"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M9.3 17.5h5.4"/>';
  const svg = (p, c = '') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    foto: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
    voltar: '<path d="m15 5-7 7 7 7"/>', mais: '<path d="M12 5v14M5 12h14"/>',
    ok: '<path d="m5 12 4.5 4.5L19 7"/>',
  };

  // ---------- Estado e preferências ----------
  const LS = 'inovaagro.financeiro.v1';
  const F = { aba: 'resumo', per: 'mes', de: '', ate: '', veic: '', func: '', tipo: '', faz: '', status: '', lim: 80, sel: new Set(), ultVeic: '', cf: 'abertas', lucroAberto: '', ctr: '' };
  try { Object.assign(F, JSON.parse(localStorage.getItem(LS) || '{}'), { sel: new Set(), lim: 80 }); } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem(LS, JSON.stringify({ aba: F.aba, per: F.per, de: F.de, ate: F.ate, veic: F.veic, func: F.func, tipo: F.tipo, faz: F.faz, status: F.status, ultVeic: F.ultVeic })); } catch (e) { } };

  const S = () => I().S;
  const veiculos = () => (S().data.veiculos || []).slice().sort((a, b) => String(a.placa || '').localeCompare(String(b.placa || '')));
  const despesas = () => S().data.despesas || [];
  // Contratos dos clientes ficam na mesma tabela 'contas' (só o administrador lê), marcados com kind: 'contrato'
  const contas = () => (S().data.contas || []).filter(c => c.kind !== 'contrato');
  const contratos = () => (S().data.contas || []).filter(c => c.kind === 'contrato');
  const veic = id => I().get('veiculos', id);
  const meuEmail = () => (I().SB.user && I().SB.user.email) || 'local';
  const souAdmin = () => S().papel === 'admin';
  const online = () => I().Store.mode === 'supabase';

  // Nomes das pessoas da equipe (tabela membros), guardados para usar sem internet
  let membros = {};
  try { membros = JSON.parse(localStorage.getItem(LS + '.membros') || '{}'); } catch (e) { }
  let membrosOk = false;
  async function carregarMembros() {
    if (membrosOk || !online() || !navigator.onLine) return;
    membrosOk = true;
    try {
      const l = await I().SB.membros(); const m = {};
      for (const x of l) m[String(x.email).toLowerCase()] = { nome: x.nome || '', ativo: x.ativo !== false };
      membros = m; try { localStorage.setItem(LS + '.membros', JSON.stringify(m)); } catch (e) { }
      if (ativo()) render();
    } catch (e) { membrosOk = false; }
  }
  const nomePessoa = em => { if (!em) return '—'; const m = membros[String(em).toLowerCase()]; return (m && m.nome) || (S().nomes || {})[String(em).toLowerCase()] || (em === 'local' ? 'Este aparelho' : String(em).split('@')[0]); };

  // ---------- Período ----------
  const PER = { mes: 'Este mês', mes_ant: 'Mês passado', d30: 'Últimos 30 dias', d90: 'Últimos 90 dias', ano: 'Este ano', tudo: 'Tudo', custom: 'Escolher datas' };
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  function periodo() {
    const h = new Date(), y = h.getFullYear(), m = h.getMonth();
    switch (F.per) {
      case 'mes': return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
      case 'mes_ant': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
      case 'd30': return [iso(new Date(h - 29 * 864e5)), iso(h)];
      case 'd90': return [iso(new Date(h - 89 * 864e5)), iso(h)];
      case 'ano': return [y + '-01-01', y + '-12-31'];
      case 'custom': return [F.de || '', F.ate || ''];
      default: return ['', ''];
    }
  }
  const noPer = (d, p) => (!p[0] || (d || '') >= p[0]) && (!p[1] || (d || '') <= p[1]);
  function filtradas(semPeriodo) {
    const p = periodo();
    return despesas().filter(d => (semPeriodo || noPer(d.data, p)) && (!F.veic || String(d.veiculo_id) === F.veic) && (!F.func || String(d.usuario).toLowerCase() === F.func)
      && (!F.tipo || d.tipo === F.tipo) && (!F.faz || fazendasDe(d).includes(F.faz)) && (!F.status || (d.status || 'Pendente') === F.status));
  }

  // ---------- Cálculos por veículo ----------
  // Consumo pelo método do tanque cheio: km entre dois abastecimentos completos ÷ litros colocados depois do primeiro.
  function trechos(vid) {
    const ab = despesas().filter(d => d.tipo === 'Combustível' && String(d.veiculo_id) === String(vid) && n(d.km) > 0)
      .sort((a, b) => n(a.km) - n(b.km) || String(a.data).localeCompare(String(b.data)));
    const out = []; let ini = null, lit = 0;
    for (const a of ab) {
      const cheio = a.tanque_cheio !== 'Não';
      if (ini == null) { if (cheio) ini = n(a.km); continue; }
      lit += n(a.litros);
      if (cheio) { const k = n(a.km) - ini; if (k > 0 && lit > 0) out.push({ id: a.id, data: a.data, km: k, litros: lit, kml: k / lit }); ini = n(a.km); lit = 0; }
    }
    return out;
  }
  function kmAtual(v) {
    let m = n(v.km_inicial);
    for (const d of despesas()) if (String(d.veiculo_id) === String(v.id) && n(d.km) > m) m = n(d.km);
    return m || null;
  }
  function statsVeic(v, p, lista) {
    const ds = (lista || despesas()).filter(d => String(d.veiculo_id) === String(v.id) && noPer(d.data, p));
    const comb = ds.filter(d => d.tipo === 'Combustível'), man = ds.filter(d => d.tipo === 'Manutenção');
    const tr = trechos(v.id).filter(t => noPer(t.data, p));
    const trKm = tr.reduce((a, t) => a + t.km, 0), trL = tr.reduce((a, t) => a + t.litros, 0);
    // km rodados no período: do último odômetro antes do período até o maior odômetro dentro dele
    const kms = despesas().filter(d => String(d.veiculo_id) === String(v.id) && n(d.km) > 0);
    const dentro = kms.filter(d => noPer(d.data, p)).map(d => n(d.km));
    const antes = kms.filter(d => p[0] && (d.data || '') < p[0]).map(d => n(d.km));
    let rod = null;
    if (dentro.length) { const fim = Math.max(...dentro); const ini = antes.length ? Math.max(...antes) : Math.min(...dentro, n(v.km_inicial) && !p[0] ? n(v.km_inicial) : Infinity); rod = fim - ini > 0 ? fim - ini : null; }
    const vC = comb.reduce((a, d) => a + n(d.valor), 0), vM = man.reduce((a, d) => a + n(d.valor), 0), vO = ds.filter(d => d.tipo !== 'Combustível' && d.tipo !== 'Manutenção').reduce((a, d) => a + n(d.valor), 0);
    const lit = comb.reduce((a, d) => a + n(d.litros), 0);
    return { n: ds.length, comb: vC, man: vM, out: vO, tot: vC + vM + vO, litros: lit, kml: trL ? trKm / trL : null, rod, cpk: rod ? (vC + vM) / rod : null, precoL: lit ? vC / lit : null };
  }
  function revisao(v) {
    if (!n(v.revisao_km)) return null;
    const a = kmAtual(v); if (a == null) return null;
    const falta = n(v.revisao_km) - a;
    return { falta, cls: falta <= 0 ? 'bad' : falta <= 1000 ? 'warn' : 'ok', txt: falta <= 0 ? 'Revisão vencida há ' + km(-falta) : 'Revisão em ' + km(falta) };
  }

  // ---------- Comprovantes (fotos) guardados no aparelho até enviar ----------
  const DBN = 'inovaagro-financeiro';
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, falha) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore('comprovantes'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
    return dbP;
  }
  async function idb(modo, fn) {
    const d = await db();
    return new Promise((ok, falha) => { const t = d.transaction('comprovantes', modo), s = t.objectStore('comprovantes'); let res; const q = fn(s); if (q) q.onsuccess = () => { res = q.result; }; t.oncomplete = () => ok(res); t.onerror = t.onabort = () => falha(t.error); });
  }
  const guardar = (id, obj) => idb('readwrite', s => s.put(obj, id));
  const lerLocal = id => idb('readonly', s => s.get(id)).catch(() => null);
  const pendentes = () => idb('readonly', s => s.getAll()).then(l => l || []).catch(() => []);
  const tirar = id => idb('readwrite', s => s.delete(id)).catch(() => {});

  // Reduz a foto (lado maior 1600 px, JPEG) para enviar rápido pelo celular
  async function reduzir(file) {
    if (!/^image\//.test(file.type) || /gif|svg/.test(file.type)) return { blob: file, mime: file.type || 'application/octet-stream', nome: file.name || 'comprovante' };
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.78));
      return blob ? { blob, mime: 'image/jpeg', nome: 'comprovante.jpg' } : { blob: file, mime: file.type, nome: file.name };
    } catch (e) { return { blob: file, mime: file.type, nome: file.name || 'comprovante' }; }
  }
  const blobUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(b); });

  const Env = { rodando: false, semBucket: false, n: 0 };
  async function contarPend() { Env.n = (await pendentes()).length; }
  async function enviarComprovantes() {
    const SB = I().SB;
    if (Env.rodando || !online() || !navigator.onLine || !SB.cli || !SB.cli.storage) return;
    Env.rodando = true;
    try {
      for (const it of await pendentes()) {
        const ext = it.mime === 'application/pdf' ? 'pdf' : /png/.test(it.mime) ? 'png' : 'jpg';
        const caminho = `${String(it.em || '').slice(0, 4) || new Date().getFullYear()}/${it.id}.${ext}`;
        const r = await SB.cli.storage.from('comprovantes').upload(caminho, it.blob, { contentType: it.mime });
        if (r.error && !/exists|duplicate/i.test(r.error.message || '')) {
          if (/bucket/i.test(r.error.message || '')) { Env.semBucket = true; break; }
          if (I().Off.erroDeRede(r.error)) break;
          console.warn('comprovante', r.error); continue;
        }
        Env.semBucket = false;
        const d = I().get('despesas', it.desp);
        if (d && d.comprovante && d.comprovante.pend === it.id) await I().Store.save('despesas', Object.assign({}, d, { comprovante: { path: caminho, mime: it.mime, nome: it.nome || '' } }));
        await tirar(it.id);
      }
    } catch (e) { console.warn(e); } finally { Env.rodando = false; await contarPend(); if (ativo()) render(); }
  }
  async function verComprovante(d) {
    const c = d && d.comprovante; if (!c) return;
    let url = c.url || null;
    if (!url && c.pend) { const it = await lerLocal(c.pend); if (it) url = URL.createObjectURL(it.blob); }
    if (!url && c.path) {
      if (!navigator.onLine) { I().toast('Sem internet: o comprovante abre quando a conexão voltar.'); return; }
      const r = await I().SB.cli.storage.from('comprovantes').createSignedUrl(c.path, 3600);
      if (r.error) { I().toast('Não foi possível abrir o comprovante.'); return; }
      url = r.data.signedUrl;
    }
    if (!url) { I().toast('Comprovante não encontrado neste aparelho.'); return; }
    if ((c.mime || '').includes('pdf')) { window.open(url, '_blank', 'noopener'); return; }
    const bg = document.createElement('div'); bg.className = 'modal-bg fin-foto';
    bg.innerHTML = `<figure><img src="${esc(url)}" alt="Comprovante"><figcaption><a class="btn small" href="${esc(url)}" target="_blank" rel="noopener" download="comprovante">Abrir em tamanho real</a><button class="btn small" data-close>Fechar</button></figcaption></figure>`;
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) bg.remove(); });
    document.body.appendChild(bg);
  }

  // ---------- Leitura do comprovante pela foto (OCR no próprio aparelho, sem serviço pago) ----------
  // Usa o Tesseract.js (código aberto). Na primeira vez baixa o leitor e o dicionário em português (cerca de 10 MB); depois fica guardado no navegador.
  const OCR = {
    worker: null,
    async ler(blob, progresso) {
      if (!window.Tesseract) await new Promise((ok, falha) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
      if (!this.worker) this.worker = window.Tesseract.createWorker('por', 1, { logger: m => { if (m.status === 'recognizing text' && progresso) progresso(m.progress || 0); } });
      const w = await this.worker;
      const r = await w.recognize(blob);
      return OCR.interpretar(r.data.text || '');
    },
    // Transforma o texto do cupom/nota em campos
    interpretar(txt) {
      const sem = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
      const linhas = sem(txt).split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const dinheiro = l => [...l.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\d)/g)].map(m => Number(m[1].replace(/\./g, '').replace(',', '.')));
      const out = {};
      // valor total: linha de total (não subtotal, não "total de itens", não tributos)
      const ruim = /SUBTOTAL|SUB-TOTAL|ITENS|TRIBUT|IMPOSTO|DESCONTO|ACRESC|TROCO|LEI 12|APROX/;
      const pref = [/VALOR TOTAL|TOTAL A PAGAR|VALOR A PAGAR|TOTAL GERAL/, /^TOTAL\b|\bTOTAL R\$|\bTOTAL:/, /VALOR PAGO|CARTAO|CREDITO|DEBITO|PIX/];
      for (const re of pref) {
        for (let i = 0; i < linhas.length && out.valor == null; i++) {
          const l = linhas[i]; if (!re.test(l) || ruim.test(l)) continue;
          const v = dinheiro(l).filter(x => x > 0); if (v.length) out.valor = v[v.length - 1];
          else if (linhas[i + 1]) { const v2 = dinheiro(linhas[i + 1]); if (v2.length) out.valor = v2[v2.length - 1]; }
        }
        if (out.valor != null) break;
      }
      if (out.valor == null) { const vs = linhas.filter(l => !/TROCO|DINHEIRO|CNPJ|CPF/.test(l)).flatMap(dinheiro).filter(x => x < 100000); if (vs.length) out.valor = Math.max(...vs); }
      // data (dd/mm/aaaa) plausível
      for (const l of linhas) {
        const m = l.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4}|\d{2})\b/); if (!m) continue;
        let [, dd, mm, aa] = m; if (aa.length === 2) aa = '20' + aa;
        if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31 && +aa >= 2015 && +aa <= 2099) { out.data = `${aa}-${mm}-${dd}`; break; }
      }
      // combustível: linha do produto com quantidade (3 casas) e preço unitário
      const COMB = [[/DIESEL\s*S?-?\s*10\b|S10/, 'Diesel S10'], [/DIESEL\s*S?-?\s*500|S500/, 'Diesel S500'], [/DIESEL/, 'Diesel S10'], [/ETANOL|ALCOOL/, 'Etanol'], [/GASOLINA|\bGAS\b/, 'Gasolina'], [/\bGNV\b/, 'GNV']];
      for (const l of linhas) {
        const c = COMB.find(([re]) => re.test(l)); if (!c || /TOTAL|TRIBUT/.test(l)) continue;
        out.combustivel = c[1];
        const nums = [...l.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2,3}|\d+,\d{2,3})(?!\d)/g)].map(m => ({ s: m[1], v: Number(m[1].replace(/\./g, '').replace(',', '.')) }));
        const q = nums.find(x => /,\d{3}$/.test(x.s) && x.v > 1 && x.v < 2000) || nums.find(x => x.v > 8 && x.v < 2000);
        if (q) { out.litros = q.v; const pr = nums.find(x => x !== q && x.v >= 2 && x.v <= 15); if (pr) out.preco_litro = pr.v; }
        break;
      }
      if (out.litros == null) { const m = linhas.join(' ').match(/(\d+,\d{2,3})\s*(?:L|LT|LTS|LITROS)\b/); if (m) out.litros = Number(m[1].replace(',', '.')); }
      if (out.litros && !out.preco_litro && out.valor) out.preco_litro = Math.round(out.valor / out.litros * 1000) / 1000;
      const km = linhas.join(' ').match(/\b(?:KM|HODOMETRO|ODOMETRO)[:.\s]*(\d{1,3}(?:\.\d{3})+|\d{3,7})\b/); if (km) out.km = Number(km[1].replace(/\./g, ''));
      // nome do estabelecimento: primeira linha com texto que não seja cabeçalho fiscal
      const nome = linhas.slice(0, 6).find(l => /[A-Z]{3,}/.test(l) && !/CNPJ|CPF|INSCR|\bIE\b|DOCUMENTO|NOTA FISCAL|CUPOM|DANFE|NFC|CONSUMIDOR|EXTRATO|^RUA|^AV|^ROD|ENDERECO|TEL|FONE|SAT\b/.test(l) && l.replace(/[^A-Z]/g, '').length >= 4);
      if (nome) out.nome = nome.replace(/\s*(LTDA|EIRELI|ME|EPP|S\/?A)\.?$/g, '').toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase()).slice(0, 60);
      return out;
    },
  };

  // ---------- Tela ----------
  let root = null;
  const ativo = () => root && document.body.contains(root) && !root.hidden;
  function view(first) {
    root = $('#v-financeiro'); if (!root) return;
    root.classList.add('fin');
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.addEventListener('click', clique);
      root.addEventListener('change', mudou);
      root.addEventListener('mousemove', dica); root.addEventListener('mouseleave', () => dica(null));
    }
    if (first) { carregarMembros(); contarPend().then(() => { if (Env.n) enviarComprovantes(); }); }
    render();
  }

  function render() {
    if (!root) return;
    const p = periodo(), adm = souAdmin(), ed = I().podeEditar();
    // Valores e relatórios são só do administrador; o técnico só lança e acompanha os próprios lançamentos
    if (!adm && !['lanc', 'veic'].includes(F.aba)) F.aba = 'lanc';
    if (adm) gerarCobrancas();
    const lista = filtradas();
    const pessoas = [...new Set(despesas().map(d => String(d.usuario || '').toLowerCase()).filter(Boolean))].sort((a, b) => nomePessoa(a).localeCompare(nomePessoa(b), 'pt-BR'));
    const fazIds = [...new Set(despesas().flatMap(fazendasDe))];
    const fazendas = fazIds.map(id => I().get('fazendas', id)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const pend = adm ? despesas().filter(d => (d.status || 'Pendente') === 'Pendente') : [];
    const aviso = S().faltaFin ? `<div class="note"><b>Falta um passo para salvar na nuvem.</b> O administrador precisa rodar uma vez o arquivo <code>supabase/04_financeiro.sql</code> no editor SQL do Supabase. Até lá, o que for lançado fica guardado neste aparelho.</div>` : '';
    const avisoFoto = Env.semBucket ? '<div class="note">As fotos dos comprovantes estão guardadas no aparelho. Para enviá-las, o administrador precisa rodar o arquivo <code>supabase/04_financeiro.sql</code> no Supabase.</div>' : '';
    const titulo = adm ? 'Despesas da equipe e custos dos veículos.' : 'Lance aqui suas despesas de campo. Os valores e relatórios ficam com o administrador.';
    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h2>Despesas e veículos</h2><p>${titulo}</p></div>
        <div class="head-acts">${adm ? `<button class="btn" data-f="ajustes">${I().icon('configuracao')} Ajustes</button>` : ''}${ed ? `<button class="btn primary" data-f="novo">${svg(IC.mais)}Lançar despesa</button>` : ''}
          ${adm ? `<button class="btn" data-f="xlsx">${I().icon('xls')} Excel</button><button class="btn" data-f="pdf">${I().icon('pdf')} PDF</button>` : ''}</div></div>
      ${aviso}${avisoFoto}${htmlAvisos()}
      ${ed && !['contas', 'lucro', 'contratos'].includes(F.aba) ? `<div class="fin-quick" role="group" aria-label="Lançamento rápido">${TIPOS.map(t => `<button data-f="novo" data-tipo="${t}"><i class="fin-qi ${TIPO_INFO[t].cls}">${svg(TIPO_INFO[t].ic)}</i><span>${t === 'Outra' ? 'Outra despesa' : t}</span></button>`).join('')}</div>` : ''}
      ${F.aba === 'contratos' ? '' : `<div class="fin-filtros">
        <select data-flt="per" aria-label="Período">${Object.entries(PER).map(([k, l]) => `<option value="${k}" ${F.per === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${F.per === 'custom' ? `<input type="date" data-flt="de" value="${esc(F.de)}" aria-label="De"><input type="date" data-flt="ate" value="${esc(F.ate)}" aria-label="Até">` : ''}
        ${['contas', 'lucro', 'contratos'].includes(F.aba) ? '' : `<select data-flt="veic" aria-label="Veículo"><option value="">Todos os veículos</option>${veiculos().map(v => `<option value="${esc(v.id)}" ${String(v.id) === F.veic ? 'selected' : ''}>${esc(v.placa)} · ${esc(v.modelo || '')}</option>`).join('')}</select>
        ${adm ? `<select data-flt="func" aria-label="Funcionário"><option value="">Toda a equipe</option>${pessoas.map(e => `<option value="${esc(e)}" ${e === F.func ? 'selected' : ''}>${esc(nomePessoa(e))}</option>`).join('')}</select>` : ''}
        <select data-flt="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${TIPOS.map(t => `<option value="${t}" ${t === F.tipo ? 'selected' : ''}>${TIPO_INFO[t].plural}</option>`).join('')}</select>
        ${fazendas.length ? `<select data-flt="faz" aria-label="Fazenda ou cliente"><option value="">Todas as fazendas</option>${fazendas.map(f => `<option value="${esc(f.id)}" ${String(f.id) === F.faz ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select>` : ''}
        <select data-flt="status" aria-label="Situação"><option value="">Qualquer situação</option>${STATUS.map(s => `<option ${s === F.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        ${F.veic || F.func || F.tipo || F.faz || F.status ? '<button class="lnk" data-f="limpar">Limpar filtros</button>' : ''}`}
      </div>`}
      ${pend.length && !['contas', 'lucro', 'contratos'].includes(F.aba) ? `<div class="fin-pend"><span><b>${I().fmtInt(pend.length)} despesa${pend.length > 1 ? 's' : ''} esperando aprovação</b> · ${R$(pend.reduce((a, d) => a + n(d.valor), 0))}</span><button class="btn small" data-f="ver-pend">Revisar</button></div>` : ''}
      <div class="tabs" role="tablist">${(adm ? [['resumo', 'Resumo'], ['lanc', 'Lançamentos'], ['veic', 'Veículos'], ['reemb', 'Reembolsos'], ['contratos', 'Contratos'], ['contas', 'Contas a pagar e receber'], ['lucro', 'Lucro por cliente']] : [['lanc', 'Meus lançamentos'], ['veic', 'Veículos']]).map(([k, l]) => `<button role="tab" data-f="aba" data-aba="${k}" aria-selected="${F.aba === k}">${l}${k === 'lanc' ? ` <span class="ct num">${I().fmtInt(lista.length)}</span>` : k === 'veic' ? ` <span class="ct num">${I().fmtInt(veiculos().length)}</span>` : ''}</button>`).join('')}</div>
      <div class="fin-body">${F.aba === 'lanc' ? htmlLanc(lista) : F.aba === 'veic' ? htmlVeic(p, lista) : !adm ? '' : F.aba === 'reemb' ? htmlReemb(p) : F.aba === 'contratos' ? htmlContratos() : F.aba === 'contas' && adm ? htmlContas(p) : F.aba === 'lucro' && adm ? htmlLucro(p) : htmlResumo(p, lista)}</div>
      <div class="fin-tip" hidden></div></div>`;
  }

  // ---------- Resumo: números e gráficos ----------
  function somaTipo(l) { const o = { tot: 0 }; for (const t of TIPOS) o[t] = 0; for (const d of l) { const t = TIPOS.includes(d.tipo) ? d.tipo : 'Outra'; o[t] += n(d.valor); o.tot += n(d.valor); } return o; }
  function legenda() { return `<div class="fin-leg">${TIPOS.map(t => `<span><i class="sw ${TIPO_INFO[t].cls}"></i>${TIPO_INFO[t].plural}</span>`).join('')}</div>`; }
  function tipHtml(titulo, o) { return esc(`<b>${esc(titulo)}</b>` + TIPOS.filter(t => o[t]).map(t => `<span><i class="sw ${TIPO_INFO[t].cls}"></i>${TIPO_INFO[t].plural}<em>${R$(o[t])}</em></span>`).join('') + `<span class="t">Total<em>${R$(o.tot)}</em></span>`); }
  function pilha(o, max) { return TIPOS.filter(t => o[t] > 0).map(t => `<i class="${TIPO_INFO[t].cls}" style="flex-basis:${(o[t] / max * 100).toFixed(2)}%"></i>`).join(''); }

  function htmlResumo(p, lista) {
    const o = somaTipo(lista), comb = lista.filter(d => d.tipo === 'Combustível');
    const lit = comb.reduce((a, d) => a + n(d.litros), 0);
    const vs = (F.veic ? veiculos().filter(v => String(v.id) === F.veic) : veiculos()).map(v => ({ v, s: statsVeic(v, p, lista) }));
    let rod = 0, cv = 0, trK = 0, trL = 0;
    for (const x of vs) { if (x.s.rod) { rod += x.s.rod; cv += x.s.comb + x.s.man; } }
    for (const x of vs) for (const t of trechos(x.v.id).filter(t => noPer(t.data, p))) { trK += t.km; trL += t.litros; }
    const tiles = [
      ['Total no período', R$(o.tot), `${I().fmtInt(lista.length)} lançamento${lista.length === 1 ? '' : 's'}${o['Outra'] ? ' · outras ' + R0(o['Outra']) : ''}`, ''],
      ['Combustível', R$(o['Combustível']), lit ? `${dec(lit, 0)} L · média ${R$(o['Combustível'] / lit)}/L` : 'sem abastecimentos', 'fk1'],
      ['Manutenção', R$(o['Manutenção']), `${I().fmtInt(lista.filter(d => d.tipo === 'Manutenção').length)} serviço(s)`, 'fk2'],
      ['Alimentação', R$(o['Alimentação']), `${I().fmtInt(lista.filter(d => d.tipo === 'Alimentação').length)} refeição(ões)`, 'fk3'],
      ['Custo por km', rod ? R$(cv / rod) : '—', rod ? `${km(rod)} rodados (combustível + manutenção)` : 'informe o km nos lançamentos', ''],
      ['Consumo médio', trL ? dec(trK / trL) + ' km/l' : '—', trL ? 'entre tanques cheios' : 'precisa de 2 abastecimentos com tanque cheio', ''],
    ];
    // Últimos 12 meses (até o fim do período escolhido), com os mesmos filtros exceto o período
    const fim = p[1] ? new Date(p[1] + 'T12:00:00') : new Date();
    const meses = []; for (let i = 11; i >= 0; i--) { const d = new Date(fim.getFullYear(), fim.getMonth() - i, 1); meses.push(iso(d).slice(0, 7)); }
    const todos = filtradas(true), porMes = meses.map(m => ({ m, o: somaTipo(todos.filter(d => String(d.data || '').slice(0, 7) === m)) }));
    const maxM = Math.max(1, ...porMes.map(x => x.o.tot)), topo = escala(maxM);
    const nomeMes = m => new Date(m + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const colunas = `<div class="fin-cols" role="img" aria-label="Despesas por mês nos últimos 12 meses">
      <div class="fin-grid">${[1, 0.5, 0].map(f => `<span style="bottom:${f * 100}%"><em>${R0(topo * f)}</em></span>`).join('')}</div>
      ${porMes.map(x => `<div class="fin-col${noPer(x.m + '-15', [p[0] ? p[0].slice(0, 7) + '-01' : '', p[1] || '']) && F.per !== 'tudo' ? ' sel' : ''}" data-tip="${tipHtml(new Date(x.m + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), x.o)}"><div class="st" style="height:${(x.o.tot / topo * 100).toFixed(2)}%">${pilha(x.o, x.o.tot || 1)}</div><span class="lb">${nomeMes(x.m)}</span></div>`).join('')}</div>`;
    const barras = (itens, vazio) => {
      const mx = Math.max(1, ...itens.map(x => x.o.tot));
      return itens.length ? `<div class="fin-bars">${itens.map(x => `<div class="fin-bar${x.go ? ' click' : ''}" ${x.go ? `data-f="${x.go[0]}" data-id="${esc(x.go[1])}"` : ''} data-tip="${tipHtml(x.nome, x.o)}"><span class="nm">${esc(x.nome)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span><span class="tr"><span class="st" style="width:${(x.o.tot / mx * 100).toFixed(2)}%">${pilha(x.o, x.o.tot || 1)}</span></span><span class="v num">${R0(x.o.tot)}</span></div>`).join('')}</div>` : `<p class="empty">${vazio}</p>`;
    };
    const porVeic = vs.filter(x => x.s.n).map(x => ({ nome: x.v.placa, sub: [x.v.modelo, x.s.kml ? dec(x.s.kml) + ' km/l' : '', x.s.cpk ? R$(x.s.cpk) + '/km' : ''].filter(Boolean).join(' · '), o: somaTipo(lista.filter(d => String(d.veiculo_id) === String(x.v.id))), go: ['veic-ver', x.v.id] })).sort((a, b) => b.o.tot - a.o.tot);
    const agrupa = (f, nome) => { const m = new Map(); for (const d of lista) { const k = f(d); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(d); } return [...m.entries()].map(([k, l]) => ({ k, nome: nome(k), o: somaTipo(l) })).sort((a, b) => b.o.tot - a.o.tot); };
    const porPessoa = agrupa(d => String(d.usuario || '').toLowerCase(), nomePessoa).map(x => Object.assign(x, { go: ['func-ver', x.k] }));
    const mf = new Map(); for (const d of lista) for (const [fid, v] of partes(d)) { if (!mf.has(fid)) mf.set(fid, []); mf.get(fid).push(Object.assign({}, d, { valor: v })); }
    const porFaz = [...mf.entries()].map(([k, l]) => ({ k, nome: (I().get('fazendas', k) || {}).nome || 'Fazenda removida', o: somaTipo(l) })).sort((a, b) => b.o.tot - a.o.tot).slice(0, 12);
    const semFaz = lista.filter(d => !fazendasDe(d).length).reduce((a, d) => a + n(d.valor), 0);
    return `${htmlOrcamento()}<div class="tiles fin-tiles">${tiles.map(([l, v, s, c]) => `<div class="tile ${c ? 'fin-t ' + c : ''}"><span class="lbl">${l}</span><span class="val num">${v}</span><span class="sub">${s}</span></div>`).join('')}</div>
      <section class="card-box fin-chart"><h3>Despesas por mês <small>últimos 12 meses${F.per !== 'tudo' ? ' · período escolhido em destaque' : ''}</small></h3>${legenda()}${colunas}</section>
      <div class="fin-2">
        <section class="card-box"><h3>Por veículo <small>consumo e custo por km no período</small></h3>${barras(porVeic, veiculos().length ? 'Nenhuma despesa de veículo no período.' : 'Nenhum veículo cadastrado. Cadastre na aba Veículos.')}</section>
        ${souAdmin() || porPessoa.length > 1 ? `<section class="card-box"><h3>Por funcionário <small>${I().fmtInt(porPessoa.length)} pessoa(s)</small></h3>${barras(porPessoa, 'Nenhuma despesa no período.')}</section>` : ''}
        <section class="card-box"><h3>Por fazenda / cliente <small>${semFaz ? R0(semFaz) + ' sem fazenda informada' : 'despesas ligadas a visitas'}</small></h3>${barras(porFaz, 'Nenhuma despesa ligada a fazenda no período. Ao lançar, escolha a fazenda visitada.')}</section>
      </div>`;
  }
  function escala(v) { const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }

  // ---------- Lançamentos ----------
  function descr(d) {
    if (d.tipo === 'Combustível') return [d.litros ? dec(n(d.litros), 2) + ' L' + (d.combustivel ? ' de ' + (/^(Gasolina|Etanol)$/.test(d.combustivel) ? d.combustivel.toLowerCase() : d.combustivel) : '') : d.combustivel, d.posto].filter(Boolean).join(' · ');
    if (d.tipo === 'Manutenção') return [d.manutencao, d.oficina].filter(Boolean).join(' · ');
    if (d.tipo === 'Alimentação') return [d.refeicao, n(d.pessoas) > 1 ? d.pessoas + ' pessoas' : '', d.local].filter(Boolean).join(' · ');
    if (d.tipo === 'Diária') return [n(d.dias) ? dec(n(d.dias), n(d.dias) % 1 ? 1 : 0) + (n(d.dias) === 1 ? ' diária' : ' diárias') : '', d.descricao].filter(Boolean).join(' · ');
    if (d.tipo === 'Km rodado') return [n(d.km_rodado) ? Math.round(n(d.km_rodado)).toLocaleString('pt-BR') + ' km' + (n(d.valor_km) ? ' × ' + R$(d.valor_km) : '') : '', d.descricao].filter(Boolean).join(' · ');
    return [d.categoria, d.descricao].filter(Boolean).join(' · ');
  }
  function htmlLanc(lista) {
    const adm = souAdmin(), kmlPor = new Map();
    for (const v of veiculos()) for (const t of trechos(v.id)) kmlPor.set(String(t.id), t.kml);
    const ord = lista.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    const mostra = ord.slice(0, F.lim), tot = lista.reduce((a, d) => a + n(d.valor), 0);
    const sel = [...F.sel].filter(id => I().get('despesas', id));
    return `${adm && sel.length ? `<div class="fin-bulk"><b>${sel.length} selecionada(s)</b><button class="btn small" data-f="bulk" data-st="Aprovada">${svg(IC.ok)}Aprovar</button><button class="btn small" data-f="bulk" data-st="Reembolsada">Marcar reembolsada</button><button class="btn small" data-f="bulk" data-st="Recusada">Recusar</button><button class="lnk" data-f="sel-limpar">Limpar seleção</button></div>` : ''}
      <div class="table-wrap fin-tab"><table><thead><tr>${adm ? `<th class="ck"><input type="checkbox" data-f="sel-tudo" aria-label="Selecionar todas" ${mostra.length && mostra.every(d => F.sel.has(String(d.id))) ? 'checked' : ''}></th>` : ''}<th>Data</th><th>Tipo</th><th>Detalhe</th><th>Veículo</th><th>Fazenda</th>${adm ? '<th>Funcionário</th>' : ''}<th>Situação</th>${adm ? '<th class="r">Valor</th>' : ''}<th aria-label="Comprovante"></th></tr></thead>
      <tbody>${mostra.map(d => {
        const v = veic(d.veiculo_id), fzs = fazendasDe(d), f = I().get('fazendas', fzs[0]), ti = TIPO_INFO[d.tipo] || TIPO_INFO['Outra'], st = d.status || 'Pendente', k = kmlPor.get(String(d.id));
        return `<tr class="click" data-f="abrir" data-id="${esc(d.id)}">${adm ? `<td class="ck"><input type="checkbox" data-f="sel" data-id="${esc(d.id)}" ${F.sel.has(String(d.id)) ? 'checked' : ''} aria-label="Selecionar"></td>` : ''}
          <td class="dt">${fd(d.data)}</td><td class="tp"><span class="fin-tipo"><i class="sw ${ti.cls}"></i>${esc(d.tipo || 'Outra')}</span></td>
          <td class="ds">${esc(descr(d)) || '<span class="muted">—</span>'}${d.km ? `<small>${km(n(d.km))}${k ? ' · ' + dec(k) + ' km/l' : ''}</small>` : ''}</td>
          <td class="vc">${v ? `<span class="placa">${esc(v.placa)}</span>` : '<span class="muted">—</span>'}</td><td class="fz">${f ? esc(f.nome) + (fzs.length > 1 ? ` <small class="muted" title="Rateada entre ${fzs.length} fazendas">+${fzs.length - 1}</small>` : '') : '<span class="muted">—</span>'}</td>
          ${adm ? `<td class="fu">${esc(nomePessoa(d.usuario))}</td>` : ''}<td class="sx"><span class="pill ${ST_CLS[st] || ''}">${esc(st)}</span></td>
          ${adm ? `<td class="r vl num"><b>${R$(d.valor)}</b></td>` : ''}<td class="cp">${d.comprovante ? `<button class="icon-btn fin-clip" data-f="foto" data-id="${esc(d.id)}" aria-label="Ver comprovante" title="${d.comprovante.pend ? 'Comprovante guardado no aparelho (a enviar)' : 'Ver comprovante'}">${svg(IC.clip)}${d.comprovante.pend ? '<i class="dotp"></i>' : ''}</button>` : ''}</td></tr>`;
      }).join('') || `<tr><td colspan="${adm ? 10 : 7}" class="empty">Nenhuma despesa neste filtro.</td></tr>`}</tbody>
      ${lista.length && adm ? `<tfoot><tr><td colspan="${adm ? 8 : 6}">Total de ${I().fmtInt(lista.length)} lançamento(s)</td><td class="r num"><b>${R$(tot)}</b></td><td></td></tr></tfoot>` : ''}</table></div>
      ${ord.length > mostra.length ? `<p style="text-align:center"><button class="btn small" data-f="mais">Mostrar mais (${I().fmtInt(ord.length - mostra.length)})</button></p>` : ''}`;
  }

  // ---------- Veículos ----------
  function htmlVeic(p, lista) {
    const vs = veiculos(), ed = I().podeEditar(), adm = souAdmin();
    return `<div class="fin-vh">${ed ? `<button class="btn" data-f="veic-novo">${svg(IC.mais)}Novo veículo</button>` : ''}<span class="muted">${adm ? 'Valores do período escolhido. O consumo usa os abastecimentos com tanque cheio.' : 'Escolha o veículo para lançar abastecimento ou manutenção.'}</span></div>
      <div class="fin-veics">${vs.map(v => {
        const s = statsVeic(v, p, lista), rv = revisao(v), ka = kmAtual(v);
        return `<article class="fin-vc${v.ativo === 'Não' ? ' off' : ''}">
          <header><span class="placa big">${esc(v.placa)}</span><div><b>${esc([v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo')}</b><small>${esc([v.ano, v.combustivel, v.responsavel ? nomePessoa(v.responsavel) : ''].filter(Boolean).join(' · '))}</small></div>${ed ? `<button class="lnk" data-f="veic-edit" data-id="${esc(v.id)}">Editar</button>` : ''}</header>
          ${!adm ? `<dl><div><dt>Hodômetro</dt><dd class="num">${km(ka)}</dd></div></dl>` : `<dl><div><dt>Hodômetro</dt><dd class="num">${km(ka)}</dd></div><div><dt>Consumo</dt><dd class="num">${s.kml ? dec(s.kml) + ' km/l' : '—'}</dd></div><div><dt>Custo por km</dt><dd class="num">${s.cpk ? R$(s.cpk) : '—'}</dd></div>
            <div><dt>Rodou</dt><dd class="num">${km(s.rod)}</dd></div><div><dt>Combustível</dt><dd class="num">${R0(s.comb)}</dd></div><div><dt>Manutenção</dt><dd class="num">${R0(s.man)}</dd></div></dl>`}
          <footer>${rv ? `<span class="pill ${rv.cls}">${esc(rv.txt)}</span>` : v.ativo === 'Não' ? '<span class="pill">Inativo</span>' : '<span></span>'}
            ${ed ? `<span class="fin-vb"><button class="btn small" data-f="novo" data-tipo="Combustível" data-veic="${esc(v.id)}">Abastecer</button><button class="btn small" data-f="novo" data-tipo="Manutenção" data-veic="${esc(v.id)}">Manutenção</button></span>` : ''}</footer></article>`;
      }).join('') || `<div class="fin-vazio">${svg(ICV)}<p><b>Nenhum veículo cadastrado.</b><br>Cadastre os carros e caminhonetes da equipe para acompanhar combustível, manutenção, consumo e custo por km.</p>${ed ? `<button class="btn primary" data-f="veic-novo">Cadastrar veículo</button>` : ''}</div>`}</div>`;
  }

  // ---------- Eventos ----------
  function mudou(e) {
    const t = e.target;
    if (t.dataset.flt) { F[t.dataset.flt] = t.value; F.lim = 80; F.sel.clear(); salvarPref(); render(); return; }
    if (t.dataset.f === 'sel') { t.checked ? F.sel.add(t.dataset.id) : F.sel.delete(t.dataset.id); render(); return; }
    if (t.dataset.f === 'sel-tudo') { const ids = filtradas().sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))).slice(0, F.lim).map(d => String(d.id)); ids.forEach(id => t.checked ? F.sel.add(id) : F.sel.delete(id)); render(); }
  }
  async function clique(e) {
    const b = e.target.closest('[data-f]'); if (!b || b.tagName === 'INPUT') return;
    switch (b.dataset.f) {
      case 'aba': F.aba = b.dataset.aba; F.ctr = ''; salvarPref(); render(); break;
      case 'novo': formDespesa(null, { tipo: b.dataset.tipo || 'Combustível', veiculo_id: b.dataset.veic || '' }); break;
      case 'abrir': if (e.target.closest('.ck')) return; formDespesa(I().get('despesas', b.dataset.id)); break;
      case 'foto': e.stopPropagation(); verComprovante(I().get('despesas', b.dataset.id)); break;
      case 'veic-novo': formVeiculo(null); break;
      case 'veic-edit': formVeiculo(veic(b.dataset.id)); break;
      case 'veic-ver': F.veic = String(b.dataset.id); F.aba = 'lanc'; salvarPref(); render(); break;
      case 'func-ver': F.func = String(b.dataset.id); F.aba = 'lanc'; salvarPref(); render(); break;
      case 'ver-pend': F.status = 'Pendente'; F.aba = 'lanc'; F.per = 'tudo'; salvarPref(); render(); break;
      case 'limpar': Object.assign(F, { veic: '', func: '', tipo: '', faz: '', status: '' }); salvarPref(); render(); break;
      case 'mais': F.lim += 120; render(); break;
      case 'sel-limpar': F.sel.clear(); render(); break;
      case 'bulk': {
        const ids = [...F.sel]; let k = 0;
        for (const id of ids) { const d = I().get('despesas', id); if (d && d.status !== b.dataset.st) { await I().Store.save('despesas', Object.assign({}, d, { status: b.dataset.st, status_por: meuEmail(), status_em: new Date().toISOString() })); k++; } }
        F.sel.clear(); I().toast(k ? k + ' despesa(s) marcada(s) como ' + b.dataset.st.toLowerCase() + '.' : 'Nada mudou.'); render(); break;
      }
      case 'xlsx': if (souAdmin()) baixarExcel(); break;
      case 'ajustes': if (souAdmin()) formAjustes(); break;
      case 'conta-nova': formConta(null, { tipo: b.dataset.tipo || 'Receber' }); break;
      case 'contrato-novo': formContrato(null); break;
      case 'contrato': formContrato(contratos().find(c => String(c.id) === b.dataset.id)); break;
      case 'contrato-contas': F.cf = 'receber'; F.ctr = b.dataset.id; F.aba = 'contas'; F.per = 'tudo'; salvarPref(); render(); break;
      case 'conta': formConta(contas().find(c => String(c.id) === b.dataset.id)); break;
      case 'conta-baixa': { e.stopPropagation(); const c = contas().find(x => String(x.id) === b.dataset.id); if (c) { await I().Store.save('contas', Object.assign({}, c, { pago_em: I().today() })); I().toast(c.tipo === 'Receber' ? 'Marcada como recebida.' : 'Marcada como paga.'); } break; }
      case 'contas-flt': F.cf = b.dataset.v; render(); break;
      case 'ctr-limpar': F.ctr = ''; render(); break;
      case 'reemb-pagar': { const em = b.dataset.id, l = despesas().filter(d => String(d.usuario).toLowerCase() === em && reembolsavel(d) && d.status === 'Aprovada'); if (!l.length || !confirm(`Marcar ${l.length} despesa(s) de ${nomePessoa(em)} como reembolsadas (${R$(l.reduce((a, d) => a + n(d.valor), 0))})?`)) break; for (const d of l) await I().Store.save('despesas', Object.assign({}, d, { status: 'Reembolsada', status_por: meuEmail(), status_em: new Date().toISOString(), reembolsado_em: I().today() })); I().toast('Reembolso registrado.'); break; }
      case 'reemb-recibo': reciboPDF(b.dataset.id); break;
      case 'lucro-cli': F.lucroAberto = F.lucroAberto === b.dataset.id ? '' : b.dataset.id; render(); break;
      case 'pdf': if (souAdmin()) baixarPDF(); break;
    }
  }
  function dica(e) {
    const tip = root && $('.fin-tip', root); if (!tip) return;
    const el = e && e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.innerHTML = el.dataset.tip; tip.hidden = false;
    const r = root.getBoundingClientRect(), w = tip.offsetWidth;
    let x = e.clientX - r.left + 14; if (e.clientX + w + 24 > window.innerWidth) x = e.clientX - r.left - w - 14;
    tip.style.left = x + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
  }

  // ---------- Formulário de despesa ----------
  const sel = (name, opts, v, vazio = 'Selecione…', attrs = '') => `<select name="${name}" ${attrs}>${vazio != null ? `<option value="">${vazio}</option>` : ''}${opts.map(o => { const [val, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}${v && !opts.some(o => String(Array.isArray(o) ? o[0] : o) === String(v)) ? `<option selected value="${esc(v)}">${esc(v)}</option>` : ''}</select>`;
  const campo = (l, input, cls = '') => `<label class="field ${cls}"><span>${l}</span>${input}</label>`;
  const inp = (name, v, extra = '') => `<input type="text" name="${name}" value="${esc(v ?? '')}" ${extra}>`;
  const numInp = (name, v, extra = '') => `<input type="number" inputmode="decimal" step="any" min="0" name="${name}" value="${v == null ? '' : esc(v)}" ${extra}>`;

  function veicPadrao() {
    const vs = veiculos().filter(v => v.ativo !== 'Não');
    const meu = vs.find(v => String(v.responsavel || '').toLowerCase() === meuEmail().toLowerCase());
    if (meu) return String(meu.id);
    if (F.ultVeic && vs.some(v => String(v.id) === F.ultVeic)) return F.ultVeic;
    return vs.length === 1 ? String(vs[0].id) : '';
  }

  function formDespesa(rec, def) {
    const novo = !rec, adm = souAdmin();
    if (novo && !I().podeEditar()) { I().toast('Seu acesso é só de consulta.'); return; }
    const st0 = rec ? rec.status || 'Pendente' : 'Pendente';
    const dono = !rec || String(rec.usuario || '').toLowerCase() === meuEmail().toLowerCase() || rec.usuario === 'local';
    const travada = !adm && rec && !(dono && (st0 === 'Pendente' || st0 === 'Recusada'));
    const d = Object.assign({ data: I().today(), tanque_cheio: 'Sim', forma_pagamento: PAGTO[0] }, def || {}, rec || {});
    if (novo && !d.veiculo_id && (d.tipo === 'Combustível' || d.tipo === 'Manutenção')) d.veiculo_id = veicPadrao();
    if (novo && d.veiculo_id && !d.combustivel) d.combustivel = (veic(d.veiculo_id) || {}).combustivel || '';
    const padraoReemb = () => { if (novo && REEMB_TIPOS.includes(d.tipo)) { d.forma_pagamento = REEMB_PAG; if (d.tipo === 'Diária') { d.dias = d.dias ?? 1; d.valor_dia = d.valor_dia ?? nn(CFG().valor_diaria); } if (d.tipo === 'Km rodado') d.valor_km = d.valor_km ?? nn(CFG().valor_km); } };
    padraoReemb();
    let fazSel = fazendasDe(d); // rateio entre fazendas
    let ocrMsg = '';
    let foto = null; // { blob, mime, nome } escolhida agora
    let fotoRemovida = false;
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-mt"><header><h2 id="fin-mt">${novo ? 'Lançar despesa' : travada ? 'Despesa' : 'Editar despesa'}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
      <div class="fin-seg" role="radiogroup" aria-label="Tipo de despesa">${TIPOS.map(t => `<button type="button" role="radio" data-tipo="${t}" aria-checked="${d.tipo === t}" ${travada || (!novo && !adm && false) ? 'disabled' : ''}><i class="fin-qi ${TIPO_INFO[t].cls}">${svg(TIPO_INFO[t].ic)}</i>${t === 'Outra' ? 'Outra' : t}</button>`).join('')}</div>
      ${travada ? `<p class="fin-lock">Esta despesa já foi <b>${esc(st0.toLowerCase())}</b> e não pode mais ser alterada. Fale com o administrador se precisar corrigir.</p>` : rec && st0 === 'Recusada' ? `<p class="fin-lock bad">Despesa recusada${rec.motivo ? ': ' + esc(rec.motivo) : ''}. Corrija e salve para enviar de novo.</p>` : ''}
      <form novalidate ${travada ? 'inert' : ''}></form>
      <footer>${!novo && !travada ? '<button class="btn danger" data-del>Excluir</button>' : ''}<div class="right"><button class="btn" data-close>${travada ? 'Fechar' : 'Cancelar'}</button>${travada ? '' : '<button class="btn primary" data-save>Salvar</button>'}</div></footer></div>`;
    document.body.appendChild(bg);
    const form = $('form', bg);
    const ler = () => { const o = {}; for (const el of form.elements) if (el.name) o[el.name] = el.type === 'checkbox' ? (el.checked ? 'Sim' : 'Não') : el.value; return o; };

    function montar() {
      const t = d.tipo, vs = veiculos().filter(v => v.ativo !== 'Não' || String(v.id) === String(d.veiculo_id)).map(v => [v.id, v.placa + ' · ' + (v.modelo || '')]);
      const fz = S().data.fazendas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => [f.id, f.nome]);
      const pessoas = Object.entries(membros).filter(([, m]) => m.ativo).map(([em, m]) => [em, m.nome || em]);
      if (d.usuario && !pessoas.some(p => p[0] === String(d.usuario).toLowerCase())) pessoas.push([String(d.usuario).toLowerCase(), nomePessoa(d.usuario)]);
      if (!pessoas.some(p => p[0] === meuEmail().toLowerCase())) pessoas.unshift([meuEmail().toLowerCase(), nomePessoa(meuEmail()) + ' (eu)']);
      let h = campo('Data', `<input type="date" name="data" value="${esc(d.data || '')}" required>`) + campo('Valor total (R$)', numInp('valor', d.valor, 'required placeholder="0,00"'), 'fin-valor');
      if (t === 'Combustível') {
        h += campo('Veículo', sel('veiculo_id', vs, d.veiculo_id, vs.length ? 'Selecione…' : 'Cadastre um veículo primeiro', 'required'), 'full')
          + campo('Hodômetro (km)', numInp('km', d.km, 'placeholder="Ex.: 45320"')) + campo('Combustível', sel('combustivel', COMBUST, d.combustivel))
          + campo('Litros', numInp('litros', d.litros, 'required')) + campo('Preço por litro (R$)', numInp('preco_litro', d.preco_litro))
          + `<label class="chk full fin-cheio"><input type="checkbox" name="tanque_cheio" ${d.tanque_cheio !== 'Não' ? 'checked' : ''}> Completei o tanque <small class="muted">(necessário para calcular o consumo km/l)</small></label>`
          + `<div class="full fin-calc" id="fin-calc"></div>` + campo('Posto', inp('posto', d.posto, 'placeholder="Nome e cidade do posto"'), 'full');
      } else if (t === 'Manutenção') {
        h += campo('Veículo', sel('veiculo_id', vs, d.veiculo_id, vs.length ? 'Selecione…' : 'Cadastre um veículo primeiro', 'required'), 'full')
          + campo('Serviço', sel('manutencao', MANUT, d.manutencao, 'Selecione…', 'required')) + campo('Hodômetro (km)', numInp('km', d.km))
          + campo('Oficina / fornecedor', inp('oficina', d.oficina), 'full') + `<div class="full fin-calc" id="fin-calc"></div>`;
      } else if (t === 'Alimentação') {
        h += campo('Refeição', sel('refeicao', REFEICAO, d.refeicao)) + campo('Quantas pessoas', numInp('pessoas', d.pessoas ?? 1, 'step="1" min="1"'))
          + campo('Pessoa ou equipe', inp('pessoa', d.pessoa, 'placeholder="Ex.: Equipe de levantamento"')) + campo('Restaurante / local', inp('local', d.local));
      } else if (t === 'Diária') {
        h += campo('Quantidade de diárias', numInp('dias', d.dias, 'step="0.5" min="0.5" required')) + campo('Valor da diária (R$)', numInp('valor_dia', d.valor_dia, 'required'))
          + campo('Motivo / viagem', inp('descricao', d.descricao, 'placeholder="Ex.: Levantamento de broca na região de Jaú"'), 'full');
      } else if (t === 'Km rodado') {
        h += campo('Km inicial (opcional)', numInp('km_ini', d.km_ini)) + campo('Km final (opcional)', numInp('km_fim', d.km_fim))
          + campo('Km rodados', numInp('km_rodado', d.km_rodado, 'required')) + campo('Valor por km (R$)', numInp('valor_km', d.valor_km, 'required'))
          + campo('Trajeto', inp('descricao', d.descricao, 'placeholder="Ex.: Escritório → Fazenda Boa Vista → Escritório"'), 'full')
          + '<p class="full fin-calc fin-dica">Use para o carro do próprio funcionário. O valor é km rodados × valor por km e entra no reembolso.</p>';
      } else {
        h += campo('Categoria', sel('categoria', OUTRAS, d.categoria, 'Selecione…', 'required')) + campo('Veículo (se tiver)', sel('veiculo_id', vs, d.veiculo_id, 'Nenhum'))
          + campo('Descrição', inp('descricao', d.descricao), 'full');
      }
      h += `<div class="field full"><span>Fazenda / cliente visitado <small class="muted">(com mais de uma, o valor é dividido em partes iguais)</small></span><div class="fin-fazs" id="fin-fazs"></div></div>`
        + (REEMB_TIPOS.includes(t) ? `<div class="field"><span>Pagamento</span><span class="pill info" style="justify-self:start;margin-top:6px">Reembolso ao funcionário</span><input type="hidden" name="forma_pagamento" value="${esc(REEMB_PAG)}"></div>` : campo('Pagamento', sel('forma_pagamento', PAGTO, d.forma_pagamento, null)));
      if (adm) h += campo('Funcionário', sel('usuario', pessoas, String(d.usuario || meuEmail()).toLowerCase(), null)) + campo('Situação', sel('status', STATUS, st0, null)) + `<label class="field full fin-mot" ${st0 === 'Recusada' ? '' : 'hidden'}><span>Motivo da recusa</span>${inp('motivo', d.motivo)}</label>`;
      else h += `<div class="field"><span>Situação</span><span class="pill ${ST_CLS[st0]}" style="justify-self:start;margin-top:6px">${esc(st0)}</span></div>`;
      h += `<div class="field full"><span>Comprovante (foto da nota ou cupom)</span><div class="fin-comp" id="fin-comp"></div></div>` + campo('Observações', `<textarea name="obs">${esc(d.obs || '')}</textarea>`, 'full');
      form.innerHTML = h;
      desenharFoto(); desenharFazs(); calc('init');
    }
    // Fazendas da despesa (rateio) + sugestão: fazendas das visitas feitas no mesmo dia por quem lançou
    function visitadasNoDia() {
      const dia = (form.elements.data && form.elements.data.value) || d.data, quem = String((form.elements.usuario && form.elements.usuario.value) || d.usuario || meuEmail()).toLowerCase(), nome = nomePessoa(quem).toLowerCase();
      const ids = new Set();
      for (const m of S().data.monitoramentos || []) {
        if (String(m.data || '').slice(0, 10) !== dia) continue;
        const autor = String(m.criado_por || '').toLowerCase(), resp = String(m.responsavel || '').toLowerCase();
        if (quem !== 'local' && autor !== quem && !(resp && nome && resp.includes(nome.split(' ')[0]))) continue;
        const t = I().get('talhoes', m.talhao_id); if (t && t.fazenda_id) ids.add(String(t.fazenda_id));
      }
      for (const o of S().data.ordens || []) if ((o.data_conclusao || '') === dia && String(o.criado_por || '').toLowerCase() === quem && o.fazenda_id) ids.add(String(o.fazenda_id));
      return [...ids];
    }
    function desenharFazs() {
      const box = $('#fin-fazs', form); if (!box) return;
      const nomeF = id => (I().get('fazendas', id) || {}).nome || 'Fazenda removida';
      const resto = S().data.fazendas.filter(f => !fazSel.includes(String(f.id))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const vis = visitadasNoDia().filter(id => !fazSel.includes(id));
      const v = nn(form.elements.valor && form.elements.valor.value);
      box.innerHTML = `${fazSel.map(id => `<span class="fin-chip">${esc(nomeF(id))}${fazSel.length > 1 && v ? ` <small>${R$(v / fazSel.length)}</small>` : ''}<button type="button" data-faz-tirar="${esc(id)}" aria-label="Tirar ${esc(nomeF(id))}">×</button></span>`).join('')}
        <select data-faz-add aria-label="Adicionar fazenda"><option value="">${fazSel.length ? '+ Adicionar outra fazenda' : 'Nenhuma (despesa geral) · escolher fazenda'}</option>${resto.map(f => `<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('')}</select>
        ${vis.length ? `<button type="button" class="btn small" data-faz-vis>Fazendas visitadas neste dia (${vis.length})</button>` : ''}`;
    }
    function desenharFoto() {
      const box = $('#fin-comp', form); if (!box) return;
      const tem = foto || (d.comprovante && !fotoRemovida);
      box.innerHTML = `${tem ? `<span class="fin-thumb">${foto && /^image/.test(foto.mime) ? `<img src="${esc(foto.prev)}" alt="Prévia do comprovante">` : svg(IC.clip)}<span>${foto ? 'Foto pronta para salvar' : d.comprovante.pend ? 'Guardado no aparelho (a enviar)' : 'Comprovante anexado'}</span>${!foto ? '<button type="button" class="btn small" data-ver>Ver</button>' : ''}<button type="button" class="lnk" data-tirar>Remover</button></span>` : ''}
        <label class="btn fin-up">${svg(IC.foto)}${tem ? 'Trocar foto' : 'Tirar foto ou escolher arquivo'}<input type="file" accept="image/*,application/pdf" hidden data-file></label>
        <p class="fin-ocr" id="fin-ocr" ${ocrMsg ? '' : 'hidden'}>${ocrMsg}</p>`;
    }
    // Lê o comprovante pela foto (no próprio aparelho) e preenche só os campos vazios
    async function lerFoto(blob) {
      const msg = h => { ocrMsg = h; const el = $('#fin-ocr', form); if (el) { el.innerHTML = h; el.hidden = !h; } };
      msg(`<span class="fin-spin"></span>Lendo o comprovante…`);
      let r;
      try { r = await OCR.ler(blob, p => msg(`<span class="fin-spin"></span>Lendo o comprovante… ${Math.round(p * 100)}%`)); }
      catch (e) { msg(navigator.onLine ? 'Não consegui ler a foto. Preencha os campos à mão.' : 'Para ler a foto é preciso internet na primeira vez. Preencha à mão ou tente depois.'); return; }
      if (!document.body.contains(bg)) return;
      const el = form.elements, feito = [];
      const por = (nome, v, rot) => { if (v == null || v === '' || !el[nome] || el[nome].value) return; el[nome].value = v; feito.push(rot); };
      if (r.data) por('data', r.data, 'data');
      if (d.tipo === 'Combustível') {
        por('litros', r.litros, 'litros'); por('preco_litro', r.preco_litro, 'preço por litro'); por('posto', r.nome, 'posto'); por('km', r.km, 'km');
        if (r.combustivel && el.combustivel && !el.combustivel.value) { el.combustivel.value = r.combustivel; feito.push('combustível'); }
      } else if (d.tipo === 'Manutenção') por('oficina', r.nome, 'oficina');
      else if (d.tipo === 'Alimentação') por('local', r.nome, 'local');
      else if (d.tipo === 'Outra') por('descricao', r.nome, 'descrição');
      por('valor', r.valor != null ? r.valor.toFixed(2) : null, 'valor');
      calc('litros'); desenharFazs();
      msg(feito.length ? `${svg(IC.ok)} Preenchido pela foto: <b>${feito.join(', ')}</b>. Confira antes de salvar.` : 'Li a foto, mas não achei valores claros. Preencha à mão. <button type="button" class="lnk" data-ocr>Tentar de novo</button>');
    }
    // Combustível: litros × preço = valor (preenche o que faltar); mostra km rodados e consumo desde o último tanque cheio
    let ultimo = 'valor';
    function calc(src) {
      if (src) ultimo = src;
      const el = form.elements, box = $('#fin-calc', form);
      if (d.tipo === 'Combustível' && el.litros) {
        const L = nn(el.litros.value), V = nn(el.valor.value), P = nn(el.preco_litro.value);
        if (src === 'litros' || src === 'preco_litro') { if (L && P) el.valor.value = (L * P).toFixed(2); else if (L && V) el.preco_litro.value = (V / L).toFixed(3); }
        else if (src === 'valor') { if (L && V) el.preco_litro.value = (V / L).toFixed(3); else if (P && V) el.litros.value = (V / P).toFixed(2); }
      }
      if (d.tipo === 'Diária' && el.dias && (src === 'dias' || src === 'valor_dia' || src === 'init')) { const a = nn(el.dias.value), b = nn(el.valor_dia.value); if (a && b) el.valor.value = (a * b).toFixed(2); }
      if (d.tipo === 'Km rodado' && el.km_rodado) {
        if (src === 'km_ini' || src === 'km_fim') { const a = nn(el.km_ini.value), b = nn(el.km_fim.value); if (a != null && b != null && b > a) el.km_rodado.value = b - a; }
        if (['km_ini', 'km_fim', 'km_rodado', 'valor_km', 'init'].includes(src)) { const k = nn(el.km_rodado.value), t = nn(el.valor_km.value); if (k && t) el.valor.value = (k * t).toFixed(2); }
      }
      if (src === 'valor' || src === 'litros' || src === 'preco_litro') desenharFazs();
      if (!box) return;
      const vid = el.veiculo_id && el.veiculo_id.value, K = el.km ? nn(el.km.value) : null, v = veic(vid);
      if (!v) { box.innerHTML = ''; return; }
      const outros = despesas().filter(x => String(x.veiculo_id) === String(vid) && String(x.id) !== String(d.id) && n(x.km) > 0);
      const ant = outros.filter(x => !K || n(x.km) < K).sort((a, b) => n(b.km) - n(a.km))[0];
      const msgs = [];
      const atual = kmAtual(v);
      if (K && ant) msgs.push(`Último registro: <b>${km(n(ant.km))}</b> em ${fd(ant.data)} · rodou <b>${km(K - n(ant.km))}</b>`);
      else if (!K && atual) msgs.push(`Hodômetro conhecido: <b>${km(atual)}</b>`);
      if (K && atual && K < atual && !ant) msgs.push(`<span class="warn">O km informado é menor que o último conhecido (${km(atual)}). Confira.</span>`);
      if (d.tipo === 'Combustível' && K && el.tanque_cheio && el.tanque_cheio.checked) {
        // consumo deste abastecimento: desde o último tanque cheio
        const ab = outros.filter(x => x.tipo === 'Combustível' && n(x.km) < K).sort((a, b) => n(b.km) - n(a.km));
        let lit = nn(el.litros.value) || 0, base = null;
        for (const x of ab) { if (x.tanque_cheio !== 'Não') { base = x; break; } lit += n(x.litros); }
        if (base && lit && K > n(base.km)) msgs.push(`Consumo neste tanque: <b>${dec((K - n(base.km)) / lit)} km/l</b>`);
      }
      const rv = revisao(Object.assign({}, v, K ? { km_inicial: Math.max(K, n(v.km_inicial)) } : {}));
      if (rv && rv.cls !== 'ok') msgs.push(`<span class="${rv.cls}">${esc(rv.txt)}</span>`);
      box.innerHTML = msgs.length ? msgs.join('<span class="sep">·</span>') : '';
    }
    montar();
    // Admin sem nomes carregados: tenta carregar e redesenha a lista de pessoas
    if (adm && !Object.keys(membros).length) carregarMembros().then(() => { if (document.body.contains(bg)) { Object.assign(d, ler()); montar(); } });

    bg.addEventListener('input', e => { if (['litros', 'valor', 'preco_litro', 'dias', 'valor_dia', 'km_ini', 'km_fim', 'km_rodado', 'valor_km'].includes(e.target.name)) calc(e.target.name); else if (e.target.name === 'km') calc(); });
    bg.addEventListener('change', async e => {
      const t = e.target;
      if (t.name === 'veiculo_id') { const v = veic(t.value); if (v && form.elements.combustivel && !form.elements.combustivel.value && v.combustivel) form.elements.combustivel.value = v.combustivel; calc(); }
      if (t.name === 'tanque_cheio') calc();
      if (t.name === 'data' || t.name === 'usuario') desenharFazs();
      if (t.matches('[data-faz-add]') && t.value) { fazSel.push(t.value); desenharFazs(); return; }
      if (t.name === 'status') { const m = $('.fin-mot', form); if (m) m.hidden = t.value !== 'Recusada'; }
      if (t.matches('[data-file]') && t.files[0]) {
        const f = t.files[0];
        if (f.size > 25 * 1024 * 1024) { I().toast('Arquivo grande demais (máximo 25 MB).'); return; }
        foto = await reduzir(f); foto.prev = /^image/.test(foto.mime) ? URL.createObjectURL(foto.blob) : null; fotoRemovida = false; desenharFoto();
        if (/^image/.test(foto.mime)) lerFoto(foto.blob);
      }
    });
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return bg.remove();
      const tb = e.target.closest('.fin-seg [data-tipo]');
      if (tb && !travada) { Object.assign(d, ler(), { tipo: tb.dataset.tipo }); padraoReemb(); if (!REEMB_TIPOS.includes(d.tipo) && d.forma_pagamento === REEMB_PAG && novo) d.forma_pagamento = PAGTO[0]; if ((d.tipo === 'Combustível' || d.tipo === 'Manutenção') && !d.veiculo_id) d.veiculo_id = veicPadrao(); $$('.fin-seg [data-tipo]', bg).forEach(x => x.setAttribute('aria-checked', x === tb)); montar(); return; }
      if (e.target.closest('[data-ver]')) { verComprovante(d); return; }
      const ft = e.target.closest('[data-faz-tirar]'); if (ft) { fazSel = fazSel.filter(x => x !== ft.dataset.fazTirar); desenharFazs(); return; }
      if (e.target.closest('[data-faz-vis]')) { for (const id of visitadasNoDia()) if (!fazSel.includes(id)) fazSel.push(id); desenharFazs(); return; }
      if (e.target.closest('[data-ocr]')) { if (foto) lerFoto(foto.blob); return; }
      if (e.target.closest('[data-tirar]')) { foto = null; fotoRemovida = true; desenharFoto(); return; }
      if (e.target.closest('[data-del]')) {
        if (!confirm('Excluir esta despesa?')) return;
        await I().Store.remove('despesas', rec.id).then(() => { I().toast('Despesa excluída.'); bg.remove(); }).catch(() => {});
        if (rec.comprovante && rec.comprovante.pend) tirar(rec.comprovante.pend);
        if (rec.comprovante && rec.comprovante.path && online()) I().SB.cli.storage.from('comprovantes').remove([rec.comprovante.path]).catch(() => {});
        return;
      }
      if (e.target.closest('[data-save]')) {
        const v = ler(), faltam = [];
        if (!v.data) faltam.push('data');
        if (!(nn(v.valor) > 0)) faltam.push('valor');
        if ((d.tipo === 'Combustível' || d.tipo === 'Manutenção') && !v.veiculo_id) faltam.push('veículo');
        if (d.tipo === 'Combustível' && !(nn(v.litros) > 0)) faltam.push('litros');
        if (d.tipo === 'Km rodado' && !(nn(v.km_rodado) > 0)) faltam.push('km rodados');
        if (faltam.length) { I().toast('Preencha: ' + faltam.join(', ') + '.'); const el = form.elements[{ data: 'data', valor: 'valor', 'veículo': 'veiculo_id', litros: 'litros' }[faltam[0]]]; if (el) el.focus(); return; }
        const obj = Object.assign({}, rec || {}, { id: rec ? rec.id : I().newId(), tipo: d.tipo });
        for (const [k, x] of Object.entries(v)) obj[k] = ['valor', 'litros', 'preco_litro', 'km', 'pessoas', 'dias', 'valor_dia', 'km_ini', 'km_fim', 'km_rodado', 'valor_km'].includes(k) ? nn(x) : x || null;
        obj.fazenda_ids = fazSel.slice(); obj.fazenda_id = fazSel[0] || null;
        if (ocrMsg) obj.lido_da_foto = true;
        // campos que não pertencem ao tipo escolhido saem do registro
        const DO_TIPO = { 'Combustível': ['veiculo_id', 'km', 'combustivel', 'litros', 'preco_litro', 'tanque_cheio', 'posto'], 'Manutenção': ['veiculo_id', 'km', 'manutencao', 'oficina'], 'Alimentação': ['refeicao', 'pessoas', 'pessoa', 'local'], 'Diária': ['dias', 'valor_dia', 'descricao'], 'Km rodado': ['km_ini', 'km_fim', 'km_rodado', 'valor_km', 'descricao'], 'Outra': ['categoria', 'veiculo_id', 'descricao'] };
        for (const k of ['veiculo_id', 'km', 'combustivel', 'litros', 'preco_litro', 'tanque_cheio', 'posto', 'manutencao', 'oficina', 'refeicao', 'pessoas', 'pessoa', 'local', 'categoria', 'descricao', 'dias', 'valor_dia', 'km_ini', 'km_fim', 'km_rodado', 'valor_km']) if (!DO_TIPO[d.tipo].includes(k)) delete obj[k];
        if (!adm) { obj.usuario = rec ? rec.usuario : meuEmail().toLowerCase(); obj.status = 'Pendente'; delete obj.motivo; }
        else { obj.usuario = v.usuario || meuEmail().toLowerCase(); if (obj.status !== st0) { obj.status_por = meuEmail(); obj.status_em = new Date().toISOString(); } if (obj.status !== 'Recusada') delete obj.motivo; }
        if (fotoRemovida && !foto) { if (rec && rec.comprovante && rec.comprovante.pend) tirar(rec.comprovante.pend); obj.comprovante = null; }
        if (foto) {
          if (online()) {
            const cid = 'c' + I().newId();
            await guardar(cid, { id: cid, blob: foto.blob, mime: foto.mime, nome: foto.nome, desp: String(obj.id), em: obj.data || I().today() });
            if (rec && rec.comprovante && rec.comprovante.pend) tirar(rec.comprovante.pend);
            obj.comprovante = { pend: cid, mime: foto.mime, nome: foto.nome };
          } else obj.comprovante = { url: await blobUrl(foto.blob), mime: foto.mime, nome: foto.nome }; // versão sem banco: guarda a imagem no próprio registro
        }
        if (obj.veiculo_id) { F.ultVeic = String(obj.veiculo_id); salvarPref(); }
        try { await I().Store.save('despesas', obj); } catch (er) { return; }
        bg.remove(); I().toast(novo ? 'Despesa lançada.' : 'Despesa salva.');
        if (foto && online()) { await contarPend(); enviarComprovantes(); }
      }
    });
  }

  // ---------- Formulário de veículo ----------
  function formVeiculo(rec) {
    const novo = !rec, adm = souAdmin();
    if (!I().podeEditar()) { I().toast('Seu acesso é só de consulta.'); return; }
    const v = Object.assign({ ativo: 'Sim' }, rec || {});
    const pessoas = Object.entries(membros).filter(([, m]) => m.ativo).map(([em, m]) => [em, m.nome || em]);
    if (v.responsavel && !pessoas.some(p => p[0] === v.responsavel)) pessoas.push([v.responsavel, nomePessoa(v.responsavel)]);
    if (!pessoas.some(p => p[0] === meuEmail().toLowerCase())) pessoas.unshift([meuEmail().toLowerCase(), nomePessoa(meuEmail())]);
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="fin-vt"><header><h2 id="fin-vt">${novo ? 'Novo veículo' : 'Editar veículo'}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
      <form novalidate>
        ${campo('Placa', inp('placa', v.placa, 'required placeholder="ABC1D23" autocapitalize="characters" maxlength="8"'))}${campo('Modelo', inp('modelo', v.modelo, 'required placeholder="Ex.: Hilux CD 2.8"'))}
        ${campo('Marca', inp('marca', v.marca))}${campo('Ano', numInp('ano', v.ano, 'step="1" min="1950"'))}
        ${campo('Combustível principal', sel('combustivel', COMBUST, v.combustivel))}${campo('Hodômetro no cadastro (km)', numInp('km_inicial', v.km_inicial))}
        ${campo('Próxima revisão / troca de óleo (km)', numInp('revisao_km', v.revisao_km, 'placeholder="Ex.: 50000"'))}${campo('Motorista principal', sel('responsavel', pessoas, v.responsavel, 'Uso compartilhado'))}
        ${campo('Situação', sel('ativo', [['Sim', 'Em uso'], ['Não', 'Inativo / vendido']], v.ativo, null))}${campo('Renavam / chassi', inp('renavam', v.renavam))}
        ${campo('Observações', `<textarea name="obs">${esc(v.obs || '')}</textarea>`, 'full')}
      </form>
      <footer>${!novo && adm ? '<button class="btn danger" data-del>Excluir</button>' : ''}<div class="right"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar</button></div></footer></div>`;
    document.body.appendChild(bg);
    const form = $('form', bg);
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return bg.remove();
      if (e.target.closest('[data-del]')) {
        const usos = despesas().filter(d => String(d.veiculo_id) === String(rec.id)).length;
        if (!confirm(usos ? `Este veículo tem ${usos} despesa(s). Prefira marcar como "Inativo". Excluir mesmo assim?` : 'Excluir este veículo?')) return;
        await I().Store.remove('veiculos', rec.id).then(() => { I().toast('Veículo excluído.'); bg.remove(); }).catch(() => {}); return;
      }
      if (e.target.closest('[data-save]')) {
        const o = Object.assign({}, rec || {}, { id: rec ? rec.id : I().newId() });
        for (const el of form.elements) if (el.name) o[el.name] = ['ano', 'km_inicial', 'revisao_km'].includes(el.name) ? nn(el.value) : el.value.trim() || null;
        o.placa = String(o.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!o.placa || !o.modelo) { I().toast('Preencha a placa e o modelo.'); return; }
        if (o.placa.length >= 7) o.placa = o.placa.slice(0, 3) + '-' + o.placa.slice(3);
        if (veiculos().some(x => x.placa === o.placa && String(x.id) !== String(o.id))) { I().toast('Já existe um veículo com esta placa.'); return; }
        try { await I().Store.save('veiculos', o); } catch (er) { return; }
        bg.remove(); I().toast(novo ? 'Veículo cadastrado.' : 'Veículo salvo.');
      }
    });
  }

  // ---------- Exportação ----------
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const LIBS = { jspdf: [CDN + 'jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf], autotable: [CDN + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', () => window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable], xlsx: [CDN + 'xlsx/0.18.5/xlsx.full.min.js', () => window.XLSX] };
  const libP = {};
  function lib(k) {
    if (LIBS[k][1]()) return Promise.resolve();
    return libP[k] = libP[k] || new Promise((ok, falha) => { const s = document.createElement('script'); s.src = LIBS[k][0]; s.onload = ok; s.onerror = () => { delete libP[k]; falha(new Error('lib')); }; document.head.appendChild(s); });
  }
  function filtroTxt() {
    const p = periodo(), out = [F.per === 'custom' ? `${fd(p[0])} a ${fd(p[1])}` : F.per === 'tudo' ? 'Todo o período' : `${PER[F.per]} (${fd(p[0])} a ${fd(p[1])})`];
    if (F.veic) out.push('Veículo ' + ((veic(F.veic) || {}).placa || ''));
    if (F.func) out.push(nomePessoa(F.func));
    if (F.tipo) out.push(TIPO_INFO[F.tipo].plural);
    if (F.faz) out.push((I().get('fazendas', F.faz) || {}).nome || '');
    if (F.status) out.push(F.status);
    return out.join(' · ');
  }
  const r2 = v => v == null ? null : Math.round(v * 100) / 100;
  function linhas(lista) {
    return lista.slice().sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))).map(d => ({
      Data: fd(d.data), Tipo: d.tipo, Detalhe: descr(d), 'Veículo': (veic(d.veiculo_id) || {}).placa || '', 'Km': d.km ?? null, 'Litros': d.litros ?? null, 'R$/L': d.preco_litro ?? null,
      Fazenda: (I().get('fazendas', d.fazenda_id) || {}).nome || '', 'Funcionário': nomePessoa(d.usuario), Pagamento: d.forma_pagamento || '', 'Situação': d.status || 'Pendente', 'Valor (R$)': r2(n(d.valor)), Comprovante: d.comprovante ? 'Sim' : 'Não', 'Observações': d.obs || '',
    }));
  }
  function porVeiculo(p, lista) {
    return veiculos().map(v => ({ v, s: statsVeic(v, p, lista) })).filter(x => x.s.n).map(({ v, s }) => ({ Placa: v.placa, Modelo: [v.marca, v.modelo].filter(Boolean).join(' '), 'Km rodados': s.rod ? Math.round(s.rod) : null, Litros: r2(s.litros), 'Consumo (km/l)': s.kml ? Math.round(s.kml * 10) / 10 : null, 'Combustível (R$)': r2(s.comb), 'Manutenção (R$)': r2(s.man), 'Outras (R$)': r2(s.out), 'Total (R$)': r2(s.tot), 'Custo por km (R$)': s.cpk ? r2(s.cpk) : null }));
  }
  function porGrupo(lista, f, nome, col) {
    const m = new Map(); for (const d of lista) { const k = f(d) || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(d); }
    return [...m.entries()].map(([k, l]) => { const o = somaTipo(l); return { [col]: nome(k), 'Lançamentos': l.length, 'Combustível (R$)': r2(o['Combustível']), 'Manutenção (R$)': r2(o['Manutenção']), 'Alimentação (R$)': r2(o['Alimentação']), 'Outras (R$)': r2(o['Outra']), 'Total (R$)': r2(o.tot) }; }).sort((a, b) => b['Total (R$)'] - a['Total (R$)']);
  }
  const nomeArq = ext => ('despesas-' + filtroTxt().split(' · ')[0] + '-' + I().today()).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase() + '.' + ext;
  async function baixarExcel() {
    try { await lib('xlsx'); } catch (e) { I().toast('Não foi possível gerar a planilha. Verifique a internet.'); return; }
    const X = window.XLSX, wb = X.utils.book_new(), p = periodo(), lista = filtradas();
    if (!lista.length) { I().toast('Nenhuma despesa neste filtro.'); return; }
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(linhas(lista)), 'Lançamentos');
    const pv = porVeiculo(p, lista); if (pv.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(pv), 'Por veículo');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(porGrupo(lista, d => String(d.usuario || '').toLowerCase(), nomePessoa, 'Funcionário')), 'Por funcionário');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(porGrupo(lista.flatMap(d => partes(d).length ? partes(d).map(([fid, v]) => Object.assign({}, d, { fazenda_id: fid, valor: v })) : [d]), d => d.fazenda_id, id => id ? (I().get('fazendas', id) || {}).nome || '' : 'Sem fazenda', 'Fazenda')), 'Por fazenda');
    if (souAdmin()) {
      const ct = contas().filter(c => noPer(c.vencimento, p));
      if (ct.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(ct.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento))).map(c => ({ Tipo: c.tipo === 'Receber' ? 'A receber' : 'A pagar', 'Descrição': c.descricao || '', Categoria: c.categoria || '', 'Cliente / fornecedor': c.tipo === 'Receber' ? ((I().get('produtores', c.produtor_id) || {}).nome || '') : (c.fornecedor || ''), Fazenda: (I().get('fazendas', c.fazenda_id) || {}).nome || '', Vencimento: fd(c.vencimento), 'Pago/recebido em': c.pago_em ? fd(c.pago_em) : '', 'Situação': situacaoConta(c).l, 'Valor (R$)': r2(n(c.valor)) }))), 'Contas');
      const ks = contratos(); if (ks.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(ks.map(k => ({ Cliente: nomeCli(k.produtor_id), Fazenda: (I().get('fazendas', k.fazenda_id) || {}).nome || '', 'Descrição': k.descricao || '', 'Valor mensal (R$)': r2(n(k.valor)), 'Dia do vencimento': n(k.dia), 'Início': fd(k.inicio), Fim: k.fim ? fd(k.fim) : 'Sem prazo', 'Situação': situacaoContrato(k).l }))), 'Contratos');
      const lu = lucroDados(p); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(lu.linhas.map(x => ({ Cliente: x.nome, 'Receitas (R$)': r2(x.rec), 'Despesas da equipe (R$)': r2(x.desp), 'Contas a pagar (R$)': r2(x.pag), 'Lucro (R$)': r2(x.rec - x.desp - x.pag), 'Margem (%)': x.rec ? Math.round((x.rec - x.desp - x.pag) / x.rec * 1000) / 10 : null }))), 'Lucro por cliente');
    }
    X.writeFile(wb, nomeArq('xlsx')); I().toast('Planilha gerada.');
  }
  function logo() {
    const img = document.querySelector('.login-logo.logo-claro'); if (!img || !img.naturalWidth) return null;
    try { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return { url: c.toDataURL('image/png'), w: c.width, h: c.height }; } catch (e) { return null; }
  }
  async function baixarPDF() {
    try { await lib('jspdf'); await lib('autotable'); } catch (e) { I().toast('Não foi possível gerar o PDF. Verifique a internet.'); return; }
    const lista = filtradas(); if (!lista.length) { I().toast('Nenhuma despesa neste filtro.'); return; }
    const p = periodo(), { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
    const VERDE = [94, 129, 69], LIMA = [177, 210, 67], TINTA = [32, 30, 30], CINZA = [100, 106, 95];
    const lg = logo();
    if (lg) doc.addImage(lg.url, 'PNG', M, M, 55, 55 * lg.h / lg.w); else { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...VERDE); doc.text('InovaAgro', M, M + 8); }
    doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Relatório de despesas', W - M, M + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA); doc.text(filtroTxt() + ' · emitido em ' + fd(I().today()), W - M, M + 10, { align: 'right' });
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.8); doc.line(M, M + 15, W - M, M + 15);
    const o = somaTipo(lista), pv = porVeiculo(p, lista);
    const rod = pv.reduce((a, x) => a + (x['Km rodados'] || 0), 0), cv = pv.filter(x => x['Km rodados']).reduce((a, x) => a + x['Combustível (R$)'] + x['Manutenção (R$)'], 0);
    const sum = [[R$(o.tot), 'Total'], [R$(o['Combustível']), 'Combustível'], [R$(o['Manutenção']), 'Manutenção'], [R$(o['Alimentação']), 'Alimentação'], [R$(o['Outra']), 'Outras'], [rod ? R$(cv / rod) : '—', 'Custo por km']];
    const bw = (W - 2 * M - 5 * 4) / 6;
    sum.forEach(([v, l], i) => { const x = M + i * (bw + 4), y = M + 19; doc.setFillColor(237, 241, 230); doc.roundedRect(x, y, bw, 15, 2, 2, 'F'); doc.setFillColor(...LIMA); doc.rect(x, y, 1.2, 15, 'F'); doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(v, x + 4, y + 7); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.text(l.toUpperCase(), x + 4, y + 12); });
    let y = M + 42;
    const tabela = (tit, cols, body, right) => {
      if (y > H - 30) { doc.addPage(); y = M + 4; }
      doc.setTextColor(...VERDE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(tit, M, y); y += 3;
      doc.autoTable({ startY: y, margin: { left: M, right: M, top: M + 4, bottom: 14 }, head: [cols], body,
        styles: { fontSize: 7.8, cellPadding: 1.4, textColor: TINTA, lineColor: [217, 223, 208], lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [246, 248, 242] },
        columnStyles: Object.fromEntries(right.map(i => [i, { halign: 'right' }])) });
      y = doc.lastAutoTable.finalY + 8;
    };
    const fm = v => v == null ? '—' : R$(v);
    if (pv.length) tabela('Por veículo', ['Placa', 'Modelo', 'Km rodados', 'Litros', 'Consumo (km/l)', 'Combustível', 'Manutenção', 'Total', 'Custo por km'], pv.map(x => [x.Placa, x.Modelo, x['Km rodados'] ? km(x['Km rodados']) : '—', x.Litros ? dec(x.Litros, 1) : '—', x['Consumo (km/l)'] ? dec(x['Consumo (km/l)']) : '—', fm(x['Combustível (R$)']), fm(x['Manutenção (R$)']), fm(x['Total (R$)']), fm(x['Custo por km (R$)'])]), [2, 3, 4, 5, 6, 7, 8]);
    const pf = porGrupo(lista, d => String(d.usuario || '').toLowerCase(), nomePessoa, 'Funcionário');
    if (pf.length > 1 || souAdmin()) tabela('Por funcionário', ['Funcionário', 'Lançamentos', 'Combustível', 'Manutenção', 'Alimentação', 'Outras', 'Total'], pf.map(x => [x['Funcionário'], x['Lançamentos'], fm(x['Combustível (R$)']), fm(x['Manutenção (R$)']), fm(x['Alimentação (R$)']), fm(x['Outras (R$)']), fm(x['Total (R$)'])]), [1, 2, 3, 4, 5, 6]);
    const L = linhas(lista);
    tabela(`Lançamentos (${L.length})`, ['Data', 'Tipo', 'Detalhe', 'Veículo', 'Km', 'Fazenda', 'Funcionário', 'Situação', 'Valor'], L.map(x => [x.Data, x.Tipo, x.Detalhe, x['Veículo'], x.Km ? Math.round(x.Km).toLocaleString('pt-BR') : '', x.Fazenda, x['Funcionário'], x['Situação'], R$(x['Valor (R$)'])]).concat([['', '', '', '', '', '', '', 'Total', R$(o.tot)]]), [4, 8]);
    const np = doc.getNumberOfPages();
    for (let i = 1; i <= np; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.setFont('helvetica', 'normal'); doc.setFillColor(...LIMA); doc.rect(0, H - 3, W, 3, 'F'); doc.text('InovaAgro Consultoria Agrícola · Relatório de despesas', M, H - 6); doc.text('Página ' + i + ' de ' + np, W - M, H - 6, { align: 'right' }); }
    doc.save(nomeArq('pdf')); I().toast('PDF gerado.');
  }

  // ---------- Orçamento mensal por categoria ----------
  const mesAtual = () => I().today().slice(0, 7);
  function orcamento() {
    const o = ORC(), mes = mesAtual();
    const ds = despesas().filter(d => String(d.data || '').slice(0, 7) === mes && d.status !== 'Recusada');
    const gasto = somaTipo(ds), itens = [];
    for (const t of TIPOS) if (n(o[t]) > 0) itens.push({ k: t, nome: TIPO_INFO[t].plural, cls: TIPO_INFO[t].cls, lim: n(o[t]), gasto: gasto[t] });
    if (n(o.total) > 0) itens.push({ k: 'total', nome: 'Total do mês', cls: '', lim: n(o.total), gasto: gasto.tot });
    for (const x of itens) { x.pct = x.gasto / x.lim * 100; x.st = x.pct > 100 ? 'bad' : x.pct >= 80 ? 'warn' : 'ok'; }
    return itens;
  }
  function htmlOrcamento() {
    const it = orcamento(), adm = souAdmin();
    if (!it.length) return adm ? `<div class="fin-orc-vazio"><span>Defina um orçamento mensal por categoria para receber alerta quando passar do limite.</span><button class="btn small" data-f="ajustes">Definir orçamento</button></div>` : '';
    const nomeMes = new Date(mesAtual() + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return `<section class="card-box fin-orc"><h3>Orçamento de ${esc(nomeMes)} <small>${adm ? '<button class="lnk" data-f="ajustes">Alterar limites</button>' : 'gasto da equipe no mês'}</small></h3>
      <div class="fin-orc-l">${it.map(x => `<div class="fin-orc-i ${x.st}"><span class="nm">${x.cls ? `<i class="sw ${x.cls}"></i>` : ''}${esc(x.nome)}</span>
        <span class="tr" role="img" aria-label="${esc(x.nome)}: ${Math.round(x.pct)}% do orçamento"><i style="width:${Math.min(100, x.pct).toFixed(1)}%"></i></span>
        <span class="v num">${R0(x.gasto)} <small>de ${R0(x.lim)}</small></span><span class="pill ${x.st}">${Math.round(x.pct) + '%'}${x.st === 'bad' ? ' · passou' : ''}</span></div>`).join('')}</div></section>`;
  }

  // ---------- Avisos (aparecem nas Notificações do app e no topo desta tela) ----------
  function avisos() {
    if (!window.INOVA || !S().data.despesas) return [];
    const out = [], hoje = I().today(), adm = souAdmin();
    if (adm) {
      for (const x of orcamento()) if (x.st !== 'ok') out.push({ id: 'orc-' + mesAtual() + '-' + x.k + '-' + x.st, tipo: 'atividades', data: hoje, cor: x.st === 'bad' ? '#d03b3b' : '#ec835a', t: x.st === 'bad' ? `Orçamento estourado: ${x.nome}` : `Orçamento perto do limite: ${x.nome}`, d: `${R0(x.gasto)} de ${R0(x.lim)} (${Math.round(x.pct)}%)`, go: 'fin:resumo' });
      for (const c of contas()) {
        if (c.pago_em || !c.vencimento) continue;
        const dias = Math.round((new Date(c.vencimento + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5);
        if (dias > 3) continue;
        const o = c.tipo === 'Receber' ? 'a receber' : 'a pagar';
        out.push({ id: 'cta-' + c.id + '-' + (dias < 0 ? 'v' : dias), tipo: 'atividades', data: c.vencimento, cor: dias < 0 ? '#d03b3b' : '#ec835a', t: dias < 0 ? `Conta ${o} vencida: ${c.descricao || ''}` : `Conta ${o} vence ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : 'em ' + dias + ' dias'}: ${c.descricao || ''}`, d: R$(c.valor) + (c.tipo === 'Receber' ? ' · ' + ((I().get('produtores', c.produtor_id) || {}).nome || '') : c.fornecedor ? ' · ' + c.fornecedor : ''), go: 'fin:contas' });
      }
      for (const k of contratos()) {
        if (k.status === 'Encerrado' || !k.fim) continue;
        const dias = Math.round((new Date(k.fim + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5);
        if (dias >= 0 && dias <= 30) out.push({ id: 'ctr-fim-' + k.id + '-' + k.fim, tipo: 'atividades', data: hoje, cor: '#ec835a', t: `Contrato termina ${dias === 0 ? 'hoje' : 'em ' + dias + (dias === 1 ? ' dia' : ' dias')}: ${nomeCli(k.produtor_id)}`, d: 'Renove ou encerre em Despesas e veículos → Contratos', go: 'fin:contratos' });
      }
      const pend = despesas().filter(d => (d.status || 'Pendente') === 'Pendente');
      if (pend.length) out.push({ id: 'dpend-' + pend.length + '-' + pend.map(d => d.id).sort().slice(-1), tipo: 'atividades', data: pend.map(d => d.data || '').sort().pop(), cor: '#2a78d6', t: `${pend.length} despesa(s) esperando aprovação`, d: R$(pend.reduce((a, d) => a + n(d.valor), 0)), go: 'fin:lanc' });
    } else {
      for (const d of despesas()) if (d.status === 'Recusada' && String(d.usuario).toLowerCase() === meuEmail().toLowerCase()) out.push({ id: 'drec-' + d.id + (d.status_em || ''), tipo: 'atividades', data: (d.status_em || d.data || '').slice(0, 10), cor: '#d03b3b', t: `Despesa recusada: ${d.tipo} de ${R$(d.valor)}`, d: d.motivo || 'Abra para corrigir e enviar de novo.', go: 'fin:lanc' });
    }
    return out;
  }
  function htmlAvisos() {
    if (!souAdmin()) return '';
    const l = avisos().filter(a => a.id.startsWith('cta-') || a.id.startsWith('orc-') || a.id.startsWith('ctr-fim-'));
    if (!l.length) return '';
    return `<div class="fin-avisos">${l.slice(0, 4).map(a => `<button class="fin-aviso" data-f="aba" data-aba="${a.go.split(':')[1]}"><i class="dot" style="background:${a.cor}"></i><span><b>${esc(a.t)}</b><small>${esc(a.d)}</small></span></button>`).join('')}${l.length > 4 ? `<span class="muted">e mais ${l.length - 4}</span>` : ''}</div>`;
  }
  function abrir(aba) { if (aba) { F.aba = aba; if (aba === 'lanc' && souAdmin()) { F.status = 'Pendente'; F.per = 'tudo'; } salvarPref(); } if (location.hash === '#campo') { celular(); return; } if (location.hash !== '#financeiro') location.hash = 'financeiro'; else render(); }

  // ---------- Reembolsos (gastos com dinheiro próprio, diárias e km rodado) ----------
  function htmlReemb(p) {
    const adm = souAdmin(), c = CFG();
    const pessoas = new Map();
    for (const d of despesas()) {
      if (!reembolsavel(d) || d.status === 'Recusada') continue;
      const em = String(d.usuario || '').toLowerCase();
      if (!adm && em !== meuEmail().toLowerCase() && em !== 'local') continue;
      if (!pessoas.has(em)) pessoas.set(em, { em, apagar: [], pend: [], pago: [] });
      const x = pessoas.get(em), st = d.status || 'Pendente';
      if (st === 'Aprovada') x.apagar.push(d); else if (st === 'Pendente') x.pend.push(d); else if (st === 'Reembolsada' && noPer(d.reembolsado_em || d.data, p)) x.pago.push(d);
    }
    const soma = l => l.reduce((a, d) => a + n(d.valor), 0);
    const ls = [...pessoas.values()].filter(x => x.apagar.length || x.pend.length || x.pago.length).sort((a, b) => soma(b.apagar) - soma(a.apagar));
    const tot = ls.reduce((a, x) => a + soma(x.apagar), 0), totP = ls.reduce((a, x) => a + soma(x.pend), 0), totR = ls.reduce((a, x) => a + soma(x.pago), 0);
    const comp = l => { const o = { 'Diária': 0, 'Km rodado': 0, gasto: 0 }; for (const d of l) { if (d.tipo === 'Diária') o['Diária'] += n(d.valor); else if (d.tipo === 'Km rodado') o['Km rodado'] += n(d.valor); else o.gasto += n(d.valor); } return o; };
    return `<div class="tiles fin-tiles"><div class="tile"><span class="lbl">A reembolsar (aprovado)</span><span class="val num">${R$(tot)}</span><span class="sub">${I().fmtInt(ls.filter(x => x.apagar.length).length)} pessoa(s)</span></div>
        <div class="tile"><span class="lbl">Aguardando aprovação</span><span class="val num">${R$(totP)}</span><span class="sub">entra no reembolso depois de aprovado</span></div>
        <div class="tile"><span class="lbl">Reembolsado no período</span><span class="val num">${R$(totR)}</span><span class="sub">${esc(filtroTxt().split(' · ')[0])}</span></div>
        <div class="tile"><span class="lbl">Valores combinados</span><span class="val num fin-val-s">${c.valor_diaria ? R$(c.valor_diaria) + '<small>/diária</small>' : '—'}<br>${c.valor_km ? R$(c.valor_km) + '<small>/km</small>' : '—'}</span><span class="sub">${adm ? '<button class="lnk" data-f="ajustes">Alterar</button>' : 'definidos pelo administrador'}</span></div></div>
      <p class="muted fin-p">Entram no reembolso as diárias, o km rodado com carro próprio e as despesas pagas com <b>dinheiro ou Pix próprio</b>. Depois de aprovadas pelo administrador, aparecem aqui como "a reembolsar".</p>
      <div class="fin-reembs">${ls.map(x => { const a = comp(x.apagar); return `<article class="fin-rb">
        <header><span class="avatar sm">${esc(nomePessoa(x.em).slice(0, 2).toUpperCase())}</span><b>${esc(nomePessoa(x.em))}</b><span class="v num">${R$(soma(x.apagar))}</span></header>
        <dl><div><dt>Diárias</dt><dd>${R0(a['Diária'])}</dd></div><div><dt>Km rodado</dt><dd>${R0(a['Km rodado'])}</dd></div><div><dt>Gastos próprios</dt><dd>${R0(a.gasto)}</dd></div><div><dt>Aguardando</dt><dd>${R0(soma(x.pend))}</dd></div></dl>
        <footer><span class="muted">${x.apagar.length} item(ns) aprovado(s) · reembolsado no período ${R0(soma(x.pago))}</span><span class="fin-vb"><button class="btn small" data-f="reemb-recibo" data-id="${esc(x.em)}">${I().icon('pdf')} Recibo</button>${adm && x.apagar.length ? `<button class="btn small primary" data-f="reemb-pagar" data-id="${esc(x.em)}">Marcar como pago</button>` : ''}</span></footer></article>`; }).join('') || '<p class="empty">Nenhum reembolso pendente. Lance diárias, km rodado ou despesas pagas com dinheiro próprio.</p>'}</div>`;
  }
  async function reciboPDF(em) {
    try { await lib('jspdf'); await lib('autotable'); } catch (e) { I().toast('Não foi possível gerar o PDF. Verifique a internet.'); return; }
    const p = periodo();
    let l = despesas().filter(d => String(d.usuario || '').toLowerCase() === em && reembolsavel(d) && d.status === 'Aprovada'), titulo = 'Recibo de reembolso (a pagar)';
    if (!l.length) { l = despesas().filter(d => String(d.usuario || '').toLowerCase() === em && reembolsavel(d) && d.status === 'Reembolsada' && noPer(d.reembolsado_em || d.data, p)); titulo = 'Recibo de reembolso (pago)'; }
    if (!l.length) { I().toast('Nada para reembolsar.'); return; }
    l.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth(), M = 14;
    const lg = logo(); if (lg) doc.addImage(lg.url, 'PNG', M, M, 48, 48 * lg.h / lg.w);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(32, 30, 30); doc.text(titulo, W - M, M + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(100, 106, 95); doc.text(nomePessoa(em) + ' · emitido em ' + fd(I().today()), W - M, M + 10, { align: 'right' });
    doc.setDrawColor(94, 129, 69); doc.setLineWidth(0.7); doc.line(M, M + 15, W - M, M + 15);
    const tot = l.reduce((a, d) => a + n(d.valor), 0);
    doc.autoTable({ startY: M + 20, margin: { left: M, right: M }, head: [['Data', 'Tipo', 'Detalhe', 'Fazenda', 'Valor']], body: l.map(d => [fd(d.data), d.tipo, descr(d), fazendasDe(d).map(id => (I().get('fazendas', id) || {}).nome || '').join(', '), R$(d.valor)]).concat([['', '', '', 'Total', R$(tot)]]),
      styles: { fontSize: 8.5, cellPadding: 1.6 }, headStyles: { fillColor: [94, 129, 69] }, columnStyles: { 4: { halign: 'right' } } });
    let y = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(10); doc.setTextColor(32, 30, 30);
    doc.text(doc.splitTextToSize(`Declaro ${titulo.includes('pago') ? 'que recebi' : 'que tenho a receber'} da InovaAgro Consultoria Agrícola o valor de ${R$(tot)} referente às despesas acima.`, W - 2 * M), M, y);
    y += 26; doc.line(M, y, M + 80, y); doc.line(W - M - 80, y, W - M, y);
    doc.setFontSize(8.5); doc.setTextColor(100, 106, 95); doc.text(nomePessoa(em), M, y + 5); doc.text('InovaAgro Consultoria Agrícola', W - M - 80, y + 5);
    doc.save(('recibo-reembolso-' + nomePessoa(em) + '-' + I().today()).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').toLowerCase() + '.pdf');
  }

  // ---------- Contas a pagar e a receber (honorários dos clientes) ----------
  const CAT_REC = ['Honorários de consultoria', 'Visita técnica avulsa', 'Projeto / laudo / receituário', 'Análises de solo ou folha', 'Outra receita'];
  const CAT_PAG = ['Salários e encargos', 'Aluguel', 'Impostos', 'Seguro', 'IPVA / licenciamento', 'Financiamento de veículo', 'Software e assinaturas', 'Telefone e internet', 'Fornecedor', 'Outra despesa fixa'];
  function situacaoConta(c) {
    if (c.pago_em) return { l: c.tipo === 'Receber' ? 'Recebida' : 'Paga', cls: 'ok' };
    if (!c.vencimento) return { l: 'Em aberto', cls: 'info' };
    const dias = Math.round((new Date(c.vencimento + 'T12:00:00') - new Date(I().today() + 'T12:00:00')) / 864e5);
    if (dias < 0) return { l: 'Vencida há ' + -dias + (dias === -1 ? ' dia' : ' dias'), cls: 'bad', venc: true };
    if (dias <= 3) return { l: dias === 0 ? 'Vence hoje' : 'Vence em ' + dias + (dias === 1 ? ' dia' : ' dias'), cls: 'warn' };
    return { l: 'Em aberto', cls: 'info' };
  }
  function htmlContas(p) {
    const cf = F.cf || 'abertas', todas = contas(), ctr = F.ctr ? contratos().find(x => String(x.id) === F.ctr) : null;
    const l = todas.filter(c => !ctr || String(c.contrato_id) === String(ctr.id)).filter(c => cf === 'abertas' ? !c.pago_em : cf === 'receber' ? c.tipo === 'Receber' && noPer(c.vencimento, p) : cf === 'pagar' ? c.tipo === 'Pagar' && noPer(c.vencimento, p) : noPer(c.vencimento, p))
      .sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || '')));
    const soma = f => todas.filter(f).reduce((a, c) => a + n(c.valor), 0);
    const recA = soma(c => c.tipo === 'Receber' && !c.pago_em), pagA = soma(c => c.tipo === 'Pagar' && !c.pago_em);
    const recV = todas.filter(c => c.tipo === 'Receber' && situacaoConta(c).venc), pagV = todas.filter(c => c.tipo === 'Pagar' && situacaoConta(c).venc);
    const recP = soma(c => c.tipo === 'Receber' && c.pago_em && noPer(c.pago_em, p)), pagP = soma(c => c.tipo === 'Pagar' && c.pago_em && noPer(c.pago_em, p));
    const quem = c => c.tipo === 'Receber' ? ((I().get('produtores', c.produtor_id) || {}).nome || (I().get('fazendas', c.fazenda_id) || {}).nome || '—') : (c.fornecedor || '—');
    return `<div class="fin-vh"><button class="btn primary" data-f="conta-nova" data-tipo="Receber">${svg(IC.mais)}Conta a receber</button><button class="btn" data-f="conta-nova" data-tipo="Pagar">${svg(IC.mais)}Conta a pagar</button><span class="muted">Honorários e outras receitas dos clientes, e custos fixos da empresa (aluguel, salários, impostos). Gastos de campo da equipe ficam em Lançamentos.</span></div>
      <div class="tiles fin-tiles">
        <div class="tile fin-t ok"><span class="lbl">A receber em aberto</span><span class="val num">${R$(recA)}</span><span class="sub">${recV.length ? `<b class="fin-bad">${recV.length} vencida(s) · ${R0(recV.reduce((a, c) => a + n(c.valor), 0))}</b>` : 'nenhuma vencida'}</span></div>
        <div class="tile fin-t ok"><span class="lbl">Recebido no período</span><span class="val num">${R$(recP)}</span><span class="sub">${esc(filtroTxt().split(' · ')[0])}</span></div>
        <div class="tile fin-t bad"><span class="lbl">A pagar em aberto</span><span class="val num">${R$(pagA)}</span><span class="sub">${pagV.length ? `<b class="fin-bad">${pagV.length} vencida(s)</b>` : 'nenhuma vencida'}</span></div>
        <div class="tile fin-t bad"><span class="lbl">Pago no período</span><span class="val num">${R$(pagP)}</span><span class="sub">contas a pagar quitadas</span></div>
        <div class="tile"><span class="lbl">Saldo previsto</span><span class="val num">${R$(recA - pagA)}</span><span class="sub">a receber − a pagar em aberto</span></div></div>
      ${ctr ? `<div class="fin-ctr-flt">Mostrando só as cobranças do contrato <b>${esc(nomeCli(ctr.produtor_id))}</b> · ${esc(ctr.descricao || '')} <button class="lnk" data-f="ctr-limpar">Ver todas as contas</button></div>` : ''}
      <div class="seg fin-cf" role="group" aria-label="Mostrar">${[['abertas', 'Em aberto'], ['todas', 'Vencimento no período'], ['receber', 'A receber'], ['pagar', 'A pagar']].map(([k, t]) => `<button data-f="contas-flt" data-v="${k}" aria-pressed="${cf === k}">${t}</button>`).join('')}</div>
      <div class="table-wrap fin-tab fin-ctab"><table><thead><tr><th>Vencimento</th><th>Tipo</th><th>Descrição</th><th>Cliente / fornecedor</th><th>Situação</th><th class="r">Valor</th><th></th></tr></thead><tbody>
      ${l.map(c => { const st = situacaoConta(c); return `<tr class="click" data-f="conta" data-id="${esc(c.id)}"><td class="dt">${fd(c.vencimento)}</td><td class="tp"><span class="pill ${c.tipo === 'Receber' ? 'ok' : ''}">${c.tipo === 'Receber' ? 'A receber' : 'A pagar'}</span></td>
        <td class="ds">${esc(c.descricao || '')}<small>${esc([c.categoria, c.parcela, c.contrato_id ? 'gerada pelo contrato' : ''].filter(Boolean).join(' · '))}</small></td><td class="fz">${esc(quem(c))}</td><td class="sx"><span class="pill ${st.cls}">${esc(st.l)}</span>${c.pago_em ? `<small class="muted"> em ${fd(c.pago_em)}</small>` : ''}</td>
        <td class="r vl num"><b class="${c.tipo === 'Receber' ? '' : 'fin-neg'}">${c.tipo === 'Receber' ? '' : '− '}${R$(c.valor)}</b></td><td class="cp">${c.pago_em ? '' : `<button class="btn small" data-f="conta-baixa" data-id="${esc(c.id)}">${c.tipo === 'Receber' ? 'Recebi' : 'Paguei'}</button>`}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Nenhuma conta neste filtro.</td></tr>'}
      </tbody></table></div>`;
  }
  function formConta(rec, def) {
    const novo = !rec;
    const c = Object.assign({ vencimento: I().today() }, def || {}, rec || {});
    const prods = S().data.produtores.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).map(x => [x.id, x.nome]);
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    const montar = () => {
      const rc = c.tipo === 'Receber', fz = S().data.fazendas.filter(f => !rc || !c.produtor_id || String(f.produtor_id) === String(c.produtor_id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => [f.id, f.nome]);
      return `<div class="modal fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-ct"><header><h2 id="fin-ct">${novo ? (rc ? 'Nova conta a receber' : 'Nova conta a pagar') : (rc ? 'Conta a receber' : 'Conta a pagar')}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
        <div class="fin-seg fin-seg2" role="radiogroup" aria-label="Tipo de conta">${[['Receber', 'A receber', 'fk3'], ['Pagar', 'A pagar', 'fk2']].map(([k, l, cl]) => `<button type="button" role="radio" data-ctipo="${k}" aria-checked="${c.tipo === k}"><i class="fin-qi ${cl}">${svg(k === 'Receber' ? '<path d="M12 19V5M5 12l7 7 7-7"/>' : '<path d="M12 5v14M5 12l7-7 7 7"/>')}</i>${l}</button>`).join('')}</div>
        <form novalidate>
          ${campo('Descrição', inp('descricao', c.descricao, `required placeholder="${rc ? 'Ex.: Honorários de consultoria — novembro' : 'Ex.: Aluguel do escritório'}"`), 'full')}
          ${campo('Categoria', sel('categoria', rc ? CAT_REC : CAT_PAG, c.categoria))}${campo('Valor (R$)', numInp('valor', c.valor, 'required'), 'fin-valor')}
          ${rc ? campo('Cliente (produtor)', sel('produtor_id', prods, c.produtor_id, 'Selecione…')) : campo('Fornecedor / favorecido', inp('fornecedor', c.fornecedor))}
          ${campo(rc ? 'Fazenda (opcional)' : 'Ligada a cliente / fazenda (opcional)', sel('fazenda_id', rc ? fz : S().data.fazendas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => [f.id, f.nome]), c.fazenda_id, 'Nenhuma'))}
          ${campo('Vencimento', `<input type="date" name="vencimento" value="${esc(c.vencimento || '')}" required>`)}${campo(rc ? 'Recebido em' : 'Pago em', `<input type="date" name="pago_em" value="${esc(c.pago_em || '')}">`)}
          ${campo('Forma', sel('forma', ['Pix', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque'], c.forma))}
          ${novo ? campo('Repetir todo mês', sel('repetir', [['1', 'Não repetir'], ['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['24', '24 meses']], '1', null)) : ''}
          ${campo('Observações', `<textarea name="obs">${esc(c.obs || '')}</textarea>`, 'full')}
        </form>
        <footer>${novo ? '' : '<button class="btn danger" data-del>Excluir</button>'}<div class="right"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar</button></div></footer></div>`;
    };
    const ler = () => { const o = {}; for (const el of $('form', bg).elements) if (el.name) o[el.name] = el.value; return o; };
    bg.innerHTML = montar(); document.body.appendChild(bg);
    bg.addEventListener('change', e => { if (e.target.name === 'produtor_id') { Object.assign(c, ler()); bg.innerHTML = montar(); } });
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return bg.remove();
      const tb = e.target.closest('[data-ctipo]'); if (tb) { Object.assign(c, ler(), { tipo: tb.dataset.ctipo, categoria: '' }); bg.innerHTML = montar(); return; }
      if (e.target.closest('[data-del]')) { if (!confirm('Excluir esta conta?')) return; await I().Store.remove('contas', rec.id).then(() => { I().toast('Conta excluída.'); bg.remove(); }).catch(() => {}); return; }
      if (e.target.closest('[data-save]')) {
        const v = ler();
        if (!v.descricao || !(nn(v.valor) > 0) || !v.vencimento) { I().toast('Preencha descrição, valor e vencimento.'); return; }
        const base = Object.assign({}, rec || {}, { tipo: c.tipo });
        for (const [k, x] of Object.entries(v)) if (k !== 'repetir') base[k] = k === 'valor' ? nn(x) : x || null;
        if (base.tipo === 'Receber') delete base.fornecedor; else delete base.produtor_id;
        if (base.fazenda_id && !base.produtor_id && base.tipo === 'Receber') base.produtor_id = (I().get('fazendas', base.fazenda_id) || {}).produtor_id || null;
        const vezes = novo ? Math.max(1, Number(v.repetir) || 1) : 1, grupo = vezes > 1 ? I().newId() : null;
        try {
          for (let i = 0; i < vezes; i++) {
            const o = Object.assign({}, base, { id: novo ? I().newId() : rec.id });
            if (vezes > 1) { const [y, m, dd] = v.vencimento.split('-').map(Number); const dt = new Date(y, m - 1 + i, 1), ult = new Date(y, m + i, 0).getDate(); o.vencimento = iso(new Date(dt.getFullYear(), dt.getMonth(), Math.min(dd, ult))); o.parcela = `${i + 1}/${vezes}`; o.grupo = grupo; if (i > 0) o.pago_em = null; }
            await I().Store.save('contas', o);
          }
        } catch (er) { return; }
        bg.remove(); I().toast(vezes > 1 ? `${vezes} contas criadas (uma por mês).` : 'Conta salva.');
      }
    });
  }

  // ---------- Contratos dos clientes: geram a conta a receber de cada mês ----------
  const nomeCli = id => (I().get('produtores', id) || {}).nome || 'Cliente removido';
  const mesMais = (m, k) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const nomeMesRef = m => new Date(m + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const vencDe = (m, dia) => { const [y, mm] = m.split('-').map(Number); const ult = new Date(y, mm, 0).getDate(); return m + '-' + String(Math.min(Math.max(1, n(dia) || 10), ult)).padStart(2, '0'); };
  function situacaoContrato(k) {
    const hoje = I().today();
    if (k.status === 'Encerrado') return { l: 'Encerrado', cls: '' };
    if (k.status === 'Suspenso') return { l: 'Suspenso', cls: 'warn' };
    if (k.inicio && k.inicio > hoje) return { l: 'Começa em ' + fd(k.inicio), cls: 'info' };
    if (k.fim && k.fim < hoje) return { l: 'Vencido em ' + fd(k.fim), cls: 'bad' };
    return { l: 'Ativo', cls: 'ok' };
  }
  // Cria as cobranças que faltam: do mês "gerar a partir de" até o mês que vem. O id é fixo por contrato e mês,
  // então dois aparelhos nunca criam a mesma cobrança duas vezes. Uma cobrança excluída à mão não volta.
  let gerando = false;
  async function gerarCobrancas() {
    if (gerando || !souAdmin() || !S().data.contas) return;
    const limite = mesMais(mesAtual(), 1), novos = [], atualiza = [];
    for (const k of contratos()) {
      if (k.status === 'Encerrado' || k.status === 'Suspenso' || !(n(k.valor) > 0) || !k.produtor_id) continue;
      let m = k.ultimo_gerado ? mesMais(k.ultimo_gerado, 1) : (k.gerar_desde || mesAtual());
      if (k.inicio && m < k.inicio.slice(0, 7)) m = k.inicio.slice(0, 7);
      const fim = k.fim && k.fim.slice(0, 7) < limite ? k.fim.slice(0, 7) : limite;
      let ult = k.ultimo_gerado || '';
      for (let i = 0; m <= fim && i < 36; i++, m = mesMais(m, 1)) {
        const id = 'ctr-' + k.id + '-' + m, venc = vencDe(m, k.dia);
        ult = m;
        if ((k.inicio && venc < k.inicio) || (k.fim && venc > k.fim) || I().get('contas', id)) continue;
        novos.push({ id, tipo: 'Receber', categoria: 'Honorários de consultoria', descricao: (k.descricao || 'Honorários de consultoria') + ' — ' + nomeMesRef(m), valor: n(k.valor), vencimento: venc, produtor_id: k.produtor_id, fazenda_id: k.fazenda_id || null, forma: k.forma || null, contrato_id: k.id, mes_ref: m });
      }
      if (ult && ult !== k.ultimo_gerado) atualiza.push(Object.assign({}, k, { ultimo_gerado: ult }));
    }
    if (!novos.length && !atualiza.length) return;
    gerando = true;
    try { for (const o of novos) await I().Store.save('contas', o); for (const k of atualiza) await I().Store.save('contas', k); if (novos.length) I().toast(novos.length === 1 ? '1 cobrança de contrato criada em Contas a receber.' : novos.length + ' cobranças de contratos criadas em Contas a receber.'); }
    catch (e) { console.warn('contratos', e); } finally { gerando = false; }
  }
  function htmlContratos() {
    const ks = contratos().slice().sort((a, b) => nomeCli(a.produtor_id).localeCompare(nomeCli(b.produtor_id), 'pt-BR'));
    const ativos = ks.filter(k => situacaoContrato(k).l === 'Ativo'), mensal = ativos.reduce((a, k) => a + n(k.valor), 0);
    const cobr = id => contas().filter(c => String(c.contrato_id) === String(id));
    const abertas = ks.flatMap(k => cobr(k.id)).filter(c => !c.pago_em), vencidas = abertas.filter(c => situacaoConta(c).venc);
    const prox = abertas.filter(c => !situacaoConta(c).venc).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0];
    return `<div class="fin-vh"><button class="btn primary" data-f="contrato-novo">${svg(IC.mais)}Novo contrato</button><span class="muted">Cadastre o honorário mensal de cada cliente. Todo mês o app cria sozinho a conta a receber, com o vencimento no dia combinado, e avisa quando ela vence.</span></div>
      <div class="tiles fin-tiles">
        <div class="tile fin-t ok"><span class="lbl">Contratos ativos</span><span class="val num">${I().fmtInt(ativos.length)}</span><span class="sub">${ks.length - ativos.length ? I().fmtInt(ks.length - ativos.length) + ' encerrado(s) ou suspenso(s)' : 'todos os cadastrados'}</span></div>
        <div class="tile fin-t ok"><span class="lbl">Receita mensal contratada</span><span class="val num">${R$(mensal)}</span><span class="sub">${R0(mensal * 12)} por ano</span></div>
        <div class="tile"><span class="lbl">Próxima cobrança</span><span class="val num fin-val-s">${prox ? R$(prox.valor) : '—'}</span><span class="sub">${prox ? esc(nomeCli(prox.produtor_id)) + ' · ' + fd(prox.vencimento) : 'nenhuma em aberto'}</span></div>
        <div class="tile fin-t bad"><span class="lbl">Cobranças vencidas</span><span class="val num">${R$(vencidas.reduce((a, c) => a + n(c.valor), 0))}</span><span class="sub">${vencidas.length ? `<b class="fin-bad">${vencidas.length} sem receber</b>` : 'nenhuma vencida'}</span></div></div>
      ${ks.length ? `<div class="table-wrap fin-tab fin-ctr"><table><thead><tr><th>Cliente</th><th>Descrição</th><th class="r">Valor mensal</th><th>Vencimento</th><th>Vigência</th><th>Situação</th><th>Cobranças</th></tr></thead><tbody>
      ${ks.map(k => { const st = situacaoContrato(k), cs = cobr(k.id), ab = cs.filter(c => !c.pago_em), vc = ab.filter(c => situacaoConta(c).venc);
        return `<tr class="click" data-f="contrato" data-id="${esc(k.id)}"><td class="fz"><b>${esc(nomeCli(k.produtor_id))}</b>${k.fazenda_id ? `<small>${esc((I().get('fazendas', k.fazenda_id) || {}).nome || '')}</small>` : ''}</td>
          <td class="ds">${esc(k.descricao || 'Honorários de consultoria')}${k.forma ? `<small>${esc(k.forma)}</small>` : ''}</td><td class="r vl num"><b>${R$(k.valor)}</b></td>
          <td class="dt">todo dia ${esc(String(n(k.dia) || 10))}</td><td class="dt">${fd(k.inicio)} – ${k.fim ? fd(k.fim) : 'sem prazo'}</td><td class="sx"><span class="pill ${st.cls}">${esc(st.l)}</span></td>
          <td class="cp"><button class="btn small" data-f="contrato-contas" data-id="${esc(k.id)}">${I().fmtInt(cs.length)} gerada(s)${vc.length ? ` · <b class="fin-bad">${vc.length} vencida(s)</b>` : ab.length ? ` · ${ab.length} em aberto` : ''}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="fin-vazio">${svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>')}<p><b>Nenhum contrato cadastrado.</b><br>Cadastre o honorário mensal de cada cliente e o app passa a gerar a cobrança de todo mês sozinho.</p><button class="btn primary" data-f="contrato-novo">${svg(IC.mais)}Cadastrar o primeiro contrato</button></div>`}`;
  }
  function formContrato(rec) {
    const novo = !rec;
    const k = Object.assign({ descricao: 'Honorários de consultoria', dia: 10, inicio: I().today(), gerar_desde: mesAtual(), status: 'Ativo', forma: 'Pix' }, rec || {});
    const prods = S().data.produtores.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')).map(x => [x.id, x.nome]);
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    const montar = () => {
      const fz = S().data.fazendas.filter(f => !k.produtor_id || String(f.produtor_id) === String(k.produtor_id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => [f.id, f.nome]);
      const ger = contas().filter(c => String(c.contrato_id) === String(k.id));
      return `<div class="modal fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-kt"><header><h2 id="fin-kt">${novo ? 'Novo contrato' : 'Contrato'}</h2><button class="x" data-close aria-label="Fechar">×</button></header>
        <form novalidate>
          ${campo('Cliente (produtor)', sel('produtor_id', prods, k.produtor_id, 'Selecione…', 'required'))}${campo('Fazenda (opcional)', sel('fazenda_id', fz, k.fazenda_id, 'Todas do cliente'))}
          ${campo('Descrição', inp('descricao', k.descricao, 'placeholder="Ex.: Consultoria agronômica mensal"'), 'full')}
          ${campo('Honorário mensal (R$)', numInp('valor', k.valor, 'required placeholder="Ex.: 2500"'), 'fin-valor')}${campo('Dia do vencimento', `<input type="number" inputmode="numeric" min="1" max="31" step="1" name="dia" value="${esc(String(k.dia ?? ''))}" required>`)}
          ${campo('Início do contrato', `<input type="date" name="inicio" value="${esc(k.inicio || '')}" required>`)}${campo('Fim do contrato (opcional)', `<input type="date" name="fim" value="${esc(k.fim || '')}">`)}
          ${novo ? campo('Gerar cobranças a partir de', `<input type="month" name="gerar_desde" value="${esc(k.gerar_desde || '')}">`) : campo('Situação', sel('status', ['Ativo', 'Suspenso', 'Encerrado'], k.status, null))}
          ${campo('Forma de pagamento', sel('forma', ['Pix', 'Boleto', 'Transferência', 'Dinheiro', 'Cheque'], k.forma))}
          ${campo('Observações', `<textarea name="obs" placeholder="Ex.: reajuste pelo IGP-M em janeiro">${esc(k.obs || '')}</textarea>`, 'full')}
          <p class="full fin-ajuda">${novo ? 'O app cria a conta a receber de cada mês sozinho, a partir do mês escolhido acima, sempre com um mês de antecedência.' : `Já foram geradas ${I().fmtInt(ger.length)} cobrança(s). Se mudar o valor ou o dia, as cobranças deste mês em diante que ainda não foram recebidas são atualizadas.`}</p>
        </form>
        <footer>${novo ? '' : '<button class="btn danger" data-del>Excluir</button>'}<div class="right"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar</button></div></footer></div>`;
    };
    const ler = () => { const o = {}; for (const el of $('form', bg).elements) if (el.name) o[el.name] = el.value; return o; };
    bg.innerHTML = montar(); document.body.appendChild(bg);
    bg.addEventListener('change', e => { if (e.target.name === 'produtor_id') { Object.assign(k, ler(), { fazenda_id: '' }); bg.innerHTML = montar(); } });
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return bg.remove();
      if (e.target.closest('[data-del]')) {
        if (!confirm('Excluir este contrato? As cobranças já geradas continuam em Contas a receber.')) return;
        await I().Store.remove('contas', rec.id).then(() => { I().toast('Contrato excluído.'); bg.remove(); }).catch(() => {}); return;
      }
      if (!e.target.closest('[data-save]')) return;
      const v = ler();
      if (!v.produtor_id || !(nn(v.valor) > 0) || !(n(v.dia) >= 1 && n(v.dia) <= 31) || !v.inicio) { I().toast('Preencha cliente, honorário, dia do vencimento (1 a 31) e início.'); return; }
      if (v.fim && v.fim < v.inicio) { I().toast('O fim do contrato é antes do início.'); return; }
      const o = Object.assign({}, rec || {}, { id: rec ? rec.id : I().newId(), kind: 'contrato', produtor_id: v.produtor_id, fazenda_id: v.fazenda_id || null, descricao: v.descricao || 'Honorários de consultoria', valor: nn(v.valor), dia: Math.round(n(v.dia)), inicio: v.inicio, fim: v.fim || null, forma: v.forma || null, obs: v.obs || null, status: v.status || (rec ? rec.status : 'Ativo') || 'Ativo' });
      if (novo) o.gerar_desde = v.gerar_desde || mesAtual();
      try {
        await I().Store.save('contas', o);
        if (!novo) { // atualiza as cobranças ainda não recebidas, deste mês em diante
          const mes = mesAtual();
          for (const c of contas().filter(c => String(c.contrato_id) === String(o.id) && !c.pago_em && (c.mes_ref || '') >= mes)) {
            const venc = vencDe(c.mes_ref, o.dia);
            if ((o.fim && venc > o.fim) || o.status === 'Encerrado') continue;
            if (c.valor !== o.valor || c.vencimento !== venc || c.produtor_id !== o.produtor_id) await I().Store.save('contas', Object.assign({}, c, { valor: o.valor, vencimento: venc, produtor_id: o.produtor_id, fazenda_id: o.fazenda_id, descricao: o.descricao + ' — ' + nomeMesRef(c.mes_ref) }));
          }
        }
      } catch (er) { return; }
      bg.remove(); I().toast(novo ? 'Contrato salvo. As cobranças aparecem em Contas a receber.' : 'Contrato atualizado.');
      gerarCobrancas();
    });
  }

  // ---------- Lucro por cliente e por fazenda ----------
  // Receitas: contas a receber com vencimento no período. Despesas: gastos da equipe (rateados por fazenda) + contas a pagar ligadas ao cliente.
  function lucroDados(p) {
    const cli = new Map(), get = id => { const k = id || '_geral'; if (!cli.has(k)) cli.set(k, { id: k, nome: id ? ((I().get('produtores', id) || {}).nome || 'Cliente removido') : 'Geral da empresa (sem cliente)', rec: 0, desp: 0, pag: 0, faz: new Map() }); return cli.get(k); };
    const gf = (x, fid) => { if (!x.faz.has(fid)) x.faz.set(fid, { id: fid, nome: (I().get('fazendas', fid) || {}).nome || 'Fazenda removida', rec: 0, desp: 0, pag: 0 }); return x.faz.get(fid); };
    const prodDe = fid => { const f = I().get('fazendas', fid); return f ? f.produtor_id : null; };
    for (const c of contas()) {
      if (!noPer(c.vencimento, p)) continue;
      const pid = c.produtor_id || (c.fazenda_id ? prodDe(c.fazenda_id) : null), x = get(pid), k = c.tipo === 'Receber' ? 'rec' : 'pag';
      x[k] += n(c.valor); if (c.fazenda_id) gf(x, String(c.fazenda_id))[k] += n(c.valor);
    }
    for (const d of despesas()) {
      if (!noPer(d.data, p) || d.status === 'Recusada') continue;
      const ps = partes(d);
      if (!ps.length) { get(null).desp += n(d.valor); continue; }
      for (const [fid, v] of ps) { const x = get(prodDe(fid)); x.desp += v; gf(x, fid).desp += v; }
    }
    const linhas = [...cli.values()].filter(x => x.id !== '_geral').sort((a, b) => (b.rec - b.desp - b.pag) - (a.rec - a.desp - a.pag));
    const geral = cli.get('_geral') || { id: '_geral', nome: 'Geral da empresa (sem cliente)', rec: 0, desp: 0, pag: 0, faz: new Map() };
    const tot = [...cli.values()].reduce((a, x) => ({ rec: a.rec + x.rec, desp: a.desp + x.desp, pag: a.pag + x.pag }), { rec: 0, desp: 0, pag: 0 });
    return { linhas: geral.rec || geral.desp || geral.pag ? linhas.concat([geral]) : linhas, tot };
  }
  function htmlLucro(p) {
    const { linhas, tot } = lucroDados(p), res = tot.rec - tot.desp - tot.pag;
    const mx = Math.max(1, ...linhas.map(x => Math.abs(x.rec - x.desp - x.pag)));
    const margem = (r, l) => r ? `<span class="pill ${l >= 0 ? 'ok' : 'bad'}">${dec(l / r * 100, 0)}%</span>` : '<span class="muted">—</span>';
    const barra = l => `<span class="fin-div"><i class="${l >= 0 ? 'pos' : 'neg'}" style="width:${(Math.abs(l) / mx * 50).toFixed(1)}%"></i></span>`;
    const linha = (x, sub) => { const l = x.rec - x.desp - x.pag; return `<tr class="${sub ? 'fin-sub' : 'click'}" ${sub ? '' : `data-f="lucro-cli" data-id="${esc(x.id)}"`}><td>${sub ? '' : `<span class="fin-car ${F.lucroAberto === x.id ? 'on' : ''}">›</span>`}${esc(x.nome)}</td><td class="r num">${x.rec ? R$(x.rec) : '—'}</td><td class="r num">${x.desp ? R$(x.desp) : '—'}</td><td class="r num">${x.pag ? R$(x.pag) : '—'}</td><td class="r num"><b class="${l < 0 ? 'fin-neg' : ''}">${R$(l)}</b></td><td>${barra(l)}</td><td class="r">${margem(x.rec, l)}</td></tr>`; };
    return `<div class="tiles fin-tiles">
        <div class="tile fin-t ok"><span class="lbl">Receitas</span><span class="val num">${R$(tot.rec)}</span><span class="sub">contas a receber no período</span></div>
        <div class="tile fin-t bad"><span class="lbl">Despesas</span><span class="val num">${R$(tot.desp + tot.pag)}</span><span class="sub">equipe ${R0(tot.desp)} · contas ${R0(tot.pag)}</span></div>
        <div class="tile"><span class="lbl">Resultado</span><span class="val num ${res < 0 ? 'fin-neg' : ''}">${R$(res)}</span><span class="sub">${tot.rec ? 'margem ' + dec(res / tot.rec * 100, 0) + '%' : 'sem receitas no período'}</span></div></div>
      <p class="muted fin-p">Receitas: contas a receber com vencimento no período. Despesas da equipe: lançamentos do período, divididos entre as fazendas visitadas. Clique no cliente para ver por fazenda. Despesas sem fazenda ficam em "Geral da empresa".</p>
      <div class="table-wrap fin-lucro"><table><thead><tr><th>Cliente</th><th class="r">Receitas</th><th class="r">Despesas da equipe</th><th class="r">Contas a pagar</th><th class="r">Lucro</th><th aria-label="Gráfico do lucro"></th><th class="r">Margem</th></tr></thead><tbody>
      ${linhas.map(x => linha(x) + (F.lucroAberto === x.id ? [...x.faz.values()].sort((a, b) => b.desp - a.desp).map(f => linha(f, true)).join('') || '<tr class="fin-sub"><td colspan="7" class="muted">Sem fazendas ligadas.</td></tr>' : '')).join('') || '<tr><td colspan="7" class="empty">Nada no período. Cadastre os honorários em "Contas a pagar e receber" e ligue as despesas às fazendas.</td></tr>'}
      </tbody>${linhas.length ? `<tfoot><tr><td>Total</td><td class="r num">${R$(tot.rec)}</td><td class="r num">${R$(tot.desp)}</td><td class="r num">${R$(tot.pag)}</td><td class="r num"><b>${R$(res)}</b></td><td></td><td class="r">${margem(tot.rec, res)}</td></tr></tfoot>` : ''}</table></div>`;
  }

  // ---------- Ajustes (administrador): valores de diária e km, orçamento mensal ----------
  function formAjustes() {
    const c = CFG(), o = ORC();
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal fin-modal" role="dialog" aria-modal="true" aria-labelledby="fin-aj"><header><h2 id="fin-aj">Ajustes do financeiro</h2><button class="x" data-close aria-label="Fechar">×</button></header>
      <form novalidate>
        <p class="full fin-h4">Reembolso do funcionário</p>
        ${campo('Valor da diária (R$)', numInp('valor_diaria', c.valor_diaria, 'placeholder="Ex.: 80"'))}${campo('Valor por km com carro próprio (R$)', numInp('valor_km', c.valor_km, 'placeholder="Ex.: 1,20"'))}
        <p class="full fin-h4">Orçamento mensal <small class="muted">(deixe vazio para não acompanhar)</small></p>
        ${TIPOS.map(t => campo(TIPO_INFO[t].plural + ' (R$/mês)', numInp('orc_' + t, o[t]))).join('')}
        ${campo('Total do mês (R$)', numInp('orc_total', o.total), 'full')}
      </form>
      <footer><div class="right"><button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar</button></div></footer></div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return bg.remove();
      if (!e.target.closest('[data-save]')) return;
      const el = $('form', bg).elements, orc = {};
      for (const t of TIPOS) { const v = nn(el['orc_' + t].value); if (v) orc[t] = v; }
      const tt = nn(el.orc_total.value); if (tt) orc.total = tt;
      try { const cc = Object.assign({}, c, { id: 'financeiro', valor_diaria: nn(el.valor_diaria.value), valor_km: nn(el.valor_km.value) }); delete cc.orcamento; await I().Store.save('config', cc); await I().Store.save('config', { id: 'financeiro_orcamento', orcamento: orc }); } catch (er) { return; }
      bg.remove(); I().toast('Ajustes salvos.');
    });
  }

  // ---------- No celular (modo campo): abre a mesma tela em tela cheia ----------
  let cel = null, celPai = null;
  function celular() {
    const sec = document.getElementById('v-financeiro'); if (!sec) return;
    if (!cel) { cel = document.createElement('div'); cel.className = 'fin-cel'; document.body.appendChild(cel); cel.addEventListener('click', e => { if (e.target.closest('[data-fin-fechar]')) fecharCelular(); }); }
    cel.innerHTML = `<header class="fin-cel-h"><button class="icon-btn" data-fin-fechar aria-label="Voltar">${svg(IC.voltar)}</button><h1>Despesas e veículos</h1><span></span></header>`;
    celPai = sec.parentNode; cel.appendChild(sec); sec.hidden = false; cel.hidden = false;
    document.body.classList.add('fin-cel-on'); view(true);
  }
  function fecharCelular() {
    const sec = document.getElementById('v-financeiro');
    if (sec && celPai) { sec.hidden = true; celPai.appendChild(sec); }
    if (cel) cel.hidden = true; document.body.classList.remove('fin-cel-on');
  }

  // Liga a tela ao app
  if (window.INOVA) {
    I().VIEWS.financeiro = view;
    document.addEventListener('inova:dados', () => { if (ativo()) render(); });
    window.addEventListener('online', () => setTimeout(enviarComprovantes, 1500));
    document.addEventListener('inova:pronto', () => { contarPend().then(() => { if (Env.n) enviarComprovantes(); }); });
    setInterval(() => { if (Env.n) enviarComprovantes(); }, 90000);
  }
  return { view, celular, fecharCelular, enviarComprovantes, avisos, abrir, OCR };
})();
