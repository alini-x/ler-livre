"""Verificações estáticas de segurança e privacidade (ver SECURITY.md)."""
import json
import re
import unittest

from tests.raiz import RAIZ

CODIGO = [*sorted((RAIZ / "js").glob("*.js")), RAIZ / "sw.js", RAIZ / "index.html"]
TEXTOS = [p for p in RAIZ.rglob("*") if p.is_file() and p.suffix in {".js", ".html", ".css", ".json", ".md", ".py", ".sh", ".yml", ".yaml", ".webmanifest", ".txt"}
          and not any(parte in {".git", "_site", "__pycache__"} for parte in p.parts)]


def ler(p):
    return p.read_text(encoding="utf-8")


class TestCodigoSeguro(unittest.TestCase):
    PROIBIDOS = {
        r"\.innerHTML\b": "innerHTML (use textContent/append)",
        r"\.outerHTML\b": "outerHTML",
        r"insertAdjacentHTML": "insertAdjacentHTML",
        r"document\.write": "document.write",
        r"\beval\s*\(": "eval",
        r"new\s+Function\s*\(": "new Function",
        r"set(Timeout|Interval)\s*\(\s*['\"`]": "setTimeout/setInterval com texto",
        r"javascript:": "URL javascript:",
        r"\bsrcdoc\b": "srcdoc",
        r"importScripts\s*\(": "importScripts",
    }

    def test_sem_sinks_perigosos(self):
        for p in CODIGO:
            texto = ler(p)
            for padrao, nome in self.PROIBIDOS.items():
                with self.subTest(arquivo=p.name, regra=nome):
                    self.assertIsNone(re.search(padrao, texto), f"{p.name}: {nome}")

    def test_sem_recursos_externos_no_codigo(self):
        # O app só carrega arquivos próprios: nada de CDN, fontes, analytics ou outro domínio.
        for p in CODIGO:
            for m in re.finditer(r"https?://[^\s'\"<>)]+", ler(p)):
                with self.subTest(arquivo=p.name, url=m.group(0)):
                    self.fail("URL externa no código: " + m.group(0))

    def test_sem_apis_de_rede_alem_do_fetch_local(self):
        for p in CODIGO:
            for api in ("XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"):
                with self.subTest(arquivo=p.name, api=api):
                    self.assertNotIn(api, ler(p))

    def test_fetch_so_para_caminhos_relativos(self):
        for p in CODIGO:
            for m in re.finditer(r"fetch\(\s*['\"`]([^'\"`]+)", ler(p)):
                with self.subTest(arquivo=p.name, alvo=m.group(1)):
                    self.assertFalse(m.group(1).startswith(("http", "//", "/")), m.group(1))


class TestSemBecoSemSaida(unittest.TestCase):
    """Quem aprende nunca deve ficar preso numa tela nem apagar o próprio progresso por engano."""

    def test_aprendiz_nao_tem_como_apagar_o_progresso(self):
        # zerarProgresso só pode ser chamado na área da mediadora (longe do fluxo de quem aprende), nunca em js/app.js.
        self.assertNotIn("zerarProgresso", ler(RAIZ / "js" / "app.js"))
        self.assertIn("zerarProgresso", ler(RAIZ / "js" / "mediadora.js"))

    def test_botao_inicio_em_todas_as_telas(self):
        html = ler(RAIZ / "index.html")
        self.assertIn('id="btn-inicio"', html)
        app = ler(RAIZ / "js" / "app.js")
        self.assertIn("btnInicio.hidden = home", app, "mostrar() controla o 🏠 em toda tela")
        self.assertIn("popstate", app, "o botão Voltar do Android leva ao início")

    def test_atividades_tem_saida_de_emergencia(self):
        app = ler(RAIZ / "js" / "app.js")
        self.assertIn("'PULAR'", app)
        self.assertIn("telaErro", app, "falha ao abrir algo mostra uma tela com saída")


