import { falar, repetir, setVelocidade, definirResolvedor } from './voz.js';
import * as db from './db.js';
import { abrirMediadora } from './mediadora.js';
import { h } from './dom.js';

// Proteção contra moldura (a CSP em <meta> não aceita frame-ancestors): se o app for embutido em outra página, não é exibido.
if (window.top !== window.self) document.documentElement.hidden = true;

const tela = document.getElementById('tela');
const pontos = document.getElementById('progresso');
const btnInicio = document.getElementById('btn-inicio');
const ELOGIOS = ['Muito bem!', 'Isso mesmo!', 'Acertou!', 'Muito bom!'];
const ICONE_TIPO = { 'ouvir-e-tocar': '👂', montar: '🧩', ordenar: '🔀', apresentar: '👀', tracar: '✏️', ler: '🗣️', 'criar-palavras': '💡' };
const NAO_PONTUA = ['apresentar', 'tracar', 'ler', 'criar-palavras'];
const TEM_FALA_DEPOIS = ['montar', 'ordenar', 'ler'];

let baseLetras;                // nomes das letras do conteúdo (sem os ajustes feitos neste aparelho)
let ajustesSilabas = {};       // sílabas ajustadas à mão neste aparelho (forma final, valem por cima do estilo)
let estiloSilabas = 'equilibrado';
let silabasFala;
let reaisSilabas = {};          // E/O: palavra real com o som da sílaba (dê, só, vô), usada no estilo equilibrado
let trilha, letras, vocabulario, frasesBase, falasSilabas, estado, nome, etapa, atividades, indice, primeira;
let concluidas = new Set(), revisando = false, modoTeste = null;
const falhasEtapa = {};   // rodadas seguidas sem atingir o critério, por etapa (só nesta abertura do app)
const GRUPOS = [
  { g: 1, titulo: 'VOGAIS', icone: '🔤' }, { g: 2, titulo: 'MEU NOME', icone: '🪪' }, { g: 3, titulo: 'ALFABETO', icone: '🔠' }, { g: 4, titulo: 'SÍLABAS', icone: '🧩' },
  { g: 5, titulo: 'MONTAR PALAVRAS', icone: '🧱' }, { g: 6, titulo: 'PALAVRAS DA VIDA', icone: '🏡' }, { g: 7, titulo: 'FRASES', icone: '💬' }, { g: 8, titulo: 'LER E ESCREVER', icone: '✏️' }
];
let audioCtx;

/* ---------- utilidades ---------- */
const embaralhar = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sortear = a => a[Math.floor(Math.random() * a.length)];
const maiuscula = t => t.toLocaleUpperCase('pt-BR');
const cor = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const json = async url => (await fetch(url)).json();

function somAcerto() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
    });
  } catch { /* sem som, segue */ }
}

function nomeDaLetra(u) { return letras[maiuscula(u)] || u.toLowerCase(); }
// No conteúdo, a pronúncia nunca é gravada: {l:E} é o nome da letra e {s:NHE} a sílaba. Resolvido na hora de falar.
// O título aparece escrito em maiúsculas, mas é falado a partir de titulo_fala (com marcadores); sem ele, a voz soletraria "gue", "nh".
const falaTitulo = e => e.titulo_fala || e.titulo.toLowerCase();
const resolverFala = t => t.replace(/\{([sl]):([^}]+)\}/g, (_, tipo, v) => (tipo === 's' ? falaSilaba(v) : nomeDaLetra(v)));
// Estilos de pronúncia das sílabas. A voz soletra sílabas acentuadas que não são palavras ("gá" -> "g, a com acento agudo")
// e reduz E/O sem acento ("be" -> "bi"); cada voz reage de um jeito, então o estilo é uma escolha do aparelho.
const ESTILOS = {
  equilibrado: 'Equilibrado (recomendado): sem acento; E e O com palavra real quando existe (dê, só, vô)',
  'sem-acento': 'Sem acento (be, bo)',
  'com-acento': 'Com acento (bê, bô)',
  dupla: 'Sílaba repetida em todas (baba, bebe, bibi)',
  apoio: 'Com vogal de apoio e acento (abê)'
};
const SILABA_SIMPLES = /^(?:[^aeiouãõáéíóúâêô]+|qu|gu)[aeiou]$/;   // consoante(s) + uma vogal (inclui QUE, GUE...)
const ACENTO = { a: 'á', e: 'ê', i: 'i', o: 'ô', u: 'u' };
// Forma plana: sem acento agudo, grave ou circunflexo (a voz soletra sílabas acentuadas que não são palavras: MÁ, FÉ, XÍ);
// mantém til e cedilha, que mudam o som.
function formaPlana(s) {
  s = maiuscula(s);
  return (falasSilabas[s] || s.toLowerCase()).normalize('NFD').replace(/[\u0300-\u0302]/g, '').normalize('NFC');
}
function aplicarEstilo(plana, estilo = estiloSilabas) {
  if (!SILABA_SIMPLES.test(plana)) return plana;   // finais, nasais, ditongos... ficam como estão
  const v = plana.slice(-1);
  const acentuada = plana.slice(0, -1) + ACENTO[v];
  switch (estilo) {
    case 'sem-acento': return plana;
    case 'com-acento': return acentuada;
    case 'dupla': return plana + plana;
    case 'apoio': return (/^(nh|lh|rr|ss|ç|qu[ei]|gu[ei])/.test(plana) ? 'a' : '') + acentuada;
    default: return v === 'e' || v === 'o' ? reaisSilabas[plana] || plana : plana;   // equilibrado
  }
}
function falaSilaba(s) {
  s = maiuscula(s);
  return ajustesSilabas[s] || aplicarEstilo(formaPlana(s));
}
// Tira acentos e til para comparar sílabas (FÉ = FE, ÃO = AO); mantém o Ç.
const norm = t => maiuscula(t).normalize('NFD').replace(/[\u0300-\u0303]/g, '').normalize('NFC');
// Uma sílaba é conhecida se foi ensinada, ou se é uma sílaba ensinada + um final já aprendido (CAR = CA + R).
function conhecida(sil, aprendidas, finais) {
  let x = norm(sil);
  if (aprendidas.has(x)) return true;
  for (let i = 0; i < 2 && x && finais.has(x.slice(-1)); i++) { x = x.slice(0, -1); if (aprendidas.has(x)) return true; }
  return false;
}
function aprendido(n) {
  const antes = trilha.etapas.filter(e => e.n < n);
  return { sil: new Set(['A', 'E', 'I', 'O', 'U', ...antes.flatMap(e => e.silabas || []).map(norm)]), fin: new Set(antes.flatMap(e => e.finais || [])) };
}
function falaUnidade(u, tipo) {
  if (tipo === 'ordenar') return u.toLowerCase();
  return u.length === 1 ? nomeDaLetra(u) : falaSilaba(u);
}
function silabasDe(p) {
  const s = (p.silabas || '').toUpperCase().split(/[-\s·.]+/).filter(Boolean);
  return s.join('') === maiuscula(p.palavra).replace(/\s/g, '') ? s : [];
}

