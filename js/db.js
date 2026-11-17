// Progresso e dados da pessoa: só no aparelho (IndexedDB). Sem IndexedDB, cai para a memória.
const NOME = 'ler-livre';
const memoria = { config: new Map(), progresso: new Map(), palavras: new Map() };
let proxId = 1;
let abertura = null;

function abrir() {
  if (!abertura) {
    abertura = new Promise(resolve => {
      try {
        const r = indexedDB.open(NOME, 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          d.createObjectStore('config');
          d.createObjectStore('progresso');
          d.createObjectStore('palavras', { keyPath: 'id', autoIncrement: true });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return abertura;
}

async function pedir(loja, modo, fn) {
  const db = await abrir();
  if (!db) return undefined;
  return new Promise(resolve => {
    try {
      const req = fn(db.transaction(loja, modo).objectStore(loja));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

async function ler(loja, chave) {
  const db = await abrir();
  return db ? pedir(loja, 'readonly', s => s.get(chave)) : memoria[loja].get(chave);
}
async function gravar(loja, chave, valor) {
  const db = await abrir();
  if (db) await pedir(loja, 'readwrite', s => s.put(valor, chave));
  else memoria[loja].set(chave, valor);
}

export const getConfig = chave => ler('config', chave);
export const setConfig = (chave, valor) => gravar('config', chave, valor);
export const getProgresso = chave => ler('progresso', chave);
export const setProgresso = (chave, valor) => gravar('progresso', chave, valor);

export async function listarPalavras() {
  const db = await abrir();
  const lista = db ? await pedir('palavras', 'readonly', s => s.getAll()) : [...memoria.palavras.values()];
  return (lista || []).sort((a, b) => a.id - b.id);
}
export async function salvarPalavra(p) {
  const db = await abrir();
  if (db) return pedir('palavras', 'readwrite', s => s.put(p));
  if (!p.id) p.id = proxId++;
  memoria.palavras.set(p.id, p);
}
export async function removerPalavra(id) {
  const db = await abrir();
  if (db) await pedir('palavras', 'readwrite', s => s.delete(id));
  else memoria.palavras.delete(id);
}

export async function zerarProgresso() {
  const db = await abrir();
  if (db) await pedir('progresso', 'readwrite', s => s.clear());
  else memoria.progresso.clear();
  await setConfig('estado', { etapa: 1, indice: 0 });
  await setConfig('concluidas', []);
  await setConfig('testes', []);
}

export async function listarProgresso() {
  const db = await abrir();
  if (!db) return Object.fromEntries(memoria.progresso);
  return new Promise(resolve => {
    const saida = {};
    try {
      const c = db.transaction('progresso', 'readonly').objectStore('progresso').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { saida[cur.key] = cur.value; cur.continue(); } else resolve(saida); };
      c.onerror = () => resolve(saida);
    } catch { resolve(saida); }
  });
}
