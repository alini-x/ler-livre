# Changelog

Segue o formato do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Alterado
- O teste de ponta a ponta (`tests/e2e/run.py`) roda no CI e antes de cada publicação no Pages. A dependência `websocket-client` está fixada em `tests/e2e/requirements.txt`.
- **Palavras da vida** passou a ser a 3ª etapa, logo depois de "Meu nome", para partir das palavras da pessoa (Freire). A criação de palavras novas virou a etapa **Criar palavras**, no fim das montagens. A trilha agora tem 71 etapas e a numeração mudou: ao atualizar, use "Zerar progresso" na área da mediadora (progresso de uma pessoa real deve ser exportado antes).

## [0.1.1] - 2026-11-17

### Alterado
- README: seção "Usar o app" no lugar de "Publicar", aviso sobre a voz no Linux (Chromium e Brave sem `--enable-speech-dispatcher` ficam mudos, inclusive no site publicado), limitações e próximos passos separados, sem modelo de aparelho.

## [0.1.0] - 2026-11-16

Primeira versão, testada num Android (Chrome). Ainda sem uso real com quem vai aprender.

### Corrigido
- A voz soletrava sílabas acentuadas ("gá" virava "g, a com acento agudo"), letras acentuadas isoladas ("ê") e títulos de etapa ("família do nh"). Agora a pronúncia vem de marcadores (`{l:E}`, `{s:NHE}`, `titulo_fala`) resolvidos na hora de falar, as sílabas são faladas sem acento, e cada aparelho escolhe um **estilo de pronúncia** em ⚙, com ajuste item a item.

- Sílabas de 3 letras (NHA, QUE, BRA…) estouravam o cartão de "ouvir e tocar" em telas estreitas. O tamanho da letra agora acompanha o número de letras, com ajuste automático de segurança, e os cartões têm o mesmo tamanho. O teste de ponta a ponta confere o layout em 320 px.

- Telas sem saída: nas atividades não havia como voltar ao início nem sair da lição. Agora há o botão **🏠** em todas as telas, o botão Voltar do Android leva ao início, e depois de várias tentativas sem acertar aparece **PULAR** (quiz, montar, criar palavras e traçar). Falhas ao abrir uma etapa mostram uma tela com saída, e depois de duas rodadas sem atingir o critério a pessoa pode **SEGUIR**. O botão "DE NOVO" da tela final, que apagava todo o progresso com um toque, foi removido; só a mediadora (com confirmação) zera o progresso.

### Adicionado
- Aplicativo web instalável (PWA), offline, em HTML, CSS e JavaScript puros, sem dependências.
- Trilha de 70 etapas: vogais, nome, alfabeto, famílias silábicas, montar palavras, palavras da vida, frases, traçar, ler em voz alta e ditado.
- Vocabulário único de 237 palavras com liberação por sílabas aprendidas; frases curtas; pronúncias ajustáveis.
- Voz pelo navegador (`speechSynthesis`) em tudo, instruções escritas em todas as telas e botão "ouvir de novo".
- Tela inicial com progresso, repetição de etapas feitas e teste para pular etapas.
- Área da mediadora: nome e pronúncia, ajuste de pronúncia de letras e sílabas por aparelho, palavras da pessoa, importação de palavras, exportação de progresso, velocidade da voz (de "bem devagar" a "muito rápida"), tema e versão do app.
- Temas claro e escuro automáticos (roxo e azul).
- Segurança: CSP restritiva, validação da importação, ações do GitHub fixadas por hash (ver SECURITY.md).
- Testes automatizados (conteúdo, segurança e consistência) e teste de ponta a ponta em navegador.
- Publicação no GitHub Pages por GitHub Actions.