// Tema: segue o aparelho (claro/escuro); a mediadora pode forçar um dos dois.
function aplicarTema(t) {
  if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
  let meta = document.querySelector('meta[name=theme-color][data-dinamico]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; meta.dataset.dinamico = '1'; document.head.append(meta); }
  meta.content = t ? (t === 'escuro' ? '#140D2B' : '#5B2BC0') : (matchMedia('(prefers-color-scheme: dark)').matches ? '#140D2B' : '#5B2BC0');
}
// Rede de segurança do layout: se o texto ainda não couber no botão (tela estreita, outra fonte), a letra diminui até caber.
function encaixar(el) {
  el.style.fontSize = '';
  let tam = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 40 && el.scrollWidth > el.clientWidth + 1 && tam > 24; i++) { tam -= 2; el.style.fontSize = tam + 'px'; }
}
const encaixarCartoes = () => tela.querySelectorAll('.cartao').forEach(encaixar);
addEventListener('resize', encaixarCartoes);
let emHome = false;   // a próxima tela mostrada é o início?
let telaId = 0;       // muda a cada tela; evita falas e ações atrasadas de uma tela que já foi deixada
function mostrar(...filhos) {
  const home = emHome; emHome = false; telaId++;
  btnInicio.hidden = home;   // 🏠 aparece em toda tela, menos no próprio início
  if (!home) entrarSub();
  tela.classList.remove('alto'); tela.replaceChildren(...filhos.filter(Boolean));
}

// Navegação: o botão Voltar do Android sai da lição e volta ao início (só fecha o app quando já está no início).
function entrarSub() { if (!history.state?.sub) history.pushState({ sub: true }, ''); }
function irParaInicio() { speechSynthesis?.cancel(); if (history.state?.sub) history.back(); else telaInicio(); }
const sairDaMediadora = () => (history.state?.sub ? history.back() : iniciar());
addEventListener('popstate', () => { speechSynthesis?.cancel(); if (document.body.classList.contains('modo-med')) iniciar(); else telaInicio(); });

// Falha ao abrir algo (por exemplo, sem internet e arquivo fora do cache): nunca deixa a tela parada, sempre há saída.
function telaErro(tentarDeNovo) {
  marcarProgresso();
  mostrar(
    h('div', { class: 'figura' }, '⚠️'),
    h('p', { class: 'texto-intro' }, 'NÃO CONSEGUI ABRIR. TENTE DE NOVO OU VOLTE AO INÍCIO.'),
    h('div', { class: 'linha-botoes' }, botaoGrande('↻', 'TENTAR', tentarDeNovo), botaoGrande('⌂', 'INÍCIO', irParaInicio, 'btn-sec')));
  falar('Não consegui abrir. Toque no botão roxo para tentar de novo, ou na casa para voltar ao início.');
}
function marcarProgresso(total = 0, atual = 0) {
  pontos.replaceChildren(...Array.from({ length: total }, (_, i) => h('i', { class: i < atual ? 'feito' : i === atual ? 'atual' : '' })));
}
function botaoGrande(icone, rotulo, aoTocar, extra = '') {
  return h('button', { class: 'btn-grande ' + extra, onclick: aoTocar, 'aria-label': rotulo }, icone, h('span', { class: 'rotulo' }, rotulo));
}
const salvarEstado = () => db.setConfig('estado', estado);
const proximaEtapaDisponivel = n => trilha.etapas.find(e => e.n >= n && e.disponivel);

/* ---------- início ---------- */
async function iniciar() {
  document.body.classList.remove('modo-med');
  try { await carregar(); } catch { return telaErroInicial(); }
  telaInicio();
}

function telaErroInicial() {
  tela.replaceChildren(
    h('div', { class: 'figura' }, '⚠️'),
    h('p', { class: 'texto-intro' }, 'NÃO CONSEGUI ABRIR. TOQUE NO BOTÃO ROXO PARA TENTAR DE NOVO.'),
    botaoGrande('↻', 'TENTAR', () => location.reload()));
  falar('Não consegui abrir. Toque no botão roxo para tentar de novo.');
}

async function carregar() {
  [trilha, letras, vocabulario, frasesBase, silabasFala] = await Promise.all([json('conteudo/trilha.json'), json('conteudo/letras.json'), json('conteudo/vocabulario.json'), json('conteudo/frases.json'), json('conteudo/silabas-fala.json')]);
  falasSilabas = silabasFala.falas; reaisSilabas = silabasFala.reais || {};
  baseLetras = { ...letras };
  const locais = (await db.getConfig('pronuncias')) || {};
  Object.assign(letras, locais.letras); ajustesSilabas = { ...locais.silabas };   // ajustes feitos neste aparelho
  estiloSilabas = (await db.getConfig('estiloSilabas')) || 'equilibrado';
  definirResolvedor(resolverFala);
  estado = (await db.getConfig('estado')) || { etapa: 1, indice: 0, primeira: 0 };
  nome = await db.getConfig('nome');
  const salvas = await db.getConfig('concluidas');
  concluidas = new Set(salvas || trilha.etapas.filter(e => e.n < estado.etapa).map(e => e.n));
  aplicarTema(await db.getConfig('tema'));
  setVelocidade(await db.getConfig('velocidade'));
}

const barra = (feitas, total) => h('div', { class: 'barra', role: 'img', 'aria-label': `${feitas} de ${total}` }, h('i', { style: `width:${total ? Math.round(100 * feitas / total) : 0}%` }));
const resumoGrupo = g => { const es = trilha.etapas.filter(e => e.trilha === g); return { es, feitas: es.filter(e => concluidas.has(e.n)).length }; };