class TestCSP(unittest.TestCase):
    def setUp(self):
        html = ler(RAIZ / "index.html")
        m = re.search(r'http-equiv="Content-Security-Policy"\s+content="([^"]+)"', html)
        self.assertIsNotNone(m, "index.html sem CSP")
        self.html = html
        self.csp = {d.split()[0]: d.split()[1:] for d in m.group(1).split(";") if d.strip()}

    def test_diretivas_restritivas(self):
        self.assertEqual(self.csp["default-src"], ["'none'"])
        for diretiva in ("script-src", "style-src", "connect-src", "worker-src", "manifest-src", "img-src"):
            self.assertEqual(self.csp[diretiva], ["'self'"], diretiva)
        self.assertEqual(self.csp["object-src"], ["'none'"])
        self.assertEqual(self.csp["base-uri"], ["'none'"])
        self.assertEqual(self.csp["form-action"], ["'none'"])

    def test_sem_unsafe(self):
        self.assertNotIn("unsafe-inline", str(self.csp))
        self.assertNotIn("unsafe-eval", str(self.csp))

    def test_html_sem_script_ou_estilo_inline(self):
        self.assertIsNone(re.search(r"<script(?![^>]*\bsrc=)[^>]*>", self.html), "script inline")
        self.assertIsNone(re.search(r"<style\b", self.html), "bloco <style>")
        self.assertIsNone(re.search(r'\sstyle="', self.html), "atributo style inline")
        self.assertIsNone(re.search(r"\son\w+=", self.html), "manipulador de evento inline")


class TestPrivacidade(unittest.TestCase):
    SEGREDOS = [r"ghp_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9_]{20,}", r"AKIA[0-9A-Z]{16}", r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
                r"xox[baprs]-[A-Za-z0-9-]{10,}", r"AIza[0-9A-Za-z_-]{30,}"]

    def test_sem_segredos(self):
        for p in TEXTOS:
            texto = ler(p)
            for padrao in self.SEGREDOS:
                with self.subTest(arquivo=str(p.relative_to(RAIZ)), padrao=padrao):
                    self.assertIsNone(re.search(padrao, texto))

    def test_sem_emails_nem_caminhos_pessoais(self):
        for p in TEXTOS:
            if p.name in {"LICENSE"}:
                continue
            texto = ler(p)
            with self.subTest(arquivo=str(p.relative_to(RAIZ))):
                self.assertIsNone(re.search(r"/home/[a-z0-9_-]+/", texto), "caminho local")
                self.assertIsNone(re.search(r"/Users/[A-Za-z0-9_-]+/", texto), "caminho local")
                for m in re.finditer(r"[\w.+-]+@[\w-]+\.[\w.-]+", texto):
                    self.assertTrue(m.group(0).endswith(("users.noreply.github.com", "example.com", "example.org")), "e-mail no repositório: " + m.group(0))

    def test_gitignore_protege_dados_da_pessoa(self):
        gi = ler(RAIZ / ".gitignore")
        for padrao in ("progresso-ler-livre-*.json", "palavras-*.json"):
            self.assertIn(padrao, gi)

    def test_nenhum_arquivo_de_dados_pessoais_versionavel(self):
        suspeitos = [p.name for p in RAIZ.glob("*.json") if p.name.startswith(("progresso-", "palavras-"))]
        self.assertEqual(suspeitos, [])


