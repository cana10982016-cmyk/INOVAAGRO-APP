/* INOVAAGRO — Backup dos dados (só administrador).
   1) No banco: toda segunda às 6h o Supabase guarda uma cópia de todas as tabelas (supabase/05_backup.sql), 8 cópias.
   2) No computador: uma vez por semana, ao abrir o site no computador, o app baixa uma cópia completa (.json) para a pasta Downloads.
   As duas cópias podem ser restauradas por aqui. */
window.Backup = (function () {
  'use strict';
  const I = () => window.INOVA;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => I().esc(s);
  const LS = 'inovaagro.backup.v1';
  const B = { auto: true, ultimo: '', lista: null, erro: '', faltaSQL: false, carregando: false };
  try { Object.assign(B, JSON.parse(localStorage.getItem(LS) || '{}'), { lista: null }); } catch (e) { }
  const salvar = () => { try { localStorage.setItem(LS, JSON.stringify({ auto: B.auto, ultimo: B.ultimo })); } catch (e) { } };
  const nuvem = () => I().Store.mode === 'supabase' && I().SB.cli;
  const dh = d => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('pt-BR') + ' ' + x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const kb = n => n == null ? '—' : n > 1024 ? (n / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : n + ' KB';
  const dias = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : 1e9;

  // ---------- Cópia completa a partir dos dados carregados no app ----------
  function copiaAtual() {
    const all = { tipo: 'backup-inovaagro', gerado_em: new Date().toISOString(), por: I().SB.user ? I().SB.user.email : 'local' };
    for (const k of I().KINDS) all[k] = (I().S.data[k] || []).map(r => { const c = Object.assign({}, r); delete c._prod; return c; });
    return all;
  }
  async function baixarArquivo(nome, obj) {
    const json = JSON.stringify(obj);
    try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: nome, data: json }); return true; } } catch (e) { if (e && e.code) return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); return true;
  }
  async function copiaComputador(auto) {
    const ok = await baixarArquivo('inovaagro-backup-' + I().today() + '.json', copiaAtual());
    if (!ok) return;
    B.ultimo = new Date().toISOString(); salvar();
    I().toast(auto ? 'Backup semanal salvo na pasta Downloads do computador.' : 'Cópia salva na pasta Downloads.');
    render();
  }
  // Automático: administrador, no computador, uma vez por semana
  function talvezAutomatico() {
    if (!B.auto || !I() || !I().ehAdmin() || I().S.papel !== 'admin') return;
    if (matchMedia('(max-width: 760px)').matches || !navigator.onLine || dias(B.ultimo) < 7) return;
    if (!(I().S.data.talhoes || []).length) return;
    setTimeout(() => copiaComputador(true), 4000);
  }

  // ---------- Backups no banco ----------
  async function carregar() {
    if (!nuvem()) return;
    B.carregando = true; render();
    const r = await I().SB.cli.from('backups').select('id,criado_em,origem,tabelas,registros,tamanho_kb').order('criado_em', { ascending: false }).limit(20);
    B.carregando = false;
    if (r.error) { B.faltaSQL = /backups|relation|does not exist|schema cache/i.test(r.error.message || ''); B.erro = B.faltaSQL ? '' : r.error.message; B.lista = []; }
    else { B.faltaSQL = false; B.erro = ''; B.lista = r.data || []; }
    render();
  }
  async function fazerAgora(btn) {
    btn.disabled = true; btn.textContent = 'Fazendo backup…';
    const r = await I().SB.cli.rpc('fazer_backup', { p_origem: 'manual' });
    if (r.error) I().toast('Não foi possível: ' + (r.error.message || r.error)); else I().toast('Backup feito e guardado no banco.');
    carregar();
  }
  async function dadosDoBanco(id) {
    const r = await I().SB.cli.from('backups').select('criado_em,dados').eq('id', id).single();
    if (r.error) throw r.error;
    const out = { tipo: 'backup-inovaagro', gerado_em: r.data.criado_em };
    for (const [k, rows] of Object.entries(r.data.dados || {})) out[k] = k === 'membros' ? rows : rows.map(x => Object.assign({}, x.dados, { id: x.dados && x.dados.id != null ? x.dados.id : x.id }));
    return out;
  }
  async function restaurar(obj, quando) {
    const kinds = I().KINDS.filter(k => Array.isArray(obj[k]) && obj[k].length);
    if (!kinds.length) { I().toast('Este arquivo não tem dados do aplicativo.'); return; }
    const n = kinds.reduce((a, k) => a + obj[k].length, 0);
    const txt = prompt(`Restaurar ${n.toLocaleString('pt-BR')} registros do backup de ${quando}?\n\nO que foi apagado volta e o que foi alterado depois dessa data volta a ficar como estava. O que foi criado depois continua.\n\nPara confirmar, digite RESTAURAR`);
    if ((txt || '').trim().toUpperCase() !== 'RESTAURAR') { I().toast('Restauração cancelada.'); return; }
    try {
      for (const k of kinds) { I().toast('Restaurando ' + k + '…'); await I().SB.upsert(k, obj[k]); }
      I().toast(n.toLocaleString('pt-BR') + ' registros restaurados. Recarregando…'); setTimeout(() => location.reload(), 1500);
    } catch (e) { I().toast('Falhou ao restaurar: ' + (e.message || e)); }
  }

  // ---------- Tela ----------
  let root = null;
  function view(first) {
    root = $('#v-backup'); if (!root) return;
    if (!root.dataset.ready) {
      root.dataset.ready = 1;
      root.addEventListener('click', clique);
      root.addEventListener('change', e => { if (e.target.id === 'bk-auto') { B.auto = e.target.checked; salvar(); I().toast(B.auto ? 'Cópia semanal no computador ligada.' : 'Cópia semanal no computador desligada.'); } if (e.target.id === 'bk-file') arquivo(e.target); });
    }
    if (first || B.lista == null) carregar();
    render();
  }
  function render() {
    if (!root || !document.body.contains(root)) return;
    const ult = B.lista && B.lista[0];
    const proxima = (() => { const d = new Date(); const add = (8 - d.getDay()) % 7 || (d.getHours() >= 6 ? 7 : 0); d.setDate(d.getDate() + add); return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }); })();
    root.innerHTML = `<div class="page bk"><div class="page-head"><div><h2>Backup dos dados</h2><p>Cópias de segurança de tudo o que está no sistema, guardadas fora do app.</p></div></div>
      <div class="bk-grid">
        <section class="card-box bk-card"><div class="bk-ic">${I().icon('backup')}</div><div><h3>No banco de dados, toda segunda às 6h</h3>
          <p class="muted">O servidor copia todas as tabelas sozinho, mesmo com o app fechado. Ficam as 8 cópias mais recentes (2 meses).</p></div>
          ${!nuvem() ? '<div class="note">Disponível quando o sistema está ligado ao banco de dados (site publicado).</div>'
            : B.faltaSQL ? `<div class="note"><b>Falta ativar.</b> Rode uma vez o arquivo <code>supabase/05_backup.sql</code> no editor SQL do Supabase (SQL Editor &gt; New query &gt; colar &gt; Run). Depois volte aqui.</div>`
            : `<div class="bk-st ${ult && dias(ult.criado_em) <= 8 ? 'ok' : 'warn'}"><b>${ult ? 'Último backup: ' + dh(ult.criado_em) : B.carregando ? 'Carregando…' : 'Nenhum backup ainda'}</b><span>Próximo automático: ${proxima}, 6h</span></div>
              ${B.erro ? `<p class="muted">${esc(B.erro)}</p>` : ''}
              <div class="bk-acts"><button class="btn primary" data-bk="agora">Fazer backup agora</button></div>`}
        </section>
        <section class="card-box bk-card"><div class="bk-ic bk-ic2">${I().icon('computador')}</div><div><h3>No seu computador, toda semana</h3>
          <p class="muted">Ao abrir o site no computador, uma vez por semana, o app salva um arquivo com todos os dados na pasta <b>Downloads</b>. Guarde também num pen drive ou no Google Drive.</p></div>
          <label class="bk-tg"><input type="checkbox" id="bk-auto" role="switch" ${B.auto ? 'checked' : ''}><span>Salvar a cópia semanal automaticamente</span></label>
          <div class="bk-st ${dias(B.ultimo) <= 8 ? 'ok' : 'warn'}"><b>${B.ultimo ? 'Última cópia neste computador: ' + dh(B.ultimo) : 'Nenhuma cópia neste computador ainda'}</b><span>${B.ultimo ? 'Próxima: ' + new Date(new Date(B.ultimo).getTime() + 7 * 864e5).toLocaleDateString('pt-BR') : 'A primeira é feita ao abrir o site'}</span></div>
          <div class="bk-acts"><button class="btn" data-bk="pc">${I().icon('download')}Baixar cópia agora</button></div>
        </section>
      </div>
      ${nuvem() && !B.faltaSQL && B.lista && B.lista.length ? `<section class="card-box"><h3>Backups guardados no banco <small>${B.lista.length} cópia(s)</small></h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th class="r">Registros</th><th class="r">Tamanho</th><th></th></tr></thead><tbody>
        ${B.lista.map(b => `<tr><td>${dh(b.criado_em)}</td><td><span class="pill ${b.origem === 'manual' ? 'info' : 'ok'}">${esc(b.origem === 'manual' ? 'Feito à mão' : 'Automático')}</span></td><td class="r num">${(b.registros || 0).toLocaleString('pt-BR')}</td><td class="r num">${kb(b.tamanho_kb)}</td>
          <td class="r bk-row-acts"><button class="btn small" data-bk="baixar" data-id="${b.id}">Baixar</button><button class="btn small ghost" data-bk="restaurar" data-id="${b.id}">Restaurar</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}
      <section class="card-box bk-rest"><h3>Restaurar de um arquivo</h3><p class="muted">Escolha um arquivo de backup salvo no computador (inovaagro-backup-….json) para recuperar dados apagados ou alterados por engano.</p>
        <div class="bk-acts"><label class="btn">Escolher arquivo<input type="file" id="bk-file" accept=".json,application/json" hidden></label></div></section></div>`;
  }
  async function arquivo(inp) {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    let obj; try { obj = JSON.parse(await f.text()); } catch (e) { I().toast('Arquivo inválido.'); return; }
    if (!nuvem()) { I().toast('Restaurar só funciona com o sistema ligado ao banco.'); return; }
    restaurar(obj, obj.gerado_em ? dh(obj.gerado_em) : f.name);
  }
  async function clique(e) {
    const b = e.target.closest('[data-bk]'); if (!b) return;
    const a = b.dataset.bk;
    try {
      if (a === 'agora') return fazerAgora(b);
      if (a === 'pc') return copiaComputador(false);
      if (a === 'baixar') { b.disabled = true; const o = await dadosDoBanco(b.dataset.id); await baixarArquivo('inovaagro-backup-banco-' + String(o.gerado_em).slice(0, 10) + '.json', o); b.disabled = false; return; }
      if (a === 'restaurar') { const o = await dadosDoBanco(b.dataset.id); return restaurar(o, dh(o.gerado_em)); }
    } catch (err) { b.disabled = false; I().toast('Não foi possível: ' + (err.message || err)); }
  }

  if (window.INOVA) {
    I().VIEWS.backup = view;
    document.addEventListener('inova:pronto', () => setTimeout(talvezAutomatico, 3000));
  }
  return { view, copiaAtual };
})();