function telaInicio() {
  revisando = false; modoTeste = null; emHome = true;
  marcarProgresso();
  const alvo = proximaEtapaDisponivel(estado.etapa);
  const total = trilha.etapas.length, feitas = trilha.etapas.filter(e => concluidas.has(e.n)).length;
  const comecou = estado.etapa > 1 || estado.indice > 0 || feitas > 0;
  const saudacao = nome ? `Olá, ${nome.fala || nome.texto}! ` : 'Olá! ';
  const topo = alvo
    ? [h('div', { class: 'instrucao' }, h('span', { class: 'ico-instr' }, '👆'), h('span', {}, `TOQUE NO BOTÃO ROXO PARA ${comecou ? 'CONTINUAR' : 'COMEÇAR'}`)),
       h('div', { class: 'rotulo-etapa' }, `${alvo.icone} ${alvo.titulo}`),
       botaoGrande('▶', comecou ? 'CONTINUAR' : 'COMEÇAR', () => abrirEtapa(alvo.n))]
    : [h('div', { class: 'festa' }, '🎉'), h('h1', { class: 'titulo-grande' }, 'PARABÉNS!'),
       h('p', { class: 'texto-intro' }, 'VOCÊ TERMINOU TUDO O QUE ESTÁ PRONTO. TOQUE EM UM GRUPO ABAIXO PARA FAZER DE NOVO.')];
  const grupos = GRUPOS.map(gr => {
    const { es, feitas: f } = resumoGrupo(gr.g);
    const ok = es.length && f === es.length;
    return h('button', { class: 'grupo' + (ok ? ' feito' : '') + (alvo && alvo.trilha === gr.g ? ' atual' : ''), 'aria-label': `${gr.titulo}, ${f} de ${es.length}`, onclick: () => telaGrupo(gr.g) },
      h('span', { class: 'grupo-icone' }, gr.icone),
      h('span', { class: 'grupo-info' }, h('span', { class: 'grupo-nome' }, gr.titulo), barra(f, es.length)),
      h('span', { class: 'grupo-n' }, ok ? '✔' : `${f}/${es.length}`));
  });
  mostrar(...topo,
    h('div', { class: 'resumo' }, h('div', { class: 'resumo-texto' }, `⭐ ${feitas} DE ${total} ETAPAS FEITAS`), barra(feitas, total)),
    h('h2', { class: 'subtitulo' }, 'MEU CAMINHO'), ...grupos);
  tela.classList.add('alto');
  scrollTo(0, 0);
  falar(`${saudacao}${alvo ? `Toque no botão roxo para ${comecou ? 'continuar' : 'começar'}. Hoje: ${falaTitulo(alvo)}.` : 'Você terminou tudo o que está pronto. Toque em um grupo para fazer de novo.'} Você já fez ${feitas} de ${total} etapas.`);
}

function telaGrupo(g) {
  marcarProgresso();
  const gr = GRUPOS.find(x => x.g === g);
  const { es, feitas } = resumoGrupo(g);
  const alvo = proximaEtapaDisponivel(estado.etapa);
  const itens = es.map(e => {
    const feita = concluidas.has(e.n), atual = alvo && alvo.n === e.n;
    return h('button', { class: 'item-etapa' + (feita ? ' feito' : atual ? ' atual' : ' bloqueado'), 'aria-label': `${e.titulo}${feita ? ', feita' : atual ? ', agora' : ', ainda não, toque para fazer um teste'}`,
      onclick: () => (feita ? abrirEtapa(e.n, true) : atual ? abrirEtapa(e.n) : telaOferta(e)) },
      h('span', { class: 'item-estado' }, feita ? '✔' : atual ? '▶' : '🎯'), h('span', { class: 'item-nome' }, `${e.icone} ${e.titulo}`));
  });
  mostrar(
    h('div', { class: 'rotulo-etapa' }, `${gr.icone} ${gr.titulo}`),
    h('div', { class: 'resumo' }, h('div', { class: 'resumo-texto' }, `${feitas} DE ${es.length} FEITAS`), barra(feitas, es.length)),
    h('div', { class: 'instrucao' }, h('span', { class: 'ico-instr' }, '👆'), h('span', {}, '✔ REFAZER · ▶ AGORA · 🎯 TESTE PARA PULAR')),
    ...itens, botaoGrande('⌂', 'INÍCIO', telaInicio, 'btn-sec'));
  tela.classList.add('alto');
  scrollTo(0, 0);
  falar(`${gr.titulo.toLowerCase()}. Você fez ${feitas} de ${es.length} etapas.`);
}

/* ---------- teste para pular etapas ---------- */
function telaOferta(e) {
  marcarProgresso();
  mostrar(
    h('div', { class: 'figura' }, '🎯'),
    h('div', { class: 'rotulo-etapa' }, `${e.icone} ${e.titulo}`),
    h('p', { class: 'texto-intro' }, 'ESTA ETAPA AINDA NÃO CHEGOU. QUER FAZER UM TESTE PARA PULAR ATÉ AQUI?'),
    h('div', { class: 'linha-botoes' },
      botaoGrande('▶', 'FAZER TESTE', () => iniciarTeste(e)),
      botaoGrande('✖', 'AGORA NÃO', () => telaGrupo(e.trilha), 'btn-sec')));
  falar('Esta etapa ainda não chegou. Você quer fazer um teste para pular até aqui? Toque no botão roxo para fazer o teste.');
}

// Perguntas tiradas das etapas que faltam antes da escolhida (no máximo 10 etapas, 1 ou mais perguntas de cada).
async function montarTeste(alvo) {
  const palavras = (await db.listarPalavras()).filter(p => p.aprovada && p.palavra);
  let pre = trilha.etapas.filter(e => e.n < alvo.n && !concluidas.has(e.n));
  const amostra = pre.length > 10 ? Array.from({ length: 10 }, (_, i) => pre[Math.floor(i * pre.length / 10)]) : pre;
  const por = amostra.length >= 6 ? 1 : Math.ceil(6 / Math.max(1, amostra.length));
  const perguntas = [];
  for (const info of amostra) {
    const e = await json(info.arquivo);
    if ((e.requerNome && !nome) || (e.requerPalavras && !palavras.length)) { pre = pre.filter(p => p !== info); continue; } // não dá para testar: fica pendente
    const boas = expandir(e, palavras, info).filter(x => ['ouvir-e-tocar', 'montar', 'ordenar'].includes(x.tipo));
    const base = boas.filter(x => x.tipo === 'ouvir-e-tocar');
    perguntas.push(...embaralhar(base.length ? base : boas).slice(0, por));
  }
  return { pre, perguntas };
}

async function iniciarTeste(alvo) {
  try { await iniciarTesteInterno(alvo); } catch { telaErro(() => iniciarTeste(alvo)); }
}

async function iniciarTesteInterno(alvo) {
  const { pre, perguntas } = await montarTeste(alvo);
  modoTeste = { alvo, pre };
  revisando = false;
  etapa = { etapa: 0, titulo: 'TESTE', criterio: {} };
  atividades = perguntas; indice = 0; primeira = 0;
  if (!perguntas.length) return fimDoTeste();
  marcarProgresso();
  mostrar(
    h('div', { class: 'figura' }, '🎯'),
    h('h1', { class: 'titulo-grande' }, 'TESTE'),
    h('p', { class: 'texto-intro' }, `RESPONDA ${perguntas.length} PERGUNTAS PARA PULAR PARA: ${alvo.titulo}. SE ERRAR, NÃO TEM PROBLEMA.`),
    botaoGrande('▶', 'COMEÇAR', mostrarAtividade));
  falar(`Vamos fazer um teste com ${perguntas.length} perguntas. Se você acertar quase todas, pula para a etapa ${falaTitulo(alvo)}. Se errar, não tem problema. Toque no botão roxo para começar.`);
}

