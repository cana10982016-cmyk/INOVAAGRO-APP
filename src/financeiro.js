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
  const TIPOS = ['Combustível', 'Manutenção', 'Alimentação', 'Outra'];
  const TIPO_INFO = {
    'Combustível': { cls: 'fk1', ic: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M4 10h11"/><path d="M15 8h2a2 2 0 0 1 2 2v7a1.5 1.5 0 0 0 3 0V8l-3-3"/>', plural: 'Combustível' },
    'Manutenção': { cls: 'fk2', ic: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.5-.6-.6-2.5z"/>', plural: 'Manutenção' },
    'Alimentação': { cls: 'fk3', ic: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-4 2.5-4 6v4h4"/>', plural: 'Alimentação' },
    'Outra': { cls: 'fk4', ic: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M8 15h3"/>', plural: 'Outras' },
  };
  const COMBUST = ['Gasolina', 'Etanol', 'Diesel S10', 'Diesel S500', 'GNV'];
  const MANUT = ['Troca de óleo e filtros', 'Revisão', 'Pneus', 'Freios', 'Suspensão', 'Elétrica / bateria', 'Funilaria / pintura', 'Lavagem', 'Documentação / licenciamento', 'Seguro', 'Outro'];
  const REFEICAO = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche'];
  const OUTRAS = ['Pedágio', 'Estacionamento', 'Hospedagem', 'Material de campo', 'Telefone / internet', 'Outro'];
  const PAGTO = ['Cartão da empresa', 'Dinheiro / Pix próprio (reembolsar)', 'Faturado / boleto', 'Outro'];
  const STATUS = ['Pendente', 'Aprovada', 'Reembolsada', 'Recusada'];
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
  const F = { aba: 'resumo', per: 'mes', de: '', ate: '', veic: '', func: '', tipo: '', faz: '', status: '', lim: 80, sel: new Set(), ultVeic: '' };
  try { Object.assign(F, JSON.parse(localStorage.getItem(LS) || '{}'), { sel: new Set(), lim: 80 }); } catch (e) { }
  const salvarPref = () => { try { localStorage.setItem(LS, JSON.stringify({ aba: F.aba, per: F.per, de: F.de, ate: F.ate, veic: F.veic, func: F.func, tipo: F.tipo, faz: F.faz, status: F.status, ultVeic: F.ultVeic })); } catch (e) { } };

  const S = () => I().S;
  const veiculos = () => (S().data.veiculos || []).slice().sort((a, b) => String(a.placa || '').localeCompare(String(b.placa || '')));
  const despesas = () => S().data.despesas || [];
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
  const nomePessoa = em => { if (!em) return '—'; const m = membros[String(em).toLowerCase()]; return (m && m.nome) || (em === 'local' ? 'Este aparelho' : String(em).split('@')[0]); };

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
      && (!F.tipo || d.tipo === F.tipo) && (!F.faz || String(d.fazenda_id) === F.faz) && (!F.status || (d.status || 'Pendente') === F.status));
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
    const lista = filtradas();
    const pessoas = [...new Set(despesas().map(d => String(d.usuario || '').toLowerCase()).filter(Boolean))].sort((a, b) => nomePessoa(a).localeCompare(nomePessoa(b), 'pt-BR'));
    const fazIds = [...new Set(despesas().map(d => d.fazenda_id).filter(Boolean).map(String))];
    const fazendas = fazIds.map(id => I().get('fazendas', id)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const pend = adm ? despesas().filter(d => (d.status || 'Pendente') === 'Pendente') : [];
    const aviso = S().faltaFin ? `<div class="note"><b>Falta um passo para salvar na nuvem.</b> O administrador precisa rodar uma vez o arquivo <code>supabase/04_financeiro.sql</code> no editor SQL do Supabase. Até lá, o que for lançado fica guardado neste aparelho.</div>` : '';
    const avisoFoto = Env.semBucket ? '<div class="note">As fotos dos comprovantes estão guardadas no aparelho. Para enviá-las, o administrador precisa rodar o arquivo <code>supabase/04_financeiro.sql</code> no Supabase.</div>' : '';
    const titulo = adm ? 'Despesas da equipe e custos dos veículos.' : 'Suas despesas de campo e os veículos que você usa.';
    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h2>Despesas e veículos</h2><p>${titulo}</p></div>
        <div class="head-acts">${ed ? `<button class="btn primary" data-f="novo">${svg(IC.mais)}Lançar despesa</button>` : ''}
          <button class="btn" data-f="xlsx">${I().icon('xls')} Excel</button><button class="btn" data-f="pdf">${I().icon('pdf')} PDF</button></div></div>
      ${aviso}${avisoFoto}
      ${ed ? `<div class="fin-quick" role="group" aria-label="Lançamento rápido">${TIPOS.map(t => `<button data-f="novo" data-tipo="${t}"><i class="fin-qi ${TIPO_INFO[t].cls}">${svg(TIPO_INFO[t].ic)}</i><span>${t === 'Outra' ? 'Outra despesa' : t}</span></button>`).join('')}</div>` : ''}
      <div class="fin-filtros">
        <select data-flt="per" aria-label="Período">${Object.entries(PER).map(([k, l]) => `<option value="${k}" ${F.per === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${F.per === 'custom' ? `<input type="date" data-flt="de" value="${esc(F.de)}" aria-label="De"><input type="date" data-flt="ate" value="${esc(F.ate)}" aria-label="Até">` : ''}
        <select data-flt="veic" aria-label="Veículo"><option value="">Todos os veículos</option>${veiculos().map(v => `<option value="${esc(v.id)}" ${String(v.id) === F.veic ? 'selected' : ''}>${esc(v.placa)} · ${esc(v.modelo || '')}</option>`).join('')}</select>
        ${adm || pessoas.length > 1 ? `<select data-flt="func" aria-label="Funcionário"><option value="">Toda a equipe</option>${pessoas.map(e => `<option value="${esc(e)}" ${e === F.func ? 'selected' : ''}>${esc(nomePessoa(e))}</option>`).join('')}</select>` : ''}
        <select data-flt="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${TIPOS.map(t => `<option value="${t}" ${t === F.tipo ? 'selected' : ''}>${TIPO_INFO[t].plural}</option>`).join('')}</select>
        ${fazendas.length ? `<select data-flt="faz" aria-label="Fazenda ou cliente"><option value="">Todas as fazendas</option>${fazendas.map(f => `<option value="${esc(f.id)}" ${String(f.id) === F.faz ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select>` : ''}
        <select data-flt="status" aria-label="Situação"><option value="">Qualquer situação</option>${STATUS.map(s => `<option ${s === F.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        ${F.veic || F.func || F.tipo || F.faz || F.status ? '<button class="lnk" data-f="limpar">Limpar filtros</button>' : ''}
      </div>
      ${pend.length ? `<div class="fin-pend"><span><b>${I().fmtInt(pend.length)} despesa${pend.length > 1 ? 's' : ''} esperando aprovação</b> · ${R$(pend.reduce((a, d) => a + n(d.valor), 0))}</span><button class="btn small" data-f="ver-pend">Revisar</button></div>` : ''}
      <div class="tabs" role="tablist">${[['resumo', 'Resumo'], ['lanc', 'Lançamentos'], ['veic', 'Veículos']].map(([k, l]) => `<button role="tab" data-f="aba" data-aba="${k}" aria-selected="${F.aba === k}">${l}${k === 'lanc' ? ` <span class="ct num">${I().fmtInt(lista.length)}</span>` : k === 'veic' ? ` <span class="ct num">${I().fmtInt(veiculos().length)}</span>` : ''}</button>`).join('')}</div>
      <div class="fin-body">${F.aba === 'lanc' ? htmlLanc(lista) : F.aba === 'veic' ? htmlVeic(p, lista) : htmlResumo(p, lista)}</div>
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
    const porFaz = agrupa(d => d.fazenda_id ? String(d.fazenda_id) : null, id => (I().get('fazendas', id) || {}).nome || 'Fazenda removida').slice(0, 12);
    const semFaz = lista.filter(d => !d.fazenda_id).reduce((a, d) => a + n(d.valor), 0);
    return `<div class="tiles fin-tiles">${tiles.map(([l, v, s, c]) => `<div class="tile ${c ? 'fin-t ' + c : ''}"><span class="lbl">${l}</span><span class="val num">${v}</span><span class="sub">${s}</span></div>`).join('')}</div>
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
    return [d.categoria, d.descricao].filter(Boolean).join(' · ');
  }
  function htmlLanc(lista) {
    const adm = souAdmin(), kmlPor = new Map();
    for (const v of veiculos()) for (const t of trechos(v.id)) kmlPor.set(String(t.id), t.kml);
    const ord = lista.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    const mostra = ord.slice(0, F.lim), tot = lista.reduce((a, d) => a + n(d.valor), 0);
    const sel = [...F.sel].filter(id => I().get('despesas', id));
    return `${adm && sel.length ? `<div class="fin-bulk"><b>${sel.length} selecionada(s)</b><button class="btn small" data-f="bulk" data-st="Aprovada">${svg(IC.ok)}Aprovar</button><button class="btn small" data-f="bulk" data-st="Reembolsada">Marcar reembolsada</button><button class="btn small" data-f="bulk" data-st="Recusada">Recusar</button><button class="lnk" data-f="sel-limpar">Limpar seleção</button></div>` : ''}
      <div class="table-wrap fin-tab"><table><thead><tr>${adm ? `<th class="ck"><input type="checkbox" data-f="sel-tudo" aria-label="Selecionar todas" ${mostra.length && mostra.every(d => F.sel.has(String(d.id))) ? 'checked' : ''}></th>` : ''}<th>Data</th><th>Tipo</th><th>Detalhe</th><th>Veículo</th><th>Fazenda</th>${adm ? '<th>Funcionário</th>' : ''}<th>Situação</th><th class="r">Valor</th><th aria-label="Comprovante"></th></tr></thead>
      <tbody>${mostra.map(d => {
        const v = veic(d.veiculo_id), f = I().get('fazendas', d.fazenda_id), ti = TIPO_INFO[d.tipo] || TIPO_INFO['Outra'], st = d.status || 'Pendente', k = kmlPor.get(String(d.id));
        return `<tr class="click" data-f="abrir" data-id="${esc(d.id)}">${adm ? `<td class="ck"><input type="checkbox" data-f="sel" data-id="${esc(d.id)}" ${F.sel.has(String(d.id)) ? 'checked' : ''} aria-label="Selecionar"></td>` : ''}
          <td class="dt">${fd(d.data)}</td><td class="tp"><span class="fin-tipo"><i class="sw ${ti.cls}"></i>${esc(d.tipo || 'Outra')}</span></td>
          <td class="ds">${esc(descr(d)) || '<span class="muted">—</span>'}${d.km ? `<small>${km(n(d.km))}${k ? ' · ' + dec(k) + ' km/l' : ''}</small>` : ''}</td>
          <td class="vc">${v ? `<span class="placa">${esc(v.placa)}</span>` : '<span class="muted">—</span>'}</td><td class="fz">${f ? esc(f.nome) : '<span class="muted">—</span>'}</td>
          ${adm ? `<td class="fu">${esc(nomePessoa(d.usuario))}</td>` : ''}<td class="sx"><span class="pill ${ST_CLS[st] || ''}">${esc(st)}</span></td>
          <td class="r vl num"><b>${R$(d.valor)}</b></td><td class="cp">${d.comprovante ? `<button class="icon-btn fin-clip" data-f="foto" data-id="${esc(d.id)}" aria-label="Ver comprovante" title="${d.comprovante.pend ? 'Comprovante guardado no aparelho (a enviar)' : 'Ver comprovante'}">${svg(IC.clip)}${d.comprovante.pend ? '<i class="dotp"></i>' : ''}</button>` : ''}</td></tr>`;
      }).join('') || `<tr><td colspan="${adm ? 10 : 8}" class="empty">Nenhuma despesa neste filtro.</td></tr>`}</tbody>
      ${lista.length ? `<tfoot><tr><td colspan="${adm ? 8 : 6}">Total de ${I().fmtInt(lista.length)} lançamento(s)</td><td class="r num"><b>${R$(tot)}</b></td><td></td></tr></tfoot>` : ''}</table></div>
      ${ord.length > mostra.length ? `<p style="text-align:center"><button class="btn small" data-f="mais">Mostrar mais (${I().fmtInt(ord.length - mostra.length)})</button></p>` : ''}`;
  }

  // ---------- Veículos ----------
  function htmlVeic(p, lista) {
    const vs = veiculos(), ed = I().podeEditar();
    return `<div class="fin-vh">${ed ? `<button class="btn" data-f="veic-novo">${svg(IC.mais)}Novo veículo</button>` : ''}<span class="muted">Valores do período escolhido. O consumo usa os abastecimentos com tanque cheio.</span></div>
      <div class="fin-veics">${vs.map(v => {
        const s = statsVeic(v, p, lista), rv = revisao(v), ka = kmAtual(v);
        return `<article class="fin-vc${v.ativo === 'Não' ? ' off' : ''}">
          <header><span class="placa big">${esc(v.placa)}</span><div><b>${esc([v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo')}</b><small>${esc([v.ano, v.combustivel, v.responsavel ? nomePessoa(v.responsavel) : ''].filter(Boolean).join(' · '))}</small></div>${ed ? `<button class="lnk" data-f="veic-edit" data-id="${esc(v.id)}">Editar</button>` : ''}</header>
          <dl><div><dt>Hodômetro</dt><dd class="num">${km(ka)}</dd></div><div><dt>Consumo</dt><dd class="num">${s.kml ? dec(s.kml) + ' km/l' : '—'}</dd></div><div><dt>Custo por km</dt><dd class="num">${s.cpk ? R$(s.cpk) : '—'}</dd></div>
            <div><dt>Rodou</dt><dd class="num">${km(s.rod)}</dd></div><div><dt>Combustível</dt><dd class="num">${R0(s.comb)}</dd></div><div><dt>Manutenção</dt><dd class="num">${R0(s.man)}</dd></div></dl>
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
      case 'aba': F.aba = b.dataset.aba; salvarPref(); render(); break;
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
      case 'xlsx': baixarExcel(); break;
      case 'pdf': baixarPDF(); break;
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
      } else {
        h += campo('Categoria', sel('categoria', OUTRAS, d.categoria, 'Selecione…', 'required')) + campo('Veículo (se tiver)', sel('veiculo_id', vs, d.veiculo_id, 'Nenhum'))
          + campo('Descrição', inp('descricao', d.descricao), 'full');
      }
      h += campo('Fazenda / cliente visitado', sel('fazenda_id', fz, d.fazenda_id, 'Nenhuma (despesa geral)'), 'full')
        + campo('Pagamento', sel('forma_pagamento', PAGTO, d.forma_pagamento, null));
      if (adm) h += campo('Funcionário', sel('usuario', pessoas, String(d.usuario || meuEmail()).toLowerCase(), null)) + campo('Situação', sel('status', STATUS, st0, null)) + `<label class="field full fin-mot" ${st0 === 'Recusada' ? '' : 'hidden'}><span>Motivo da recusa</span>${inp('motivo', d.motivo)}</label>`;
      else h += `<div class="field"><span>Situação</span><span class="pill ${ST_CLS[st0]}" style="justify-self:start;margin-top:6px">${esc(st0)}</span></div>`;
      h += `<div class="field full"><span>Comprovante (foto da nota ou cupom)</span><div class="fin-comp" id="fin-comp"></div></div>` + campo('Observações', `<textarea name="obs">${esc(d.obs || '')}</textarea>`, 'full');
      form.innerHTML = h;
      desenharFoto(); calc();
    }
    function desenharFoto() {
      const box = $('#fin-comp', form); if (!box) return;
      const tem = foto || (d.comprovante && !fotoRemovida);
      box.innerHTML = `${tem ? `<span class="fin-thumb">${foto && /^image/.test(foto.mime) ? `<img src="${esc(foto.prev)}" alt="Prévia do comprovante">` : svg(IC.clip)}<span>${foto ? 'Foto pronta para salvar' : d.comprovante.pend ? 'Guardado no aparelho (a enviar)' : 'Comprovante anexado'}</span>${!foto ? '<button type="button" class="btn small" data-ver>Ver</button>' : ''}<button type="button" class="lnk" data-tirar>Remover</button></span>` : ''}
        <label class="btn fin-up">${svg(IC.foto)}${tem ? 'Trocar foto' : 'Tirar foto ou escolher arquivo'}<input type="file" accept="image/*,application/pdf" hidden data-file></label>`;
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

    bg.addEventListener('input', e => { if (['litros', 'valor', 'preco_litro'].includes(e.target.name)) calc(e.target.name); else if (e.target.name === 'km') calc(); });
    bg.addEventListener('change', async e => {
      const t = e.target;
      if (t.name === 'veiculo_id') { const v = veic(t.value); if (v && form.elements.combustivel && !form.elements.combustivel.value && v.combustivel) form.elements.combustivel.value = v.combustivel; calc(); }
      if (t.name === 'tanque_cheio') calc();
      if (t.name === 'status') { const m = $('.fin-mot', form); if (m) m.hidden = t.value !== 'Recusada'; }
      if (t.matches('[data-file]') && t.files[0]) {
        const f = t.files[0];
        if (f.size > 25 * 1024 * 1024) { I().toast('Arquivo grande demais (máximo 25 MB).'); return; }
        foto = await reduzir(f); foto.prev = /^image/.test(foto.mime) ? URL.createObjectURL(foto.blob) : null; fotoRemovida = false; desenharFoto();
      }
    });
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.closest('[data-close]')) return bg.remove();
      const tb = e.target.closest('.fin-seg [data-tipo]');
      if (tb && !travada) { Object.assign(d, ler(), { tipo: tb.dataset.tipo }); if ((d.tipo === 'Combustível' || d.tipo === 'Manutenção') && !d.veiculo_id) d.veiculo_id = veicPadrao(); $$('.fin-seg [data-tipo]', bg).forEach(x => x.setAttribute('aria-checked', x === tb)); montar(); return; }
      if (e.target.closest('[data-ver]')) { verComprovante(d); return; }
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
        if (faltam.length) { I().toast('Preencha: ' + faltam.join(', ') + '.'); const el = form.elements[{ data: 'data', valor: 'valor', 'veículo': 'veiculo_id', litros: 'litros' }[faltam[0]]]; if (el) el.focus(); return; }
        const obj = Object.assign({}, rec || {}, { id: rec ? rec.id : I().newId(), tipo: d.tipo });
        for (const [k, x] of Object.entries(v)) obj[k] = ['valor', 'litros', 'preco_litro', 'km', 'pessoas'].includes(k) ? nn(x) : x || null;
        // campos que não pertencem ao tipo escolhido saem do registro
        const DO_TIPO = { 'Combustível': ['veiculo_id', 'km', 'combustivel', 'litros', 'preco_litro', 'tanque_cheio', 'posto'], 'Manutenção': ['veiculo_id', 'km', 'manutencao', 'oficina'], 'Alimentação': ['refeicao', 'pessoas', 'pessoa', 'local'], 'Outra': ['categoria', 'veiculo_id', 'descricao'] };
        for (const k of ['veiculo_id', 'km', 'combustivel', 'litros', 'preco_litro', 'tanque_cheio', 'posto', 'manutencao', 'oficina', 'refeicao', 'pessoas', 'pessoa', 'local', 'categoria', 'descricao']) if (!DO_TIPO[d.tipo].includes(k)) delete obj[k];
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
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(porGrupo(lista, d => d.fazenda_id, id => id ? (I().get('fazendas', id) || {}).nome || '' : 'Sem fazenda', 'Fazenda')), 'Por fazenda');
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
  return { view, celular, fecharCelular, enviarComprovantes };
})();
