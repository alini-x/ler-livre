// Toda fala do app passa por falar(texto). Voz do navegador, pt-BR, um pouco mais lenta.
let VELOCIDADE = 0.85;   // um pouco mais lenta que o normal; a mediadora pode ajustar
let ultimaFala = '';
let pendente = null;   // fala barrada por falta de toque do usuário (política do Android/Chrome)
let vozEscolhida = null;
let atual = null;      // guarda a fala em curso: o Chrome para de avisar o fim se ela for coletada pelo lixo
let ultimoErro = '';
let resolvedor = t => t; // troca marcadores {l:E} e {s:NHE} pela pronúncia certa (definido pelo app)

function escolherVoz() {
  const vozes = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const pt = vozes.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('pt'));
  vozEscolhida = pt.find(v => v.lang.replace('_', '-') === 'pt-BR' && v.localService) || pt.find(v => v.lang.replace('_', '-') === 'pt-BR') || pt[0] || null;
  return pt.length;
}
if (window.speechSynthesis) {
  escolherVoz();
  speechSynthesis.addEventListener?.('voiceschanged', () => { escolherVoz(); avisarSemVoz(); });
}

export function definirResolvedor(fn) { resolvedor = fn; }
export function setVelocidade(x) { const n = Number(x); if (n >= 0.5 && n <= 2) VELOCIDADE = n; }
export function getVelocidade() { return VELOCIDADE; }
export function vozesPortugues() { return window.speechSynthesis ? escolherVoz() : 0; }
export function estadoVoz() {
  return { suportado: !!window.speechSynthesis, vozes: vozesPortugues(), escolhida: vozEscolhida ? `${vozEscolhida.name} (${vozEscolhida.lang})` : null, local: vozEscolhida ? vozEscolhida.localService : true, ultimoErro };
}

// Aviso visível quando o navegador não tem voz em português.
function avisarSemVoz() {
  const el = document.getElementById('aviso-voz');
  if (el) el.hidden = vozesPortugues() > 0;
}
setTimeout(avisarSemVoz, 2500);

function dizer(texto, velocidade, resolve) {
  const u = new SpeechSynthesisUtterance(texto);
  atual = u;
  u.lang = 'pt-BR';
  u.rate = velocidade;
  u.volume = 1;
  if (vozEscolhida) u.voice = vozEscolhida;
  const fim = () => { if (atual === u) atual = null; resolve(); };
  u.onend = fim;
  u.onerror = e => {
    ultimoErro = e.error || 'erro';
    if (e.error === 'not-allowed') pendente = texto;
    fim();
  };
  speechSynthesis.speak(u);
  // alguns navegadores nunca avisam o fim; não deixa a tela esperando para sempre
  setTimeout(resolve, 1500 + texto.length * 140);
}

export function falar(texto, { velocidade = VELOCIDADE } = {}) {
  texto = resolvedor(texto || '');
  ultimaFala = texto;
  return new Promise(resolve => {
    if (!window.speechSynthesis || !texto) return resolve();
    escolherVoz();
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      // falar logo após cancelar é ignorado por alguns Chrome; espera um instante
      setTimeout(() => dizer(texto, velocidade, resolve), 80);
    } else dizer(texto, velocidade, resolve);
  });
}

export function repetir() { return falar(ultimaFala); }

// A primeira fala ao abrir o app pode ser barrada; no primeiro toque ela é dita.
addEventListener('pointerdown', () => {
  if (pendente) { const t = pendente; pendente = null; falar(t); }
}, { capture: true });