class TestCadeiaDeSuprimentos(unittest.TestCase):
    def test_acoes_fixadas_por_hash_de_commit(self):
        for p in sorted((RAIZ / ".github" / "workflows").glob("*.y*ml")):
            for m in re.finditer(r"uses:\s*([^\s#]+)", ler(p)):
                with self.subTest(arquivo=p.name, acao=m.group(1)):
                    self.assertRegex(m.group(1), r"@[0-9a-f]{40}$", "fixe a ação por hash de commit")

    def test_runner_com_versao_fixa(self):
        for p in sorted((RAIZ / ".github" / "workflows").glob("*.y*ml")):
            with self.subTest(arquivo=p.name):
                self.assertNotIn("-latest", ler(p), "fixe a imagem do runner (ex.: ubuntu-24.04)")

    def test_dependencias_dos_testes_fixadas(self):
        for linha in (RAIZ / "tests" / "e2e" / "requirements.txt").read_text(encoding="utf-8").split():
            self.assertRegex(linha, r"^[A-Za-z0-9_.-]+==[0-9.]+$", "fixe a versão exata")

    def test_workflows_com_permissoes_minimas(self):
        for p in sorted((RAIZ / ".github" / "workflows").glob("*.y*ml")):
            texto = ler(p)
            with self.subTest(arquivo=p.name):
                self.assertNotIn("write-all", texto)
                self.assertNotIn("pull_request_target", texto)
                self.assertRegex(texto, r"(?m)^permissions:\s*\n\s+contents:\s*read")

    def test_checkout_sem_credenciais_persistidas(self):
        for p in sorted((RAIZ / ".github" / "workflows").glob("*.y*ml")):
            texto = ler(p)
            self.assertEqual(texto.count("actions/checkout"), texto.count("persist-credentials: false"), p.name)

    def test_dependabot_configurado(self):
        self.assertIn("github-actions", ler(RAIZ / ".github" / "dependabot.yml"))
        self.assertIn("pip", ler(RAIZ / ".github" / "dependabot.yml"))

    def test_sem_dependencias_de_execucao(self):
        for nome in ("package.json", "package-lock.json", "requirements.txt", "pyproject.toml"):
            self.assertFalse((RAIZ / nome).exists(), f"{nome}: o app deve continuar sem dependências de execução")


class TestPWA(unittest.TestCase):
    def test_manifesto(self):
        m = json.loads(ler(RAIZ / "manifest.webmanifest"))
        for campo in ("name", "short_name", "lang", "start_url", "display", "icons", "theme_color", "background_color"):
            self.assertIn(campo, m)
        self.assertEqual(m["lang"], "pt-BR")
        self.assertFalse(m["start_url"].startswith(("/", "http")), "start_url deve ser relativo (GitHub Pages usa subpasta)")
        for icone in m["icons"]:
            self.assertTrue((RAIZ / icone["src"]).is_file(), icone["src"])
        self.assertTrue(any(i.get("purpose") == "maskable" for i in m["icons"]))

    def test_service_worker_precache_existe(self):
        sw = ler(RAIZ / "sw.js")
        self.assertRegex(sw, r"const VERSAO = 'ler-livre-v\d+'")
        for arquivo in re.findall(r"'((?:css|js|conteudo|icones)/[^']+|index\.html|manifest\.webmanifest)'", sw):
            self.assertTrue((RAIZ / arquivo).is_file(), arquivo)
        self.assertIn("trilha.etapas", sw, "as etapas devem vir da trilha")
        self.assertIn("r.type === 'basic'", sw, "só respostas do próprio site vão para o cache")

    def test_html_basico(self):
        html = ler(RAIZ / "index.html")
        self.assertIn('<html lang="pt-BR">', html)
        self.assertIn("width=device-width", html)
        self.assertNotIn("user-scalable=no", html, "não bloquear o zoom")


class TestAcessibilidade(unittest.TestCase):
    def test_alvos_de_toque_de_56px(self):
        css = ler(RAIZ / "css" / "estilo.css")
        self.assertRegex(css, r"button\s*\{[^}]*min-height:\s*56px", "botões com no mínimo 56 px")
        self.assertRegex(css, r"button\s*\{[^}]*min-width:\s*56px")

    def test_respeita_movimento_reduzido_e_foco_visivel(self):
        css = ler(RAIZ / "css" / "estilo.css")
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn(":focus-visible", css)

    def test_letra_dos_cartoes_acompanha_o_numero_de_letras(self):
        # Sílabas de 3 letras estouravam o cartão: o tamanho da fonte varia com data-n (e há ajuste automático no app).
        css = ler(RAIZ / "css" / "estilo.css")
        self.assertIn('.cartao[data-n="3"]', css)
        self.assertIn("function encaixar", ler(RAIZ / "js" / "app.js"))

    def test_tema_claro_e_escuro(self):
        css = ler(RAIZ / "css" / "estilo.css")
        self.assertIn("prefers-color-scheme: dark", css)


if __name__ == "__main__":
    unittest.main()
