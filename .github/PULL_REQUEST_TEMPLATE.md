## O que muda e por quê

<!-- Descreva a mudança e o problema que ela resolve. Link para a issue, se houver. -->

## Checklist

- [ ] `python3 -m unittest discover -s tests` passa
- [ ] Se mudou a trilha ou o vocabulário: `python3 ferramentas/gerar_trilha.py` e `python3 ferramentas/validar_vocabulario.py` rodados, e os arquivos gerados incluídos
- [ ] Se mudou qualquer arquivo do app: `VERSAO` em `sw.js` aumentada
- [ ] Toda atividade nova tem **voz** (`fala`) e **texto na tela** (`instrucao`, em maiúsculas)
- [ ] Sem `innerHTML`, `eval`, scripts/estilos inline nem recursos de outros domínios (veja [SECURITY.md](../SECURITY.md))
- [ ] Sem dados pessoais (nomes, fotos, progresso exportado, palavras de pessoas reais)
- [ ] Botões com no mínimo 56 px e testado nos temas claro e escuro
- [ ] `CHANGELOG.md` atualizado
