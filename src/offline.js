/* INOVAAGRO offline: guarda uma cópia dos dados no aparelho (IndexedDB) e uma fila
   de alterações feitas sem internet, que é enviada ao Supabase quando a conexão volta. */
window.GlebaOffline = (function () {
  'use strict';
  const NOME = 'inovaagro-offline', VERSAO = 1;
  let aberto = null;
  function abrir() {
    if (!aberto) aberto = new Promise((ok, falha) => {
      const r = indexedDB.open(NOME, VERSAO);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('copia'); d.createObjectStore('fila'); };
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
    limpar: () => Promise.all([op('copia', 'readwrite', s => s.clear()), op('fila', 'readwrite', s => s.clear())]),
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
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)));
}