async function fimDoTeste() {
  marcarProgresso();
  const { alvo, pre } = modoTeste;
  const total = atividades.length;
  const passou = total === 0 || primeira / total >= 0.8;
  const registro = (await db.getConfig('testes')) || [];
  registro.push({ etapa: alvo.n, acertos: primeira, total, passou, quando: Date.now() });
  await db.setConfig('testes', registro);
  modoTeste = null;
  if (!passou) {
    mostrar(
      h('div', { class: 'figura' }, '💪'),
      h('p', { class: 'texto-intro' }, 'QUASE! VAMOS APRENDER JUNTOS, UM PASSO DE CADA VEZ.'),
      h('div', { class: 'linha-botoes' }, botaoGrande('↻', 'DE NOVO', () => iniciarTeste(alvo)), botaoGrande('⌂', 'INÍCIO', telaInicio, 'btn-sec')));
    return falar('Quase! Sem problema. Vamos aprender juntos, um passo de cada vez. Você pode tentar o teste de novo ou voltar ao início.');
  }
  pre.forEach(e => concluidas.add(e.n));
  await db.setConfig('concluidas', [...concluidas]);
  if (alvo.n > estado.etapa) estado = { etapa: alvo.n, indice: 0, primeira: 0 };
  await salvarEstado();
  mostrar(
    h('div', { class: 'festa' }, '🎉'),
    h('h1', { class: 'titulo-grande' }, 'VOCÊ PASSOU!'),
    h('p', { class: 'texto-intro' }, `${pre.length} ETAPAS PULADAS. AGORA: ${alvo.titulo}.`),
    botaoGrande('➜', 'PRÓXIMO', () => abrirEtapa(alvo.n)));
  somAcerto();
  falar(`Parabéns! Você passou no teste e pulou ${pre.length} etapas. Toque na seta para continuar.`);
}

function telaFinal() {
  marcarProgresso();
  mostrar(
    h('div', { class: 'festa' }, '🎉'),
    h('h1', { class: 'titulo-grande' }, 'PARABÉNS!'),
    h('p', { class: 'texto-intro' }, 'VOCÊ TERMINOU TUDO O QUE ESTÁ PRONTO.'),
    botaoGrande('⌂', 'INÍCIO', irParaInicio)
  );
  falar('Parabéns! Você terminou tudo o que já está pronto. Toque na casa para voltar ao início.');
}

/* ---------- etapas ---------- */
async function abrirEtapa(n, revisao = false) {
  try { await abrirEtapaInterno(n, revisao); } catch { telaErro(() => abrirEtapa(n, revisao)); }
}

async function abrirEtapaInterno(n, revisao) {
  revisando = revisao; modoTeste = null;
  const info = trilha.etapas.find(e => e.n === n);
  etapa = await json(info.arquivo);
  const palavras = (await db.listarPalavras()).filter(p => p.aprovada && p.palavra);
  if (etapa.requerNome && !nome) return telaSem(info, 'NOME', 'Ainda falta cadastrar o seu nome. Chame quem está ajudando.', '🪪');
  if (etapa.requerPalavras && !palavras.length) return telaSem(info, 'PALAVRAS APROVADAS', 'Ainda faltam as palavras da sua vida. Chame quem está ajudando, ou toque em pular.', '🏡');
  if (!revisao && estado.etapa !== n) estado = { etapa: n, indice: 0, primeira: 0 };
  atividades = expandir(etapa, palavras, info);
  if (!atividades.length) return irParaProxima(info.n);
  indice = revisao ? 0 : Math.min(estado.indice || 0, atividades.length - 1);
  primeira = revisao ? 0 : estado.primeira || 0;
  if (indice === 0) telaIntro(info); else mostrarAtividade();
}

function telaIntro(info) {
  marcarProgresso();
  mostrar(
    h('div', { class: 'figura' }, etapa.icone || info.icone),
    h('h1', { class: 'titulo-grande' }, etapa.titulo),
    h('p', { class: 'texto-intro' }, etapa.texto_inicial || etapa.fala_inicial),
    botaoGrande('▶', 'COMEÇAR', mostrarAtividade)
  );
  falar(etapa.fala_inicial || '');
}

function telaSem(info, falta, fala, icone) {
  marcarProgresso();
  mostrar(
    h('div', { class: 'figura' }, icone),
    h('p', { class: 'texto-intro' }, `FALTA CADASTRAR: ${falta}. CHAME QUEM ESTÁ AJUDANDO (BOTÃO ⚙ NO CANTO).`),
    h('div', { class: 'linha-botoes' },
      botaoGrande('⌂', 'INÍCIO', telaInicio, 'btn-sec'),
      botaoGrande('➜', 'PULAR', () => irParaProxima(info.n), 'btn-sec'))
  );
  falar(fala);
}

async function irParaProxima(n) {
  const prox = proximaEtapaDisponivel(n + 1);
  estado = { etapa: prox ? prox.n : n + 1, indice: 0, primeira: 0 };
  await salvarEstado();
  return prox ? abrirEtapa(prox.n) : telaFinal();
}

/* ---------- conteúdo dinâmico (nome e palavras da pessoa) ---------- */
function expandir(e, palavras, info) {
  const out = [];
  const apr = aprendido(info.n);
  for (const a of e.atividades) {
    if (!a.fonte) out.push(a);
    else if (a.fonte === 'nome') { if (nome) out.push(fonteNome(e, a)); }
    else if (a.fonte === 'nome-inicial') {
      if (nome) { const l = maiuscula(nome.texto.trim())[0]; out.push({ ...a, letra: l, fala: `Passe o dedo sobre a letra ${nomeDaLetra(l)}, a primeira do seu nome.` }); }
    }
    else if (a.fonte === 'palavras-da-pessoa') out.push(...exemplosSilaba(e, a, palavras));
    else if (a.fonte === 'palavras-da-vida') out.push(...palavrasDaVida(palavras));
    else if (a.fonte === 'frases-da-pessoa') out.push(...frasesDaPessoa(a, palavras));
    else if (a.fonte === 'vocabulario') {
      if (a.tipo === 'criar-palavras') { const c = criarPalavras(a, palavras, apr); if (c) out.push(c); }
      else out.push(...doVocabulario(a, info, apr));
    }
    else if (a.fonte === 'frases') out.push(...frasesDoApp(a));
  }
  return out;
}

