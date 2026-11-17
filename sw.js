// Service worker: guarda o app e o conteúdo geral para funcionar offline. Nunca guarda dados da pessoa.
const VERSAO = 'ler-livre-v24';
const BASE = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'js/app.js', 'js/dom.js', 'js/voz.js', 'js/db.js', 'js/mediadora.js',
  'conteudo/trilha.json', 'conteudo/letras.json', 'conteudo/vocabulario.json', 'conteudo/frases.json', 'conteudo/silabas-fala.json',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-maskable-512.png'
];

// As etapas são lidas da própria trilha: acrescentar uma etapa não exige mexer aqui.
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    await c.addAll(BASE);
    const trilha = await (await c.match('conteudo/trilha.json')).json();
    await c.addAll(trilha.etapas.filter(x => x.arquivo).map(x => x.arquivo));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Usa o que está guardado e atualiza em segundo plano para a próxima abertura.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSAO).then(async c => {
    const guardado = await c.match(req, { ignoreSearch: true });
    const rede = fetch(req).then(r => { if (r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => guardado);
    return guardado || rede;
  }));
});
