# Requisitos

**Aparelho de referência:** Motorola Edge 60 (lançado com Android 15), no Chrome. Ele atende a todos os requisitos abaixo. Nenhum teste foi feito ainda no aparelho real.

### Android (por causa dos emojis das figuras)
Como a figura é o que ensina a palavra a quem não lê, um emoji que o aparelho não conhece aparece como um quadrado vazio. O app usa 266 emojis distintos; o mais novo é do **Emoji 15.0** (🪽 em ASA e 🫏 em BURRO). Quem define o que aparece é a fonte de emojis do Android, que muda com a versão do sistema (os dados de versão dos emojis vêm do `emoji-test.txt` do Unicode; a relação com o Android segue a tabela da Google e pode variar um pouco por fabricante):

| Android | Emoji | O que falta aparecer |
|---|---|---|
| **14 ou mais** (recomendado) | 15.0 | nada: todas as figuras aparecem |
| 13 | 14.0 | 🪽 ASA e 🫏 BURRO |
| 12 | 13.x | as 2 acima, mais 🫙 POTE, 🛞 RODA, 🫗 JARRO, 🪺 NINHO, 🫘 FEIJÃO e o ícone 🪪 de "Meu nome" |
| 11 ou menos | 12 ou menos | as 8 acima, mais 11 palavras (BULE, BONECA, FOCA, JANELA, CHINELO, ESPELHO, MINHOCA, SERRA, AÇAÍ, PLANTA, ESCADA) e figuras do alfabeto |

Ou seja: **Android 14 ou mais** mostra tudo. Em versões anteriores o app continua funcionando e a maior parte do vocabulário (230 de 237 palavras já aparecem no Android 12), mas algumas figuras ficam vazias. Se for preciso dar suporte a aparelhos mais antigos, o caminho é trocar esses emojis por figuras próprias (ver *Limitações e próximos passos* no README).

### Navegador
- **Recomendado e alvo: Chrome para Android, versão 105 ou mais** (em Android 14 o Chrome vem muito acima disso e se atualiza pela Play Store).
- **Mínimo técnico: Chrome 86** (ou equivalente baseado no Chromium: Edge, Brave, Samsung Internet). Abaixo disso o código para de funcionar (`replaceChildren`, `:focus-visible`, `||=`). Entre as versões 86 e 104 só o visual muda um pouco (`:has()` e `dvh` são usados em detalhes de layout).
- O app também usa: HTTPS (service worker), módulos ES, IndexedDB, Pointer Events, canvas e `speechSynthesis`.
- **Voz:** o aparelho precisa ter uma voz em português do Brasil, normalmente a "Síntese de fala do Google" com o idioma Português (Brasil) instalado (*Configurações → Acessibilidade → Saída de texto para fala*). Sem ela o app abre, mas fica mudo e mostra um aviso amarelo.
- **Computador (só para testes):** Chrome, Chromium, Edge e Brave recentes (no Linux, com `--enable-speech-dispatcher`; use `./testar.sh`) e Firefox recente. O app não foi testado em iPhone/Safari: o Safari costuma apagar os dados de sites não instalados depois de uma semana sem uso, o que apagaria o progresso.
