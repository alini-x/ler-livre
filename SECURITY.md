# Segurança

O Ler Livre é um app estático (HTML, CSS e JavaScript puros), sem servidor, sem conta e sem chamadas de rede além dos próprios arquivos. A superfície de ataque é pequena; este documento registra o que foi verificado, o que foi aceito de propósito e como reportar problemas.

## Modelo de ameaças

| O que protegemos | Ameaça | Controle |
|---|---|---|
| Dados da pessoa (nome, palavras, progresso), só no aparelho | Vazamento por rede ou por terceiros | Nenhuma chamada externa (CSP `connect-src 'self'`); sem analytics, anúncios ou CDNs; nada de dados no repositório (`.gitignore`) |
| Integridade do app | Injeção de script (XSS) por arquivo importado ou dado digitado | Todo conteúdo entra como texto (`textContent`/`append`), sem `innerHTML`, `eval` ou `document.write`; CSP `script-src 'self'` e `style-src 'self'`, sem `unsafe-inline` nem `unsafe-eval` |
| Arquivo de palavras importado | Arquivo malicioso ou enorme | Limite de 1 MB e 500 palavras; tipos e comprimentos validados; só campos conhecidos são copiados (sem mesclar objetos); caracteres de controle removidos |
| App servido | Troca do app por versão adulterada | Publicação só por HTTPS (GitHub Pages); service worker só do mesmo domínio e só respostas do próprio site vão para o cache |
| Cadeia de publicação | Ação de CI comprometida | Ações **fixadas por hash de commit** (conferidas nos repositórios oficiais); permissões mínimas por job; checkout sem credenciais persistidas; Dependabot propõe atualizações; nenhum segredo no repositório; testes impedem a regressão |
| App dentro de outra página | Clickjacking | O app se oculta se for embutido em moldura |
| Scripts de teste | Servidor aberto na rede local | `testar.sh` escuta só em `127.0.0.1` e guarda o perfil do navegador em pasta privada (`chmod 700`) |

## Riscos aceitos de propósito

- **A área da mediadora não tem senha.** Quem tocar no ⚙ pode alterar o nome, importar palavras, mudar ajustes ou zerar o progresso (esta ação pede confirmação). É decisão de projeto: uma senha criava atrito para a mediadora e não protegia de quem tem o aparelho desbloqueado. O botão é discreto, e a proteção real é a tela de bloqueio do celular.
- **Limpar os dados do site no navegador apaga progresso, nome e palavras.**
- **Os dados no aparelho não são criptografados** (IndexedDB do navegador). Use bloqueio de tela e não compartilhe o aparelho sem cuidado.
- **O arquivo de progresso exportado pode conter o nome e as palavras da pessoa.** O app avisa antes; guarde-o com cuidado.
- **Voz online.** A síntese de voz é do navegador. Se a voz escolhida for online (o ⚙ avisa), o texto falado, inclusive o nome, pode ser enviado ao serviço de voz dele. Prefira uma voz local (padrão do app quando existe).
- **A CSP é definida por `<meta>`** (o GitHub Pages não permite cabeçalhos HTTP): ela não cobre `frame-ancestors`, por isso há a proteção por script contra moldura.

## Boas práticas ao publicar

- Ative a verificação em duas etapas na conta do GitHub.
- Em *Settings → Pages*, mantenha **Enforce HTTPS** ligado.
- Veja o checklist completo em [docs/publicacao.md](docs/publicacao.md).
- Proteja a branch `main` (exigir pull request) se houver mais de uma pessoa contribuindo.
- Nunca envie ao repositório exportações de progresso, listas de palavras da pessoa ou fotos.
- Ao mexer no código, mantenha as regras: sem `innerHTML`, `eval`, scripts ou estilos inline, nem recursos de outros domínios.

## Como reportar uma vulnerabilidade

Use *Security → Report a vulnerability* no repositório do GitHub (relato privado) ou abra uma issue sem detalhes sensíveis pedindo contato. Descreva o passo a passo para reproduzir. Não inclua dados de pessoas reais.

## Como foi verificado

Os controles acima são checados a cada push pelos testes em `tests/` (CSP, sinks perigosos, recursos externos, segredos, ações fixadas por hash) e pelo teste de ponta a ponta em `tests/e2e/run.py`. Além disso, revisão manual do código e testes em navegador: ausência de sinks perigosos de DOM; CSP bloqueando scripts e estilos inline, `eval`, rede e imagens externas; as 70 etapas e a área da mediadora rodando sem violações de CSP; importação com payloads de XSS e de poluição de protótipo sem execução nem efeito; arquivos grandes, com mais de 500 itens e inválidos rejeitados. Não houve teste de penetração externo nem auditoria independente.
