/* INOVAAGRO — Escolher várias fazendas (usado nos relatórios).
   Campo que abre uma lista com busca e caixinhas; no celular abre por baixo da tela.
   Nada marcado = todas as fazendas da lista. */
window.EscFaz = (function () {
  'use strict';
  const I = () => window.INOVA;
  const esc = s => I().esc(s);
  const k = id => String(id);
  const semAc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const CHK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m7 10 5 5 5-5"/></svg>';
  const LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>';

  function info(f) {
    const ts = I().S.talPorFaz.get(k(f.id)) || [];
    return { n: ts.length, ha: ts.reduce((a, t) => a + (Number(t.area_ha) || 0), 0) };
  }
  function rotulo(fazs, sel) {
    const s = sel.filter(id => fazs.some(f => k(f.id) === id));
    if (!s.length) return { t: 'Todas as fazendas', sub: fazs.length + (fazs.length === 1 ? ' fazenda' : ' fazendas'), todas: true };
    if (s.length === 1) return { t: (I().get('fazendas', s[0]) || {}).nome || 'Fazenda', sub: '1 de ' + fazs.length };
    return { t: s.length + ' fazendas', sub: 'de ' + fazs.length };
  }

  /* montar(caixa, { fazs: [...], sel: [...ids], mudar: ids => {}, agrupar: bool })
     Desenha o campo e as etiquetas das fazendas escolhidas. "mudar" só é chamado ao fechar a lista. */
  function montar(box, o) {
    if (!box) return;
    const fazs = o.fazs.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const sel = (o.sel || []).map(k).filter(id => fazs.some(f => k(f.id) === id));
    const r = rotulo(fazs, sel);
    box.classList.add('ef');
    box.innerHTML = `<button type="button" class="ef-campo" aria-haspopup="dialog"><span class="ef-txt"><b>${esc(r.t)}</b>${r.todas ? '' : `<small>${esc(r.sub)}</small>`}</span>${SETA}</button>`;
    if (o.chips) {
      const c = o.chips;
      c.classList.add('ef-chips');
      c.hidden = !sel.length;
      c.innerHTML = sel.length ? sel.map(id => `<span class="ef-chip">${esc((I().get('fazendas', id) || {}).nome || 'Fazenda')}<button type="button" data-ef-tirar="${esc(id)}" aria-label="Tirar ${esc((I().get('fazendas', id) || {}).nome || '')}">×</button></span>`).join('') + `<button type="button" class="ef-limpar" data-ef-limpar>Voltar para todas</button>` : '';
      c.onclick = e => {
        const t = e.target.closest('[data-ef-tirar]'); if (t) { o.mudar(sel.filter(id => id !== t.dataset.efTirar)); return; }
        if (e.target.closest('[data-ef-limpar]')) o.mudar([]);
      };
    }
    box.querySelector('.ef-campo').onclick = () => abrir(box, fazs, sel, o);
  }

  let aberto = null;
  function fechar(aplicar) {
    if (!aberto) return;
    const a = aberto; aberto = null;
    document.removeEventListener('keydown', a.tecla, true);
    document.removeEventListener('mousedown', a.fora, true);
    a.btn && a.btn.setAttribute('aria-expanded', 'false');
    a.pn.classList.add('saindo'); a.fundo && a.fundo.classList.add('saindo');
    setTimeout(() => { a.pn.remove(); a.fundo && a.fundo.remove(); }, 160);
    if (aplicar) {
      const novo = [...a.marc], antes = a.sel;
      if (novo.length !== antes.length || novo.some(id => !antes.includes(id))) a.o.mudar(novo.length === a.fazs.length ? [] : novo);
    }
  }

  function abrir(box, fazs, sel, o) {
    if (aberto) { fechar(true); return; }
    const cel = window.matchMedia('(max-width: 700px)').matches;
    const marc = new Set(sel);
    const prods = new Set(fazs.map(f => k(f.produtor_id)));
    const agrupar = o.agrupar !== false && prods.size > 1;
    const infos = new Map(fazs.map(f => [k(f.id), info(f)]));
    let busca = '';
    const pn = document.createElement('div');
    pn.className = 'ef-pn' + (cel ? ' cel' : '');
    pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-label', 'Escolher fazendas');
    pn.innerHTML = `${cel ? '<span class="ef-alca"></span><div class="ef-tit"><b>Escolher fazendas</b><small>Marque uma ou mais. Sem nenhuma marcada, entram todas.</small></div>' : ''}
      <div class="ef-busca">${LUPA}<input type="search" placeholder="Buscar fazenda, cidade ou produtor" aria-label="Buscar fazenda"></div>
      <div class="ef-atalhos"><button type="button" data-ef="todas">Marcar todas</button><button type="button" data-ef="nenhuma">Desmarcar</button><span class="ef-cont"></span></div>
      <div class="ef-lista" role="listbox" aria-multiselectable="true"></div>
      <footer><span class="ef-resumo"></span><button type="button" class="btn primary" data-ef="ok">Pronto</button></footer>`;
    let fundo = null;
    if (cel) { fundo = document.createElement('div'); fundo.className = 'ef-fundo'; document.body.appendChild(fundo); fundo.onclick = () => fechar(true); }
    document.body.appendChild(pn);
    if (!cel) {
      const bx = box.getBoundingClientRect(), w = Math.max(bx.width, 360);
      const left = Math.min(Math.max(8, bx.left), window.innerWidth - w - 8);
      const abaixo = window.innerHeight - bx.bottom;
      pn.style.width = w + 'px'; pn.style.left = left + 'px';
      if (abaixo < 380 && bx.top > abaixo) { pn.style.bottom = (window.innerHeight - bx.top + 6) + 'px'; pn.style.maxHeight = Math.min(480, bx.top - 16) + 'px'; }
      else { pn.style.top = (bx.bottom + 6) + 'px'; pn.style.maxHeight = Math.min(480, abaixo - 16) + 'px'; }
    }
    const lista = pn.querySelector('.ef-lista');
    const visiveis = () => fazs.filter(f => !busca || semAc([f.nome, f.municipio, (I().get('produtores', f.produtor_id) || {}).nome].join(' ')).includes(busca));
    const resumo = () => {
      const ha = [...marc].reduce((a, id) => a + (infos.get(id) || { ha: 0 }).ha, 0);
      pn.querySelector('.ef-resumo').innerHTML = marc.size ? `<b>${marc.size}</b> ${marc.size === 1 ? 'fazenda' : 'fazendas'} · ${I().fmtHa0(ha)} ha` : `<b>Todas</b> as ${fazs.length} fazendas`;
      pn.querySelector('.ef-cont').textContent = busca ? visiveis().length + ' encontrada(s)' : '';
    };
    const linha = f => { const id = k(f.id), x = infos.get(id), on = marc.has(id);
      return `<button type="button" class="ef-item${on ? ' on' : ''}" role="option" aria-selected="${on}" data-id="${esc(id)}"><span class="ef-cx">${CHK}</span><span class="ef-nm"><b>${esc(f.nome)}</b><small>${[f.municipio, x.n + (x.n === 1 ? ' talhão' : ' talhões')].filter(Boolean).map(esc).join(' · ')}</small></span><span class="ef-ha num">${I().fmtHa0(x.ha)} <i>ha</i></span></button>`; };
    const desenhar = () => {
      const vs = visiveis();
      if (!vs.length) { lista.innerHTML = '<p class="ef-vazio">Nenhuma fazenda com esse nome.</p>'; resumo(); return; }
      if (!agrupar) lista.innerHTML = vs.map(linha).join('');
      else {
        const g = new Map(); for (const f of vs) { const p = k(f.produtor_id); if (!g.has(p)) g.set(p, []); g.get(p).push(f); }
        lista.innerHTML = [...g.entries()].sort((a, b) => String((I().get('produtores', a[0]) || {}).nome || '').localeCompare(String((I().get('produtores', b[0]) || {}).nome || ''), 'pt-BR'))
          .map(([p, fs]) => { const todos = fs.every(f => marc.has(k(f.id)));
            return `<div class="ef-grupo"><div class="ef-gh"><span>${esc((I().get('produtores', p) || {}).nome || 'Sem produtor')}</span><button type="button" data-ef-grupo="${esc(p)}">${todos ? 'Desmarcar' : 'Marcar'} ${fs.length > 1 ? 'as ' + fs.length : ''}</button></div>${fs.map(linha).join('')}</div>`; }).join('');
      }
      resumo();
    };
    pn.addEventListener('click', e => {
      const it = e.target.closest('.ef-item');
      if (it) { const id = it.dataset.id; marc.has(id) ? marc.delete(id) : marc.add(id); it.classList.toggle('on', marc.has(id)); it.setAttribute('aria-selected', marc.has(id)); if (agrupar) desenhar(); else resumo(); return; }
      const gp = e.target.closest('[data-ef-grupo]');
      if (gp) { const fs = visiveis().filter(f => k(f.produtor_id) === gp.dataset.efGrupo), todos = fs.every(f => marc.has(k(f.id))); fs.forEach(f => todos ? marc.delete(k(f.id)) : marc.add(k(f.id))); desenhar(); return; }
      const b = e.target.closest('[data-ef]'); if (!b) return;
      if (b.dataset.ef === 'todas') { visiveis().forEach(f => marc.add(k(f.id))); desenhar(); }
      else if (b.dataset.ef === 'nenhuma') { (busca ? visiveis() : fazs).forEach(f => marc.delete(k(f.id))); desenhar(); }
      else if (b.dataset.ef === 'ok') fechar(true);
    });
    const inp = pn.querySelector('input');
    inp.addEventListener('input', () => { busca = semAc(inp.value.trim()); desenhar(); });
    const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(true); } };
    const fora = e => { if (!cel && !pn.contains(e.target) && !box.contains(e.target)) fechar(true); };
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('mousedown', fora, true);
    const btn = box.querySelector('.ef-campo'); btn.setAttribute('aria-expanded', 'true');
    aberto = { pn, fundo, btn, marc, sel, fazs, o, tecla, fora };
    desenhar();
    if (!cel) inp.focus();
  }
  window.addEventListener('hashchange', () => fechar(false));
  return { montar, fechar, rotulo };
})();
