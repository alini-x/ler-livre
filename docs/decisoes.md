# Decisões de arquitetura

Registro curto das decisões que moldam o projeto: contexto, decisão e consequências. Quando uma decisão mudar, acrescente uma nova entrada em vez de apagar a antiga.

## 1. App estático (PWA), sem build, sem framework e sem dependências
- **Contexto:** o app roda no celular de quem aprende, precisa funcionar offline, ser hospedado de graça e ser fácil de revisar.
- **Decisão:** HTML, CSS e JavaScript puros (módulos ES), service worker para o modo offline, nenhuma dependência de execução.
- **Consequências:** superfície de ataque e cadeia de suprimentos mínimas; nada para compilar. Em troca, `js/app.js` concentra bastante lógica (cerca de 650 linhas) e o versionamento do cache é manual (`VERSAO` em `sw.js`).

## 2. Voz do navegador (`speechSynthesis`) em vez de áudio gravado
- **Contexto:** toda instrução precisa de voz, e o conteúdo inclui palavras e pronúncias que só existem no aparelho (nome da pessoa, palavras da vida).
- **Decisão:** toda fala passa por `falar(texto)` em `js/voz.js`, com voz pt-BR local preferida e velocidade ajustável. Cada atividade tem `fala` separado do texto exibido.
- **Pronúncia:** o conteúdo guarda marcadores (`{l:E}`, `{s:NHE}`), não a pronúncia; `falar()` os resolve (inclusive nos títulos de etapa, via `titulo_fala`) com o padrão do projeto e com os ajustes feitos no aparelho pela mediadora, porque cada voz soletra ou descreve de um jeito.
- **Sílabas:** a voz do Google descreve sílabas acentuadas que não são palavras ("gá" -> "g, a com acento agudo"), e sem acento reduz E e O ("be" -> "bi"). O conteúdo guarda só a forma plana do som e o aparelho aplica um estilo de pronúncia (padrão, "equilibrado": sem acento, e palavra real para E e O quando existe, como "dê" e "só", sem repetir a sílaba); a mediadora escolhe o estilo que sua voz lê melhor e pode ajustar item a item.
- **Consequências:** conteúdo escala sem gravar nada e funciona para palavras personalizadas. A qualidade varia por aparelho, exige voz pt-BR instalada, e vozes online podem enviar o texto ao fornecedor (o app avisa). No Linux, Chromium e Brave precisam de `--enable-speech-dispatcher`.

## 3. Vocabulário único e trilha gerada por script
- **Contexto:** cobrir a alfabetização completa exige centenas de palavras e dezenas de etapas, com regras claras de progressão.
- **Decisão:** `conteudo/vocabulario.json` guarda as palavras; `ferramentas/gerar_trilha.py` gera `trilha.json` e `etapa-*.json`; uma palavra só aparece depois que todas as suas sílabas foram ensinadas (comparação sem acentos, com finais R/L/S/M/N, ditongos e til tratados).
- **Consequências:** ampliar o conteúdo é editar dados e rodar o validador. Os arquivos gerados não são editados à mão (um teste confere que estão em dia).

## 4. Sem IA nem serviços externos em execução
- **Contexto:** privacidade de quem aprende e independência de conexão.
- **Decisão:** o app não chama nenhum serviço. Conteúdo preparado com IA, se houver, passa por revisão humana e entra por arquivo importado pela mediadora.
- **Consequências:** nada de personalização automática ou reconhecimento de fala; a evolução futura precisa respeitar esse limite.

## 5. Área da mediadora sem senha
- **Contexto:** a área da mediadora fica atrás de um botão ⚙ discreto. Uma senha criaria atrito para quem acompanha e não protegeria de quem tem o aparelho desbloqueado.
- **Decisão:** sem senha. O ⚙ abre o painel direto; o botão 🏠 e o "← Voltar ao app" sempre dão saída, e a única ação destrutiva ("Zerar progresso") pede confirmação.
- **Consequências:** quem tocar no ⚙ pode alterar ou zerar dados; isso é um risco aceito e está em `SECURITY.md`. A proteção real é a tela de bloqueio do celular.

## 6. CSP por `<meta>`, sem código ou estilo inline
- **Contexto:** o GitHub Pages não permite cabeçalhos HTTP próprios.
- **Decisão:** CSP restritiva em `index.html` (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`), estilos aplicados por CSSOM, e script que oculta o app se for embutido em outra página.
- **Consequências:** bloqueia injeção de script e rede externa; não cobre `frame-ancestors`, por isso a proteção por script. Os testes impedem a volta de `innerHTML`, `eval` e inline.

## 7. Avanço por domínio e teste para pular etapas
- **Contexto:** respeitar o ritmo da pessoa e o que ela já sabe.
- **Decisão:** cada etapa libera a seguinte com 80% de acertos de primeira (ajustável por etapa); etapas feitas podem ser repetidas; tocar numa etapa futura oferece um teste curto para pular.
- **Consequências:** os limites **não** têm base em pesquisa e devem ser revistos com educadores e testes com pessoas reais.

## 8. Emojis como figuras
- **Contexto:** a figura ensina a palavra a quem não lê, e o projeto não deve carregar imagens com licenças a conferir.
- **Decisão:** emojis do sistema, sem arquivos de imagem.
- **Consequências:** zero ativos e zero licenças de imagem, mas a aparência varia por aparelho, e os mais novos (Emoji 15.0) só aparecem no Android 14 ou mais (tabela no README).

## 9. Dados só no aparelho (IndexedDB), exportação manual
- **Contexto:** nenhum dado da pessoa pode ir para um servidor.
- **Decisão:** progresso, nome e palavras ficam no IndexedDB; a mediadora exporta o progresso em arquivo e importa palavras por arquivo.
- **Consequências:** limpar os dados do site apaga tudo; não há sincronização entre aparelhos.

## 10. Nome do projeto: Ler Livre
- **Decisão:** o nome é curto, falável por voz e não tem peso religioso nem de faixa etária; a justificativa está no README ("Sobre o nome").
- **Verificação (novembro de 2026):** nenhum título igual na App Store brasileira nem na busca pública do Google Play, nenhum repositório com esse nome no GitHub e domínios `.app`, `.dev`, `.org` e `.com.br` livres (RDAP). Descartados por colisão ou ambiguidade: "Leio", "Eu Leio", "Consigo", "Libertas", "Ler" (sigla médica LER/DORT), "Letras Livres" (revista *Letras Libres*), "Ler Letra" (letra de música), "Tijolo" e "Primeira Palavra".
- **Limites:** não cobre marcas registradas; a consulta ao INPI cabe à pessoa mantenedora.
