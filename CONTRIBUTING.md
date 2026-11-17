# Como contribuir

Obrigado por ajudar a alfabetizar! Antes de mexer, leia os princípios do [README](README.md): quem usa **não lê**, então toda instrução precisa de voz e imagem, e o app nunca coleta dados nem chama serviços externos.

## O que mais ajuda
- **Palavras novas** em `conteudo/vocabulario.json`: `palavra`, `silabas` (lista) e `figura` (um emoji). Depois rode `python3 ferramentas/validar_vocabulario.py`.
- **Frases curtas** em `conteudo/frases.json` (letras maiúsculas, sem pontuação).
- **Pronúncia**: o padrão do projeto fica em `conteudo/letras.json` (nome da letra) e `conteudo/silabas-fala.json` (forma **plana** do som, sem acento; acento e repetição vêm do estilo de pronúncia que a mediadora escolhe no aparelho). Ajustes só de um aparelho se fazem em ⚙ → Pronúncia.
- **Novas famílias ou etapas**: edite `ferramentas/gerar_trilha.py` e rode `python3 ferramentas/gerar_trilha.py`. Não edite à mão os `etapa-*.json` nem `trilha.json`: eles são gerados.
- **Testes com pessoas reais**: relatos de onde houve hesitação valem mais que código. Abra uma issue.

## Regras do projeto
- HTML, CSS e JavaScript puros, sem framework, sem etapa de build e sem dependências em tempo de execução.
- Nada de anúncios, contas, rastreamento ou chamadas de rede além dos arquivos do próprio app.
- Toda fala passa por `falar(texto)` (`js/voz.js`). Toda atividade tem `fala` (voz) e `instrucao` (texto). Em `fala`, use `{l:E}` e `{s:NHE}` para letras e sílabas, nunca a pronúncia escrita, e evite siglas em maiúsculas (a voz soletra).
- Botões com pelo menos 56 px, letras de imprensa maiúsculas, sem gestos complexos, erro sem punição.
- Linguagem neutra para quem aprende: "a pessoa".
- Conteúdo gerado por IA só entra com revisão humana, e nunca roda dentro do app.
- Segurança: sem `innerHTML`, `eval`, scripts ou estilos inline (a CSP bloqueia) e sem recursos de outros domínios. Veja [SECURITY.md](SECURITY.md).
- Nunca envie dados pessoais (nome, fotos, progresso exportado, palavras da pessoa) ao repositório.

## Fluxo de branches (Git Flow)
- `main`: só versões lançadas, cada uma com tag `vX.Y.Z`. Um push na `main` publica no GitHub Pages.
- `develop`: integração do próximo lançamento.
- `feature/<assunto>`: sai da `develop` e volta por pull request (merge sem fast-forward).
- `release/X.Y.Z`: sai da `develop` para ajustar versão (`sw.js`) e `CHANGELOG.md`; vai para a `main` com tag e volta para a `develop`.
- `hotfix/<assunto>`: sai da `main` para correção urgente; vai para a `main` com tag e para a `develop`.

Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`), com assunto no imperativo e até 72 caracteres.

## Antes de abrir um pull request
1. `python3 -m unittest discover -s tests` passa (inclui o validador do vocabulário e as checagens de segurança).
2. Se mudou a trilha ou o vocabulário, rode `python3 ferramentas/gerar_trilha.py` e inclua os arquivos gerados.
3. Se mudou qualquer arquivo do app, aumente `VERSAO` em `sw.js`; se a numeração das etapas mudou, use "Zerar progresso" na área da mediadora.
4. Teste no navegador (`./testar.sh`) e, se possível, num celular Android. O teste de ponta a ponta (`python3 tests/e2e/run.py`, com `pip install -r tests/e2e/requirements.txt`) roda no CI; rode-o antes se mudou telas ou a trilha.
5. Atualize o `CHANGELOG.md` e use o modelo de pull request.

Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md). Decisões de arquitetura estão em [docs/decisoes.md](docs/decisoes.md).