function fonteNome(e, a) {
  const texto = maiuscula(nome.texto.trim());
  const falaNome = nome.fala || texto.toLowerCase();
  if (a.tipo === 'ouvir-e-tocar') {
    const outros = embaralhar((e.distratores || []).filter(d => d !== texto && d[0] !== texto[0])).slice(0, 2);
    return { ...a, opcoes: [texto, ...outros], correta: texto, falaDepois: falaNome };
  }
  return { ...a, palavra: texto, falaDepois: falaNome };
}

function exemplosSilaba(e, a, palavras) {
  const res = [];
  for (const p of palavras) {
    const sil = silabasDe(p).find(s => e.silabas.includes(s));
    if (!sil) continue;
    const fl = p.fala || p.palavra.toLowerCase();
    res.push({
      tipo: 'ouvir-e-tocar', figura: p.figura, fala: `${fl}. Toque na sílaba ${falaSilaba(sil)}.`, dica: `Procure a sílaba ${falaSilaba(sil)}.`,
      instrucao: 'UMA PALAVRA DA SUA VIDA TEM ESTA SÍLABA. TOQUE NELA',
      opcoes: [sil, ...embaralhar(e.silabas.filter(s => s !== sil)).slice(0, 2)], correta: sil
    });
    if (res.length >= 3) break;
  }
  return res;
}

function palavrasDaVida(palavras) {
  return palavras.slice(0, 5).flatMap(p => {
    const fl = p.fala || p.palavra.toLowerCase();
    const s = silabasDe(p);
    const acts = [{ tipo: 'apresentar', figura: p.figura, texto: p.palavra, subtexto: p.frase || '', fala: `${fl}. ${p.frase || ''}`, instrucao: 'OLHE E OUÇA UMA PALAVRA DA SUA VIDA' }];
    if (s.length > 1) acts.push({
      tipo: 'montar', unidades: s, palavra: s.join(''), figura: p.figura, falaDepois: fl, dica: 'Tente outra sílaba.',
      fala: `Monte a palavra ${fl}. Toque nas sílabas, na ordem.`, instrucao: 'JUNTE AS SÍLABAS PARA FORMAR A PALAVRA'
    });
    return acts;
  });
}

function frasesDaPessoa(a, palavras) {
  return palavras.filter(p => p.frase && p.frase.trim()).slice(0, 4).map(p => {
    const f = maiuscula(p.frase.replace(/[.!?,;]/g, '').trim());
    return a.tipo === 'ler'
      ? { tipo: 'ler', texto: f, figura: p.figura, fala: 'Leia a frase em voz alta. Quando terminar, toque no botão roxo.', falaDepois: f.toLowerCase(), instrucao: 'LEIA EM VOZ ALTA E TOQUE NO ✔' }
      : { tipo: 'ordenar', frase: f, figura: p.figura, fala: `Toque nas palavras, na ordem, para formar a frase: ${f.toLowerCase()}.`, dica: 'Tente outra palavra.', falaDepois: f.toLowerCase(), instrucao: 'TOQUE NAS PALAVRAS, NA ORDEM, PARA FORMAR A FRASE' };
  });
}

// Palavras do vocabulário geral cujas sílabas já foram ensinadas; as que têm sílabas recém-aprendidas vêm primeiro.
function doVocabulario(a, info, apr) {
  const livres = vocabulario.filter(w => w.silabas.length >= 2 && w.silabas.every(s => conhecida(s, apr.sil, apr.fin)));
  const novas = new Set(trilha.etapas.filter(e => e.n >= (info.desde ?? Infinity) && e.n < info.n).flatMap(e => e.silabas || []).map(norm));
  const comNovas = embaralhar(livres.filter(w => w.silabas.some(s => novas.has(norm(s)))));
  const resto = embaralhar(livres.filter(w => !comNovas.includes(w)));
  return [...comNovas, ...resto].slice(0, a.quantidade || 6).map(w => {
    const fl = w.fala || w.palavra.toLowerCase();
    return a.tipo === 'ditado'
      ? { tipo: 'montar', palavra: w.palavra, extras: 2, falaDepois: fl, dica: 'Tente outra letra.', fala: `Escreva a palavra ${fl}. Toque nas letras, na ordem.`, instrucao: 'OUÇA A PALAVRA E ESCREVA COM AS LETRAS' }
      : { tipo: 'montar', unidades: w.silabas, palavra: w.palavra, figura: w.figura, falaDepois: fl, dica: 'Tente outra sílaba.', fala: `${fl}. Monte a palavra ${fl}. Toque nas sílabas, na ordem.`, instrucao: 'JUNTE AS SÍLABAS PARA FORMAR A PALAVRA' };
  });
}

function frasesDoApp(a) {
  return embaralhar(frasesBase).slice(0, a.quantidade || 5).map(f => a.tipo === 'ler'
    ? { tipo: 'ler', texto: f.frase, figura: f.figura, fala: 'Leia a frase em voz alta. Quando terminar, toque no botão roxo.', falaDepois: f.frase.toLowerCase(), instrucao: 'LEIA EM VOZ ALTA E TOQUE NO ✔' }
    : { tipo: 'ordenar', frase: f.frase, figura: f.figura, fala: `Toque nas palavras, na ordem, para formar a frase: ${f.frase.toLowerCase()}.`, dica: 'Tente outra palavra.', falaDepois: f.frase.toLowerCase(), instrucao: 'TOQUE NAS PALAVRAS, NA ORDEM, PARA FORMAR A FRASE' });
}

// Escolhe poucas sílabas (as da pessoa primeiro) que formem várias palavras do vocabulário.
function criarPalavras(a, palavras, apr) {
  const livres = vocabulario.filter(w => w.silabas.length >= 2 && w.silabas.every(s => apr.sil.has(norm(s))));
  const conhecidas = new Set(palavras.map(p => maiuscula(p.palavra)));
  const pool = [...new Set(palavras.flatMap(silabasDe))].slice(0, 4);
  const formaveis = () => livres.filter(w => !conhecidas.has(w.palavra) && w.silabas.every(s => pool.includes(s)));
  const freq = {};
  livres.forEach(w => w.silabas.forEach(s => { freq[s] = (freq[s] || 0) + 1; }));
  while (pool.length < 8 && formaveis().length < 6) {
    const falta = {};
    livres.forEach(w => { const f = w.silabas.filter(s => !pool.includes(s)); if (f.length === 1) falta[f[0]] = (falta[f[0]] || 0) + 1; });
    const cand = Object.keys(freq).filter(s => !pool.includes(s)).sort((x, y) => ((falta[y] || 0) * 10 + freq[y]) - ((falta[x] || 0) * 10 + freq[x]));
    if (!cand.length) break;
    pool.push(cand[0]);
  }
  const alvos = formaveis();
  if (!alvos.length) return null;
  return { ...a, pool: embaralhar(pool), alvos, pistas: embaralhar(alvos).slice(0, 6), necessario: Math.min(3, alvos.length) };
}

