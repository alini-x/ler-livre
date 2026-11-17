"""Documentação: arquivos obrigatórios de um projeto open source, links internos e números do README."""
import json
import re
import unittest

from tests.raiz import RAIZ

IGNORAR = {".git", "_site", "__pycache__"}


def markdowns():
    return [p for p in RAIZ.rglob("*.md") if not IGNORAR.intersection(p.parts)]


class TestProjetoAberto(unittest.TestCase):
    def test_arquivos_obrigatorios(self):
        for nome in ("README.md", "LICENSE", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "CHANGELOG.md", ".gitignore",
                     ".editorconfig", ".github/PULL_REQUEST_TEMPLATE.md", ".github/dependabot.yml", "docs/decisoes.md", "docs/publicacao.md"):
            with self.subTest(arquivo=nome):
                self.assertTrue((RAIZ / nome).is_file(), nome)

    def test_modelos_de_issue(self):
        modelos = list((RAIZ / ".github" / "ISSUE_TEMPLATE").glob("*.yml"))
        self.assertGreaterEqual(len(modelos), 3)

    def test_licenca_mit(self):
        self.assertTrue((RAIZ / "LICENSE").read_text(encoding="utf-8").startswith("MIT License"))


class TestLinks(unittest.TestCase):
    def test_links_relativos_existem(self):
        padrao = re.compile(r"\]\(([^)\s#]+)(?:#[^)]*)?\)|src=\"([^\"]+)\"")
        for md in markdowns():
            for m in padrao.finditer(md.read_text(encoding="utf-8")):
                alvo = m.group(1) or m.group(2)
                if alvo.startswith(("http://", "https://", "mailto:")):
                    continue
                with self.subTest(arquivo=str(md.relative_to(RAIZ)), link=alvo):
                    self.assertTrue((md.parent / alvo).exists(), f"link quebrado: {alvo}")


class TestNumerosDoReadme(unittest.TestCase):
    """O README cita números do conteúdo; eles não podem ficar desatualizados."""

    def setUp(self):
        self.readme = (RAIZ / "README.md").read_text(encoding="utf-8")
        self.etapas = len(json.loads((RAIZ / "conteudo" / "trilha.json").read_text(encoding="utf-8"))["etapas"])
        self.palavras = len(json.loads((RAIZ / "conteudo" / "vocabulario.json").read_text(encoding="utf-8")))

    def test_numero_de_etapas(self):
        self.assertIn(f"{self.etapas} etapas", self.readme)

    def test_numero_de_palavras(self):
        self.assertIn(f"{self.palavras} palavras", self.readme)


if __name__ == "__main__":
    unittest.main()
