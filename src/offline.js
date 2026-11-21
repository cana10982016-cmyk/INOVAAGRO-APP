/* INOVAAGRO offline: guarda uma cópia dos dados no aparelho (IndexedDB) e uma fila
   de alterações feitas sem internet, que é enviada ao Supabase quando a conexão volta. */
window.GlebaOffline = (function () {
  'use strict';
  const NOME = 'inovaagro-offline', VERSAO = 2;
  let aberto = null;
  function abrir() {
    if (!aberto) aberto = new Promise((ok, falha) => {
      const r = indexedDB.open(NOME, VERSAO);
      r.onupgradeneeded = () => { const d = r.result; for (const n of ['copia', 'fila', 'midia']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    });
    return aberto;
  }
  async function op(loja, modo, fn) {
    const d = await abrir();
    return new Promise((ok, falha) => {
      const t = d.transaction(loja, modo), s = t.objectStore(loja);
      let res; const req = fn(s);
      if (req) req.onsuccess = () => { res = req.result; };
      t.oncomplete = () => ok(res);
      t.onerror = t.onabort = () => falha(t.error);
    });
  }
  const chave = (k, id) => k + ':' + String(id);
  return {
    // Cópia completa dos dados (usada para abrir o app sem internet)
    salvarCopia: (base, email) => op('copia', 'readwrite', s => s.put({ base, email, em: new Date().toISOString() }, 'dados')),
    lerCopia: () => op('copia', 'readonly', s => s.get('dados')).catch(() => null),
    // Fila: uma entrada por registro (a última alteração vale)
    enfileirar: (k, obj) => op('fila', 'readwrite', s => s.put({ k, id: String(obj.id), obj, del: !!obj._del, em: obj.atualizado_em || new Date().toISOString() }, chave(k, obj.id))),
    fila: () => op('fila', 'readonly', s => s.getAll()).then(l => l || []).catch(() => []),
    // Só tira da fila se ninguém alterou o registro de novo enquanto ele era enviado
    tirar: async it => {
      const atual = await op('fila', 'readonly', s => s.get(chave(it.k, it.id)));
      if (atual && atual.em === it.em) await op('fila', 'readwrite', s => s.delete(chave(it.k, it.id)));
    },
    limpar: () => Promise.all(['copia', 'fila', 'midia'].map(n => op(n, 'readwrite', s => s.clear()))),
    // Fotos, vídeos, áudios e anexos feitos no campo, esperando envio ao armazenamento
    guardarMidia: (id, blob, meta) => op('midia', 'readwrite', s => s.put(Object.assign({ id, blob, em: new Date().toISOString() }, meta), id)),
    lerMidia: id => op('midia', 'readonly', s => s.get(id)).catch(() => null),
    listarMidia: () => op('midia', 'readonly', s => s.getAll()).then(l => l || []).catch(() => []),
    tirarMidia: id => op('midia', 'readwrite', s => s.delete(id)),
    // Aplica a fila em cima dos dados carregados
    aplicar(base, fila) {
      for (const it of fila) {
        const lista = base[it.k]; if (!lista) continue;
        const i = lista.findIndex(r => String(r.id) === it.id);
        if (it.del) { if (i >= 0) lista.splice(i, 1); }
        else if (i >= 0) lista[i] = it.obj; else lista.push(it.obj);
      }
    },
    erroDeRede: e => !navigator.onLine || /fetch|network|load failed|timed? ?out|conex/i.test(String((e && (e.message || e.details)) || e)),
  };
})();

// Instala o service worker (só no site publicado; precisa de https ou localhost)
if ('serviceWorker' in navigator && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href) && document.querySelector('link[rel=manifest]')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(r => r.update().catch(() => {})).catch(e => console.warn('sw', e)));
  // Versão nova do app instalada: recarrega uma vez sozinho, para ninguém precisar fechar e abrir de novo.
  // Se houver um formulário aberto, deixa para a próxima abertura.
  const tinhaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || document.querySelector('.modal-bg, .fin-modal')) return;
    try { if (sessionStorage.getItem('inovaagro.sw.recarregou')) return; sessionStorage.setItem('inovaagro.sw.recarregou', '1'); } catch (e) { }
    location.reload();
  });
}