/* ---------- atividade ---------- */
function mostrarAtividade() {
  const a = atividades[indice];
  if (a.tipo === 'ordenar' && !a.unidades) a.unidades = a.frase.split(/\s+/);
  marcarProgresso(atividades.length, indice);
  const ctx = { erros: 0, dicas: 0, tentativas: 0, liberarPular: () => {} };
  let meuId = -1, concluida = false;   // meuId: tela desta atividade; se a pessoa sair (🏠, Voltar), nada atrasado acontece
  const textoInstr = h('span', { class: 'texto-instr' }, a.instrucao || a.fala);
  const instr = h('div', { class: 'instrucao' }, h('span', { class: 'ico-instr' }, ICONE_TIPO[a.tipo] || '👉'), textoInstr);
  const proximo = botaoGrande('➜', 'PRÓXIMO', avancar, 'oculto');
  // Saída de emergência: depois de várias tentativas sem acertar, a pessoa pode seguir em frente sem ficar presa.
  const pular = botaoGrande('➜', 'PULAR', async () => { pular.disabled = true; await registrar(false); avancar(); }, 'btn-sec');
  pular.hidden = true;
  ctx.liberarPular = () => {
    if (!pular.hidden || concluida) return;
    pular.hidden = false;
    setTimeout(() => { if (meuId === telaId && !concluida) falar('Se quiser, toque em pular para ir para a próxima.'); }, 2500);
  };
  const dep = a.falaDepois ?? (TEM_FALA_DEPOIS.includes(a.tipo) ? (a.palavra || a.frase || a.texto || '').toLowerCase() : '');

  const registrar = async acertou => {
    if (modoTeste) return;
    const chave = `${etapa.etapa}:${indice}`;
    const antes = (await db.getProgresso(chave)) || { acertos: 0, erros: 0, dicas: 0 };
    await db.setProgresso(chave, {
      rotulo: a.correta || a.palavra || a.frase || a.texto || a.letra || '', tipo: a.tipo,
      acertos: antes.acertos + (acertou ? 1 : 0), erros: antes.erros + ctx.erros, dicas: antes.dicas + ctx.dicas, pulos: (antes.pulos || 0) + (acertou ? 0 : 1), ultimo: Date.now()
    });
  };
  const concluir = async () => {
    if (concluida) return;
    concluida = true; pular.hidden = true;
    await registrar(true);
    if (ctx.erros === 0 && !NAO_PONTUA.includes(a.tipo)) primeira++;
    if (meuId !== telaId) return;
    textoInstr.textContent = 'MUITO BEM! TOQUE NA SETA PARA CONTINUAR';
    somAcerto();
    proximo.classList.remove('oculto');
    proximo.focus();
    await falar(dep);
    if (meuId === telaId) falar(sortear(ELOGIOS) + ' Toque na seta para continuar.');
  };

  const fabrica = { montar: atividadeMontar, ordenar: atividadeMontar, 'criar-palavras': atividadeCriar, tracar: atividadeTracar, ler: atividadeLer, apresentar: atividadeApresentar };
  const corpo = (fabrica[a.tipo] || atividadeOuvirTocar)(a, ctx, concluir);
  mostrar(instr, ...corpo, proximo, pular);
  meuId = telaId;
  encaixarCartoes();
  if (a.tipo === 'apresentar') proximo.classList.remove('oculto');
  falar(a.fala);
}

function avancar() {
  indice++;
  if (!revisando && !modoTeste) { estado.indice = indice; estado.primeira = primeira; salvarEstado(); }
  if (indice < atividades.length) mostrarAtividade(); else fimDaEtapa();
}

// Segue para a próxima etapa sem marcar esta como feita: ela continua disponível (e aparece como pendente no caminho).
async function seguirSemConcluir() {
  const prox = proximaEtapaDisponivel(etapa.etapa + 1);
  estado = { etapa: prox ? prox.n : etapa.etapa + 1, indice: 0, primeira: 0 };
  await salvarEstado();
  if (prox) abrirEtapa(prox.n); else telaFinal();
}

async function fimDaEtapa() {
  if (modoTeste) return fimDoTeste();
  const minimo = etapa.criterio?.acertosDePrimeira;
  const total = atividades.filter(x => !NAO_PONTUA.includes(x.tipo)).length;
  marcarProgresso();
  if (minimo && total && primeira / total < minimo) {
    if (!revisando) { estado.indice = 0; estado.primeira = 0; await salvarEstado(); }
    falhasEtapa[etapa.etapa] = (falhasEtapa[etapa.etapa] || 0) + 1;
    const cansada = falhasEtapa[etapa.etapa] >= 2 && !revisando;   // depois de duas rodadas, oferece seguir em frente
    mostrar(
      h('div', { class: 'figura' }, '🔁'),
      h('p', { class: 'texto-intro' }, cansada ? 'VAMOS TENTAR DE NOVO, OU SEGUIR PARA A PRÓXIMA ETAPA.' : 'VAMOS TENTAR MAIS UMA VEZ. TOQUE NO BOTÃO ROXO.'),
      h('div', { class: 'linha-botoes' },
        botaoGrande('↻', 'DE NOVO', () => abrirEtapa(etapa.etapa, revisando)),
        cansada ? botaoGrande('➜', 'SEGUIR', seguirSemConcluir, 'btn-sec') : null));
    return falar(cansada ? 'Vamos tentar de novo, ou seguir para a próxima etapa. Você escolhe.' : 'Vamos tentar mais uma vez. Toque no botão roxo.');
  }
  falhasEtapa[etapa.etapa] = 0;
  concluidas.add(etapa.etapa);
  db.setConfig('concluidas', [...concluidas]);
  if (revisando) {
    mostrar(h('div', { class: 'festa' }, '🎉'), h('h1', { class: 'titulo-grande' }, 'MUITO BEM!'),
      h('p', { class: 'texto-intro' }, 'TOQUE NA CASA PARA VOLTAR AO INÍCIO.'), botaoGrande('⌂', 'INÍCIO', telaInicio));
    somAcerto();
    return falar((etapa.fala_fim || 'Muito bem!') + ' Toque na casa para voltar ao início.');
  }
  const prox = proximaEtapaDisponivel(etapa.etapa + 1);
  estado = { etapa: prox ? prox.n : etapa.etapa + 1, indice: 0, primeira: 0 };
  await salvarEstado();
  mostrar(
    h('div', { class: 'festa' }, '🎉'),
    h('h1', { class: 'titulo-grande' }, 'MUITO BEM!'),
    h('p', { class: 'texto-intro' }, prox ? 'TOQUE NA SETA PARA IR PARA A PRÓXIMA ETAPA.' : 'VOCÊ TERMINOU TUDO O QUE ESTÁ PRONTO.'),
    botaoGrande('➜', 'PRÓXIMO', () => (prox ? abrirEtapa(prox.n) : telaFinal()))
  );
  somAcerto();
  falar((etapa.fala_fim || 'Muito bem!') + ' Toque na seta para continuar.');
}

