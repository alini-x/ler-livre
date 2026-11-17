// Área da mediadora: nome, pronúncia e palavras da pessoa, progresso, importação e ajustes do aparelho.
import { falar, estadoVoz, getVelocidade, setVelocidade } from './voz.js';
import * as db from './db.js';
import { h } from './dom.js';

export async function abrirMediadora({ tela, marcarProgresso, aplicarTema, pronuncias, aoSair }) {
  document.body.classList.add('modo-med');
  marcarProgresso();
  const sair = () => aoSair();
  painel();

  /* --- painel --- */
  async function painel() {
    const nome = (await db.getConfig('nome')) || { texto: '', fala: '' };
    const palavras = await db.listarPalavras();

    const inNome = h('input', { type: 'text', value: nome.texto, maxlength: '20', autocomplete: 'off', autocapitalize: 'characters' });
    const inFala = h('input', { type: 'text', value: nome.fala, maxlength: '40', autocomplete: 'off' });
    const status = h('div', { class: 'aviso', style: 'visibility:hidden' }, ' ');
    const avisar = t => { status.textContent = t; status.style.visibility = 'visible'; };

    const secNome = [
      h('h2', {}, 'Nome da pessoa'),
      h('label', {}, 'Nome (como aparece na tela)', inNome),
      h('label', {}, 'Como o app deve falar o nome (escreva como se lê)', inFala),
      h('p', { class: 'pequeno' }, 'Exemplo: nome SOFIA, fala "sófia". Clique em Ouvir e ajuste até ficar natural.'),
      h('div', { class: 'linha' },
        h('button', { onclick: () => falar(inFala.value.trim() || inNome.value.trim()) }, '🔊 Ouvir'),
        h('button', { class: 'ok', onclick: async () => {
          const texto = inNome.value.trim().toLocaleUpperCase('pt-BR');
          if (!texto) { await db.setConfig('nome', null); return avisar('Nome removido.'); }
          if (!/^[A-ZÀ-Ü ]+$/.test(texto)) return avisar('Use só letras e espaços.');
          await db.setConfig('nome', { texto, fala: inFala.value.trim() || texto.toLowerCase() });
          inNome.value = texto; avisar('Nome salvo neste aparelho.');
        } }, 'Salvar nome'))
    ];

    const secPalavras = [
      h('h2', {}, 'Palavras da pessoa'),
      h('p', { class: 'pequeno' }, 'Lista guardada só neste aparelho. Entram nas atividades só as marcadas como aprovadas (e que tenham sílabas, ex.: BO-LA). Marque "aprovada" só depois de ouvir e conferir.'),
      ...palavras.map(p => cartaoPalavra(p)),
      h('button', { onclick: () => formPalavra({}) }, '+ Nova palavra')
    ];

    function cartaoPalavra(p) {
      return h('div', { class: 'item' },
        h('strong', {}, `${p.figura || ''} ${p.palavra}  ${p.silabas ? '(' + p.silabas + ')' : ''}  ${p.aprovada ? '✔ aprovada' : '… rascunho'}`),
        p.frase ? h('div', {}, p.frase) : null,
        h('div', { class: 'linha' },
          h('button', { onclick: () => falar(p.fala || p.palavra) }, '🔊'),
          h('button', { onclick: () => formPalavra(p) }, 'Editar'),
          h('button', { class: 'perigo', onclick: async () => { if (confirm(`Apagar "${p.palavra}"?`)) { await db.removerPalavra(p.id); painel(); } } }, 'Apagar')));
    }

    function formPalavra(p) {
      const campos = {
        palavra: h('input', { type: 'text', value: p.palavra || '', autocapitalize: 'characters' }),
        silabas: h('input', { type: 'text', value: p.silabas || '', placeholder: 'BO-LA' }),
        figura: h('input', { type: 'text', value: p.figura || '', placeholder: 'emoji, ex.: ⚽' }),
        frase: h('input', { type: 'text', value: p.frase || '' }),
        fala: h('input', { type: 'text', value: p.fala || '', placeholder: 'só se a voz errar' }),
        aprovada: h('input', { type: 'checkbox', checked: !!p.aprovada })
      };
      tela.replaceChildren(h('div', { class: 'med' },
        h('h1', {}, p.id ? 'Editar palavra' : 'Nova palavra'),
        h('label', {}, 'Palavra', campos.palavra),
        h('label', {}, 'Sílabas (separadas por hífen)', campos.silabas),
        h('label', {}, 'Figura', campos.figura),
        h('label', {}, 'Frase da vida da pessoa', campos.frase),
        h('label', {}, 'Como falar (opcional)', campos.fala),
        h('label', { class: 'check' }, campos.aprovada, 'Aprovada (ouvi e conferi)'),
        h('div', { class: 'linha' },
          h('button', { onclick: () => falar(campos.fala.value.trim() || campos.palavra.value.trim()) }, '🔊 Ouvir'),
          h('button', { class: 'ok', onclick: async () => {
            const palavra = campos.palavra.value.trim().toLocaleUpperCase('pt-BR');
            if (!palavra) return;
            const novo = { ...p, palavra, silabas: campos.silabas.value.trim().toLocaleUpperCase('pt-BR'), figura: campos.figura.value.trim(),
              frase: campos.frase.value.trim(), fala: campos.fala.value.trim(), aprovada: campos.aprovada.checked };
            if (!novo.id) delete novo.id;
            await db.salvarPalavra(novo); painel();
          } }, 'Salvar'),
          h('button', { onclick: painel }, 'Cancelar'))));
    }

    const trilha = await (await fetch('conteudo/trilha.json')).json();
    const progresso = await db.listarProgresso();
    const testes = (await db.getConfig('testes')) || [];
    const estado = (await db.getConfig('estado')) || { etapa: 1 };
    const titulo = n => trilha.etapas.find(e => e.n === +n)?.titulo || `Etapa ${n}`;

    const seletor = h('select', { class: 'seletor' },
      trilha.etapas.map(e => h('option', { value: e.n }, `${e.n}. ${e.icone} ${e.titulo}`)));
    seletor.value = estado.etapa;
    const secTeste = [
      h('h2', {}, 'Ir para uma etapa (para testar)'),
      h('p', { class: 'pequeno' }, 'Pula direto para qualquer etapa e marca as anteriores como feitas (para testar).'),
      h('div', { class: 'linha' }, seletor,
        h('button', { class: 'ok', onclick: async () => { const n = +seletor.value;
          await db.setConfig('estado', { etapa: n, indice: 0, primeira: 0 });
          const feitas = new Set([...((await db.getConfig('concluidas')) || []), ...trilha.etapas.filter(e => e.n < n).map(e => e.n)]);
          await db.setConfig('concluidas', [...feitas]); sair(); } }, 'Ir e abrir o app'))
    ];

    const itens = Object.entries(progresso).map(([k, v]) => ({ k, etapa: +k.split(':')[0], ...v }));
    const comErro = itens.filter(i => i.erros > 0).sort((x, y) => y.erros - x.erros).slice(0, 8);
    function exportar() {
      const dados = { app: 'ler-livre', exportadoEm: new Date().toISOString(), estado, progresso, testes };
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      const link = h('a', { href: url, download: `progresso-ler-livre-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      avisar('Progresso exportado (arquivo baixado).');
    }
    const secProgresso = [
      h('h2', {}, 'Progresso'),
      h('p', { class: 'pequeno' }, `Etapa atual: ${estado.etapa}. Atividades registradas: ${itens.length}. Testes para pular etapas: ${testes.length} (${testes.filter(t => t.passou).length} aprovados).`),
      comErro.length ? h('div', { class: 'item' }, h('strong', {}, 'Onde mais errou'),
        ...comErro.map(i => h('div', {}, `Etapa ${i.etapa} (${titulo(i.etapa)}) · ${i.rotulo || i.k}: ${i.erros} erro(s), ${i.dicas} dica(s)`))) : h('p', { class: 'pequeno' }, 'Nenhum erro registrado ainda.'),
      h('p', { class: 'pequeno' }, 'Atenção: o arquivo exportado pode conter o nome e as palavras da pessoa. Guarde com cuidado e não o envie a lugares públicos.'),
      h('div', { class: 'linha' }, h('button', { class: 'ok', onclick: exportar }, '⬇ Exportar progresso'))
    ];

    const arquivo = h('input', { type: 'file', accept: '.json,application/json' });
    // Importação: arquivo de fora é tratado como dado não confiável (tamanho, quantidade, tipos e comprimentos limitados).
    const limpo = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
    arquivo.addEventListener('change', async () => {
      try {
        const f = arquivo.files[0];
        if (!f || f.size > 1024 * 1024) throw new Error('tamanho');
        const dados = JSON.parse(await f.text());
        const lista = Array.isArray(dados) ? dados : dados?.palavras;
        if (!Array.isArray(lista) || lista.length > 500) throw new Error('formato');
        const atuais = await db.listarPalavras();
        let novas = 0, atualizadas = 0, ignoradas = 0;
        for (const x of lista) {
          const palavra = limpo(x?.palavra, 30).toLocaleUpperCase('pt-BR');
          if (!x || typeof x !== 'object' || !/^[\p{L}][\p{L} -]*$/u.test(palavra)) { ignoradas++; continue; }
          const item = { palavra, silabas: limpo(x.silabas, 60).toLocaleUpperCase('pt-BR'), figura: limpo(x.figura, 16), frase: limpo(x.frase, 200), fala: limpo(x.fala, 60), aprovada: x.aprovada === true };
          const igual = atuais.find(p => p.palavra === palavra);
          if (igual) { item.id = igual.id; atualizadas++; } else { novas++; atuais.push({ palavra }); }
          await db.salvarPalavra(item);
        }
        arquivo.value = ''; painel();
        setTimeout(() => avisar(`Importação concluída: ${novas} nova(s), ${atualizadas} atualizada(s), ${ignoradas} ignorada(s). Só entram nas atividades as marcadas como aprovadas.`), 50);
      } catch { arquivo.value = ''; avisar('Arquivo inválido ou grande demais (máximo 1 MB e 500 palavras). Use o modelo (botão abaixo).'); }
    });
    const secImportar = [
      h('h2', {}, 'Importar palavras da pessoa'),
      h('p', { class: 'pequeno' }, 'Arquivo JSON preparado fora do app (por você, com ajuda de IA se quiser). Revise tudo e só marque "aprovada" depois de ouvir cada palavra. Palavras com a mesma grafia são atualizadas.'),
      h('label', {}, 'Escolher arquivo .json', arquivo),
      h('button', { onclick: () => {
        const modelo = { palavras: [
          { palavra: 'BOLA', silabas: 'BO-LA', figura: '⚽', frase: 'A bola é do meu neto.', fala: '', aprovada: false },
          { palavra: 'CASA', silabas: 'CA-SA', figura: '🏠', frase: 'Minha casa é bonita.', fala: '', aprovada: false }] };
        const url = URL.createObjectURL(new Blob([JSON.stringify(modelo, null, 2)], { type: 'application/json' }));
        const link = h('a', { href: url, download: 'modelo-palavras.json' }); document.body.append(link); link.click(); link.remove();
      } }, '⬇ Baixar modelo do arquivo')
    ];

    const temaAtual = (await db.getConfig('tema')) || 'auto';
    const seletorTema = h('select', { class: 'seletor' },
      [['auto', 'Automático (segue o aparelho)'], ['claro', 'Sempre claro'], ['escuro', 'Sempre escuro']].map(([v, t]) => h('option', { value: v }, t)));
    seletorTema.value = temaAtual;
    seletorTema.addEventListener('change', async () => { await db.setConfig('tema', seletorTema.value === 'auto' ? null : seletorTema.value); aplicarTema(seletorTema.value === 'auto' ? null : seletorTema.value); });
    const seletorVel = h('select', { class: 'seletor' },
      [['0.65', 'Bem devagar'], ['0.85', 'Devagar (padrão)'], ['1', 'Normal'], ['1.15', 'Um pouco mais rápida'], ['1.3', 'Rápida'], ['1.5', 'Muito rápida']].map(([val, t]) => h('option', { value: val }, t)));
    seletorVel.value = String(getVelocidade());
    seletorVel.addEventListener('change', async () => { await db.setConfig('velocidade', +seletorVel.value); setVelocidade(+seletorVel.value); falar('Esta é a nova velocidade da voz.'); });
    // Pronúncia de letras e sílabas: cada voz fala de um jeito, então a mediadora ouve e corrige neste aparelho.
    function linhaPronuncia(tipo, chave) {
      const campo = h('input', { type: 'text', value: pronuncias.atual(tipo, chave), maxlength: '30', autocomplete: 'off', 'aria-label': `Como falar ${chave}` });
      const marca = h('span', { class: 'pron-marca', 'aria-hidden': 'true' }, pronuncias.ajustada(tipo, chave) ? '✎' : '');
      const atualizar = () => { marca.textContent = pronuncias.ajustada(tipo, chave) ? '✎' : ''; };
      campo.addEventListener('change', async () => { await pronuncias.definir(tipo, chave, campo.value.trim()); atualizar(); });
      const ouvir = h('button', { 'aria-label': `Ouvir ${chave}`, onclick: () => falar(campo.value.trim() || chave) }, '▶');
      const restaurar = h('button', { 'aria-label': `Restaurar ${chave}`, onclick: async () => { await pronuncias.definir(tipo, chave, ''); campo.value = pronuncias.atual(tipo, chave); atualizar(); } }, '↺');
      const outra = h('button', { 'aria-label': `Testar outra forma de ${chave}`, onclick: async () => {
        const formas = pronuncias.candidatas(tipo, chave);
        const proxima = formas[(formas.indexOf(campo.value.trim()) + 1) % formas.length];
        campo.value = proxima; await pronuncias.definir(tipo, chave, proxima); atualizar(); falar(proxima);
      } }, '🔀');
      return h('div', { class: 'pron-linha', 'data-chave': chave }, h('strong', { class: 'pron-chave' }, chave), campo, marca, ouvir, outra, restaurar);
    }
    const linhasPron = [...pronuncias.letras().map(l => linhaPronuncia('letra', l)), ...pronuncias.silabas().map(s => linhaPronuncia('silaba', s))];
    const filtro = h('input', { type: 'text', placeholder: 'Buscar letra ou sílaba (ex.: NHE)', autocomplete: 'off', 'aria-label': 'Buscar letra ou sílaba' });
    filtro.addEventListener('input', () => { const q = filtro.value.trim().toLocaleUpperCase('pt-BR'); linhasPron.forEach(l => { l.hidden = !!q && !l.dataset.chave.includes(q); }); });
    // Estilo das sílabas: um ajuste para todas de uma vez (cada voz soletra ou reduz de um jeito diferente).
    const seletorEstilo = h('select', { class: 'seletor' },
      Object.entries(pronuncias.estilos).map(([v, t]) => h('option', { value: v }, t)));
    seletorEstilo.value = pronuncias.estilo();
    seletorEstilo.addEventListener('change', async () => { await pronuncias.definirEstilo(seletorEstilo.value); await painel(); falar(pronuncias.exemplo()); });
    const secPronuncias = [
      h('h2', {}, 'Pronúncia de letras e sílabas'),
      h('label', {}, 'Estilo de pronúncia das sílabas (vale para todas)', seletorEstilo),
      h('div', { class: 'linha' }, h('button', { onclick: () => falar(pronuncias.exemplo()) }, '▶ Ouvir exemplos neste estilo')),
      h('p', { class: 'pequeno' }, 'Se a voz soletrar ("g, a com acento agudo") ou trocar o som, teste outro estilo e ouça os exemplos. Ajustes feitos item a item, abaixo, valem por cima do estilo.'),
      h('details', { class: 'pron' },
        h('summary', {}, `Ouvir e ajustar (${pronuncias.letras().length} letras e ${pronuncias.silabas().length} sílabas)`),
        h('p', { class: 'pequeno' }, 'Toque em ▶ para ouvir. Se ainda assim uma sílaba sair errada, escreva como deve ser falado e toque fora do campo para salvar; 🔀 testa a próxima forma (com ou sem acento, com vogal de apoio) e já fala; ✎ marca o que foi ajustado e ↺ volta ao padrão. Vale só neste aparelho.'),
        filtro, ...linhasPron)
    ];
    // Versão do app (nome do cache do service worker): útil para relatar problemas.
    const versao = (typeof caches !== 'undefined' ? (await caches.keys()).find(k => k.startsWith('ler-livre-v')) : null) || 'ainda sem modo offline instalado';
    const secOutros = [
      h('h2', {}, 'Aparelho e conta'),
      h('p', { class: 'pequeno' }, `Versão do app: ${versao}`),
      h('label', {}, 'Velocidade da voz', seletorVel),
      h('label', {}, 'Tema de cores', seletorTema),
      (() => { const v = estadoVoz(); return h('div', { class: v.vozes && v.local ? 'pequeno' : 'aviso' },
        v.vozes ? `Voz em uso: ${v.escolhida}${v.local ? '' : ' (VOZ ONLINE: o texto falado pode ser enviado ao serviço de voz do navegador)'}. Vozes em português: ${v.vozes}.` : 'Nenhuma voz em português neste navegador. No Android, instale/ative "Reconhecimento e síntese de fala do Google" e o idioma Português (Brasil). No computador Linux, abra o Chromium com --enable-speech-dispatcher (veja ./testar.sh) ou use o Firefox.',
        v.ultimoErro ? ` Último erro: ${v.ultimoErro}.` : ''); })(),
      h('div', { class: 'linha' },
        h('button', { onclick: () => falar('Olá! Esta é a voz do aplicativo. Vamos aprender a ler.') }, '🔊 Testar a voz'),
        h('button', { class: 'perigo', onclick: async () => { if (confirm('Zerar TODO o progresso da pessoa neste aparelho? Isso não pode ser desfeito.')) { await db.zerarProgresso(); painel(); } } }, 'Zerar progresso'))
    ];

    tela.replaceChildren(h('div', { class: 'med' },
      h('button', { class: 'ok', style: 'min-height:64px;font-size:20px', onclick: sair }, '← Voltar ao app'), h('h1', {}, 'Área de quem ajuda'), status,
      ...secTeste, ...secProgresso, ...secNome, ...secPalavras, ...secImportar, ...secPronuncias, ...secOutros,
      h('button', { class: 'ok', style: 'min-height:64px;font-size:22px', onclick: sair }, '← Voltar ao app')));
    scrollTo(0, 0);
  }
}
