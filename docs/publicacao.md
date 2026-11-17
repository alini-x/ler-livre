# Publicar no GitHub Pages

Marque cada item antes do primeiro `git push` público.

## Configurações do GitHub
- [ ] Verificação em duas etapas ativa na conta.
- [ ] *Settings → Pages → Source*: **GitHub Actions**; **Enforce HTTPS** ligado.
- [ ] *Settings → Code security*: ative alertas do Dependabot e o relato privado de vulnerabilidades (*Private vulnerability reporting*).
- [ ] Proteja a `main` (exigir pull request e o CI verde) se houver mais colaboradores.
- [x] Em `.github/ISSUE_TEMPLATE/config.yml`, confirme que o endereço do relato privado aponta para o repositório criado (`alini-x/ler-livre`).
- [x] Em `CODE_OF_CONDUCT.md`, confirme o canal de contato para relatos.

## Qualidade
- [x] `python3 -m unittest discover -s tests` verde.
- [x] `python3 tests/e2e/run.py` verde (precisa de Chrome/Chromium e `pip install websocket-client`).
- [x] Teste num celular Android real (Chrome): instalar, ouvir a voz, usar offline.
- [x] Depois de publicar: selos do CI e link do app publicado no README.

## Passo a passo

O service worker (modo offline e instalação) exige **HTTPS**, que o GitHub Pages oferece de graça. O repositório guarda só o app e o conteúdo geral, nunca dados da pessoa: nome, palavras e progresso são digitados no celular e ficam no IndexedDB dele.

1. **Crie o repositório** no GitHub. Em contas gratuitas o Pages exige repositório **público**, o que é seguro aqui porque o projeto não contém dados pessoais.
2. **Envie o código** (troque `SEU-USUARIO` e `ler-livre`):

   ```bash
   git remote add origin https://github.com/SEU-USUARIO/ler-livre.git
   git push -u origin main develop
   git push origin v0.1.0
   ```

   O histórico segue o Git Flow descrito em [CONTRIBUTING.md](../CONTRIBUTING.md): a `main` só recebe versões lançadas, com tag.

3. **Ative o Pages**: no repositório, vá em *Settings → Pages → Build and deployment → Source* e escolha **GitHub Actions**.
4. **Aguarde a publicação**: o fluxo `.github/workflows/pages.yml` valida o conteúdo e publica. Acompanhe na aba *Actions*; quando ficar verde, o endereço aparece em *Settings → Pages*:
   `https://SEU-USUARIO.github.io/ler-livre/`
5. **Abra no celular** (Chrome no Android) e use o menu ⋮ → *Instalar app* ou *Adicionar à tela inicial*.
6. **Confira o som**: abra o ⚙ → *Testar a voz*. Se não houver voz em português, instale o idioma Português (Brasil) em *Configurações → Acessibilidade → Saída de texto para fala* (ou o equivalente do fabricante).
7. **Teste o modo offline**: abra o app uma vez com internet, ative o modo avião e abra de novo pelo ícone.

**Para publicar uma atualização**: altere os arquivos, aumente `VERSAO` em `sw.js` (por exemplo `ler-livre-v12`), faça `git push`, e no celular abra o app duas vezes (a primeira baixa a versão nova em segundo plano, a segunda já a usa).