/* ---------- apresentar ---------- */
function atividadeApresentar(a) {
  return [
    a.figura ? h('div', { class: 'figura' }, a.figura) : null,
    h('div', { class: 'texto-apresenta' }, a.texto),
    a.subtexto ? h('div', { class: 'subtexto' }, a.subtexto) : null
  ];
}

/* ---------- ouvir e tocar ---------- */
function atividadeOuvirTocar(a, ctx, concluir) {
  let resolvido = false;
  const cartoes = embaralhar(a.opcoes).map(o => {
    const texto = typeof o === 'string' ? o : o.texto;
    const figura = typeof o === 'string' ? null : o.figura;
    const c = h('button', { class: 'cartao' + (texto.length > 3 ? ' longo' : ''), 'data-n': String(texto.length), 'aria-label': texto },
      figura ? h('span', { class: 'mini-figura' }, figura) : null, texto);
    c.addEventListener('click', () => {
      if (resolvido) return;
      if (texto === a.correta) {
        resolvido = true;
        c.classList.remove('destaque'); c.classList.add('certo');
        cartoes.forEach(x => x !== c && (x.disabled = true));
        concluir();
      } else {
        ctx.erros++;
        if (ctx.erros >= 4) ctx.liberarPular();
        c.classList.remove('tremer'); void c.offsetWidth; c.classList.add('tremer');
        falar((a.dica || 'Tente de novo.') + ' Tente de novo.');
        if (ctx.erros >= 2) {
          const certo = cartoes.find(x => x.getAttribute('aria-label') === a.correta);
          if (certo && !certo.classList.contains('destaque')) { certo.classList.add('destaque'); ctx.dicas++; }
        }
      }
    });
    return c;
  });
  return [a.figura ? h('div', { class: 'figura' }, a.figura) : null, h('div', { class: 'opcoes' }, cartoes)];
}

/* ---------- montar e ordenar (letras, sílabas ou palavras) ---------- */
function atividadeMontar(a, ctx, concluir) {
  const base = a.unidades || [...a.palavra];
  const esperado = base.filter(c => c !== ' ');
  const grande = esperado.some(u => u.length > 1);
  let pos = 0, errosNaPosicao = 0;
  const espacos = base.map(c => h('div', { class: c === ' ' ? 'espaco vazio-sep' : 'espaco' + (grande ? ' largo' : '') }));
  const alvos = espacos.filter(e => !e.classList.contains('vazio-sep'));
  const extras = a.extras ? embaralhar([...'AEIOULMNPRSTBCD'].filter(l => !esperado.includes(l))).slice(0, a.extras) : [];
  let ordem = embaralhar([...esperado, ...extras]);
  for (let t = 0; t < 5 && esperado.length > 1 && ordem.join('') === esperado.join(''); t++) ordem = embaralhar(ordem);
  const pecas = ordem.map(u => {
    const p = h('button', { class: 'peca' + (grande ? ' larga' : ''), 'aria-label': u }, u);
    p.addEventListener('click', () => {
      if (pos >= esperado.length || p.classList.contains('usado')) return;
      if (u === esperado[pos]) {
        p.classList.add('usado'); p.classList.remove('destaque');
        alvos[pos].textContent = u; alvos[pos].classList.add('cheio');
        pos++; errosNaPosicao = 0;
        pecas.forEach(x => x.classList.remove('destaque'));
        if (pos === esperado.length) concluir(); else falar(falaUnidade(u, a.tipo));
      } else {
        ctx.erros++; errosNaPosicao++;
        if (ctx.erros >= 4) ctx.liberarPular();
        p.classList.remove('tremer'); void p.offsetWidth; p.classList.add('tremer');
        falar((a.dica || 'Tente outra.') + ' Qual é o próximo?');
        if (a.dicas !== false && errosNaPosicao >= 2) {
          const certa = pecas.find(x => !x.classList.contains('usado') && x.textContent === esperado[pos]);
          if (certa && !certa.classList.contains('destaque')) { certa.classList.add('destaque'); ctx.dicas++; }
        }
      }
    });
    return p;
  });
  return [a.figura ? h('div', { class: 'figura' }, a.figura) : null, h('div', { class: 'espacos' }, espacos), h('div', { class: 'pecas' }, pecas)];
}

/* ---------- criar palavras novas com sílabas ---------- */
function atividadeCriar(a, ctx, concluir) {
  const achadas = new Set();
  let atual = [];
  const linha = h('div', { class: 'espacos' });
  const estrelas = h('div', { class: 'estrelas' });
  const pistas = h('div', { class: 'pistas' }, a.pistas.map(w => h('span', { class: 'pista', 'data-p': w.palavra }, w.figura)));
  const desenhar = () => {
    linha.replaceChildren(...(atual.length ? atual.map(s => h('div', { class: 'espaco cheio largo' }, s)) : [h('div', { class: 'espaco largo' })]));
    estrelas.textContent = '⭐'.repeat(achadas.size) + '☆'.repeat(Math.max(0, a.necessario - achadas.size));
  };
  const pecas = a.pool.map(s => h('button', { class: 'peca larga', onclick: () => { atual.push(s); desenhar(); falar(falaSilaba(s)); } }, s));
  const apagar = h('button', { class: 'btn-medio btn-sec', 'aria-label': 'Apagar', onclick: () => { atual.pop(); desenhar(); } }, '⌫ APAGAR');
  const pronto = h('button', { class: 'btn-medio', 'aria-label': 'Pronto', onclick: () => {
    const p = atual.join('');
    const alvo = a.alvos.find(w => w.palavra === p);
    atual = [];
    if (!alvo || achadas.has(p)) {
      ctx.erros++; if (ctx.erros >= 3) ctx.liberarPular();
      desenhar(); return falar(alvo ? 'Essa você já fez. Tente outra.' : 'Essa palavra não está na lista. Tente outra.');
    }
    achadas.add(p);
    [...pistas.children].find(x => x.dataset.p === p)?.classList.add('achada');
    desenhar(); somAcerto();
    if (achadas.size >= a.necessario) concluir(); else falar(`${alvo.fala}. Muito bem! Faça outra palavra.`);
  } }, '✔ PRONTO');
  desenhar();
  return [pistas, estrelas, linha, h('div', { class: 'pecas' }, pecas), h('div', { class: 'linha-botoes' }, apagar, pronto)];
}

/* ---------- traçar com o dedo ---------- */
function atividadeTracar(a, ctx, concluir) {
  const tam = Math.round(Math.min(innerWidth - 32, 340));
  const dpr = window.devicePixelRatio || 1, px = Math.round(tam * dpr);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = px; c.style.width = c.style.height = tam + 'px'; return c; };
  const modelo = mk(), traco = mk(), mascara = document.createElement('canvas');
  mascara.width = mascara.height = px;
  modelo.className = 'cv-modelo'; traco.className = 'cv-traco';
  const fonte = `900 ${Math.round(px * 0.85)}px Arial, Helvetica, sans-serif`;
  const letra = (c, desenho) => { c.font = fonte; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; desenho(c, px / 2, px * 0.78); };
  const mc = modelo.getContext('2d');
  letra(mc, (c, x, y) => { c.fillStyle = cor('--modelo'); c.fillText(a.letra, x, y); c.setLineDash([px * 0.03, px * 0.03]); c.lineWidth = px * 0.012; c.strokeStyle = cor('--tracejado'); c.strokeText(a.letra, x, y); });
  letra(mascara.getContext('2d'), (c, x, y) => c.fillText(a.letra, x, y));
  const dm = mascara.getContext('2d').getImageData(0, 0, px, px).data;
  const amostras = [];
  for (let y = 0; y < px; y += 8) for (let x = 0; x < px; x += 8) if (dm[(y * px + x) * 4 + 3] > 128) amostras.push([x, y]);

  const tc = traco.getContext('2d');
  tc.lineCap = 'round'; tc.lineJoin = 'round'; tc.lineWidth = px * 0.11; tc.strokeStyle = cor('--traco');
  let desenhando = false, feito = false;
  const ponto = e => { const r = traco.getBoundingClientRect(); return [(e.clientX - r.left) * px / r.width, (e.clientY - r.top) * px / r.height]; };
  traco.addEventListener('pointerdown', e => { if (feito) return; desenhando = true; traco.setPointerCapture(e.pointerId); const [x, y] = ponto(e); tc.beginPath(); tc.moveTo(x, y); tc.lineTo(x + 0.1, y); tc.stroke(); });
  traco.addEventListener('pointermove', e => { if (!desenhando) return; const [x, y] = ponto(e); tc.lineTo(x, y); tc.stroke(); tc.beginPath(); tc.moveTo(x, y); });
  const soltar = () => {
    if (!desenhando) return; desenhando = false;
    const d = tc.getImageData(0, 0, px, px).data;
    const cobertos = amostras.filter(([x, y]) => d[(y * px + x) * 4 + 3] > 0).length;
    if (amostras.length && cobertos / amostras.length >= 0.6) { feito = true; concluir(); }
    else { ctx.tentativas++; if (ctx.tentativas >= 3) ctx.liberarPular(); falar('Continue passando o dedo sobre a letra.'); }
  };
  traco.addEventListener('pointerup', soltar); traco.addEventListener('pointercancel', soltar);
  const limpar = h('button', { class: 'btn-medio btn-sec', 'aria-label': 'Limpar', onclick: () => { if (feito) return; tc.clearRect(0, 0, px, px); falar('Pode tentar de novo.'); } }, '🧽 LIMPAR');
  return [h('div', { class: 'area-traco', style: `width:${tam}px;height:${tam}px` }, modelo, traco), limpar];
}

/* ---------- ler em voz alta ---------- */
function atividadeLer(a, ctx, concluir) {
  const jaLi = h('button', { class: 'btn-grande', 'aria-label': 'Já li', onclick: () => { jaLi.disabled = true; concluir(); } }, '✔', h('span', { class: 'rotulo' }, 'JÁ LI'));
  return [a.figura ? h('div', { class: 'figura' }, a.figura) : null, h('div', { class: 'texto-ler' }, a.texto), jaLi];
}

/* ---------- eventos globais ---------- */
// Ajustes de pronúncia feitos pela mediadora: valem só neste aparelho e sobrepõem o conteúdo.
const pronuncias = {
  letras: () => Object.keys(baseLetras).filter(k => /^[A-ZÇ]$/.test(k)),
  silabas: () => [...new Set(trilha.etapas.flatMap(e => e.silabas || []))],
  estilos: ESTILOS,
  estilo: () => estiloSilabas,
  async definirEstilo(estilo) { if (ESTILOS[estilo]) { estiloSilabas = estilo; await db.setConfig('estiloSilabas', estilo); } },
  // Sílabas de amostra para ouvir como o estilo escolhido soa neste aparelho.
  exemplo: () => ['BA', 'BE', 'BI', 'BO', 'BU', 'GA', 'GO', 'GU', 'QUE', 'GUE', 'NHA', 'NHE', 'BRA'].map(x => `{s:${x}}`).join('. ') + '.',
  atual: (tipo, chave) => (tipo === 'letra' ? nomeDaLetra(chave) : falaSilaba(chave)),
  padrao: (tipo, chave) => (tipo === 'letra' ? baseLetras[chave] || chave.toLowerCase() : aplicarEstilo(formaPlana(chave))),
  async definir(tipo, chave, texto) {
    const locais = (await db.getConfig('pronuncias')) || {};
    const grupo = tipo === 'letra' ? 'letras' : 'silabas';
    locais[grupo] = locais[grupo] || {};
    const ajustar = (mapa, base) => {
      if (!texto || texto === pronuncias.padrao(tipo, chave)) { delete locais[grupo][chave]; delete mapa[chave]; if (base && base[chave] !== undefined) mapa[chave] = base[chave]; }
      else { locais[grupo][chave] = texto; mapa[chave] = texto; }
    };
    ajustar(tipo === 'letra' ? letras : ajustesSilabas, tipo === 'letra' ? baseLetras : null);
    await db.setConfig('pronuncias', locais);
  },
  // Formas a experimentar quando a voz soletra ou erra: a própria sílaba em cada estilo.
  candidatas(tipo, chave) {
    if (tipo === 'letra') return [...new Set([pronuncias.padrao(tipo, chave), chave.toLowerCase()])];
    const plana = formaPlana(chave);
    return [...new Set([pronuncias.padrao(tipo, chave), plana, ...Object.keys(ESTILOS).map(e => aplicarEstilo(plana, e))])];
  },
  ajustada: (tipo, chave) => pronuncias.atual(tipo, chave) !== pronuncias.padrao(tipo, chave),
};

document.getElementById('btn-ouvir').addEventListener('click', repetir);
btnInicio.addEventListener('click', irParaInicio);
document.getElementById('btn-mediadora').addEventListener('click', () => {
  speechSynthesis?.cancel();
  entrarSub();
  abrirMediadora({ tela, marcarProgresso, aplicarTema, pronuncias, aoSair: sairDaMediadora });
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
iniciar();
