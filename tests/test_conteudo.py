"""Consistência do conteúdo: trilha, etapas, vocabulário, frases, letras e arquivos gerados."""
import filecmp
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import unittest
from pathlib import Path

from tests.raiz import RAIZ

CONTEUDO = RAIZ / "conteudo"
TIPOS = {"apresentar", "ouvir-e-tocar", "montar", "ordenar", "criar-palavras", "tracar", "ler"}
FONTES = {"nome", "nome-inicial", "palavras-da-pessoa", "palavras-da-vida", "frases-da-pessoa", "frases", "vocabulario"}


def carregar(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def norm(s):
    d = unicodedata.normalize("NFD", s.upper())
    return unicodedata.normalize("NFC", "".join(c for c in d if c not in "̀́̂̃"))


class TestTrilha(unittest.TestCase):
    def setUp(self):
        self.etapas = carregar(CONTEUDO / "trilha.json")["etapas"]

    def test_numeracao_sequencial_sem_buracos(self):
        self.assertEqual([e["n"] for e in self.etapas], list(range(1, len(self.etapas) + 1)))

    def test_cada_etapa_tem_arquivo_e_campos_obrigatorios(self):
        for e in self.etapas:
            with self.subTest(etapa=e["n"]):
                for campo in ("id", "titulo", "icone", "arquivo", "trilha"):
                    self.assertTrue(e.get(campo), f"falta {campo}")
                self.assertTrue((RAIZ / e["arquivo"]).is_file(), e["arquivo"])
                self.assertIn(e["trilha"], range(1, 9))

    def test_nao_ha_arquivo_de_etapa_orfao(self):
        referenciados = {(RAIZ / e["arquivo"]).name for e in self.etapas}
        existentes = {p.name for p in CONTEUDO.glob("etapa-*.json")}
        self.assertEqual(existentes, referenciados)


class TestEtapas(unittest.TestCase):
    def test_atividades_completas_e_coerentes(self):
        for e in carregar(CONTEUDO / "trilha.json")["etapas"]:
            d = carregar(RAIZ / e["arquivo"])
            with self.subTest(etapa=e["n"], id=e["id"]):
                self.assertEqual(d["etapa"], e["n"])
                for campo in ("fala_inicial", "texto_inicial", "fala_fim", "criterio", "atividades"):
                    self.assertTrue(d.get(campo), f"falta {campo}")
                for i, a in enumerate(d["atividades"]):
                    if "fonte" in a:
                        self.assertIn(a["fonte"], FONTES)
                        continue
                    self.assertIn(a["tipo"], TIPOS, f"atividade {i}")
                    # Regra do projeto: toda atividade tem voz (fala) e texto na tela (instrucao).
                    self.assertTrue(a.get("fala"), f"atividade {i} sem fala")
                    self.assertTrue(a.get("instrucao"), f"atividade {i} sem instrucao")
                    if a["tipo"] == "ouvir-e-tocar":
                        self.assertIn(a["correta"], a["opcoes"])
                        self.assertEqual(len(set(a["opcoes"])), len(a["opcoes"]), "opções repetidas")
                    if a["tipo"] == "montar" and "unidades" in a:
                        self.assertEqual("".join(a["unidades"]), a["palavra"])

    def test_textos_da_tela_em_maiusculas(self):
        # Letras de imprensa maiúsculas na tela (regra do projeto); a voz (fala) é livre.
        for e in carregar(CONTEUDO / "trilha.json")["etapas"]:
            d = carregar(RAIZ / e["arquivo"])
            with self.subTest(etapa=e["n"]):
                self.assertEqual(d["texto_inicial"], d["texto_inicial"].upper())
                for a in d["atividades"]:
                    if "instrucao" in a:
                        self.assertEqual(a["instrucao"], a["instrucao"].upper(), a["instrucao"])


class TestVocabulario(unittest.TestCase):
    def test_validador_do_vocabulario_passa(self):
        r = subprocess.run([sys.executable, str(RAIZ / "ferramentas" / "validar_vocabulario.py")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_palavras_unicas_maiusculas_com_figura(self):
        voc = carregar(CONTEUDO / "vocabulario.json")
        palavras = [v["palavra"] for v in voc]
        self.assertEqual(len(palavras), len(set(palavras)), "palavras repetidas")
        for v in voc:
            with self.subTest(v["palavra"]):
                self.assertEqual(v["palavra"], v["palavra"].upper())
                self.assertEqual("".join(v["silabas"]), v["palavra"])
                self.assertGreaterEqual(len(v["silabas"]), 2)
                self.assertTrue(v["figura"].strip())

    def test_frases_em_maiusculas_sem_pontuacao(self):
        for f in carregar(CONTEUDO / "frases.json"):
            with self.subTest(f["frase"]):
                self.assertEqual(f["frase"], f["frase"].upper())
                self.assertNotRegex(f["frase"], r"[.,;:!?]")
                self.assertTrue(f["figura"].strip())

    def test_todas_as_letras_tem_pronuncia(self):
        letras = carregar(CONTEUDO / "letras.json")
        for l in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            self.assertTrue(letras.get(l), l)

    def test_pronuncias_de_silabas_em_maiusculas(self):
        for chave, fala in carregar(CONTEUDO / "silabas-fala.json")["falas"].items():
            self.assertEqual(chave, chave.upper())
            self.assertTrue(fala.strip())


class TestFalas(unittest.TestCase):
    """A voz do aparelho soletra siglas e descreve letras acentuadas isoladas; o conteúdo precisa evitar isso."""

    CAMPOS = ("fala", "dica", "falaDepois", "fala_inicial", "fala_fim")
    MARCADOR = re.compile(r"\{([sl]):([^}]+)\}")

    def falas(self):
        for e in carregar(CONTEUDO / "trilha.json")["etapas"]:
            d = carregar(RAIZ / e["arquivo"])
            for campo in ("fala_inicial", "fala_fim", "titulo_fala"):
                if isinstance(d.get(campo), str):
                    yield f"{e['arquivo']}:{campo}", d[campo]
            if isinstance(e.get("titulo_fala"), str):
                yield f"trilha.json:{e['id']}.titulo_fala", e["titulo_fala"]
            for i, a in enumerate(d["atividades"]):
                for campo in self.CAMPOS:
                    if isinstance(a.get(campo), str):
                        yield f"{e['arquivo']}[{i}].{campo}", a[campo]

    def test_marcadores_apontam_para_letras_e_silabas_que_existem(self):
        letras = {k for k in carregar(CONTEUDO / "letras.json") if len(k) == 1}
        silabas = {s for e in carregar(CONTEUDO / "trilha.json")["etapas"] for s in e.get("silabas", [])}
        for origem, texto in self.falas():
            for tipo, valor in self.MARCADOR.findall(texto):
                with self.subTest(origem=origem, marcador=f"{{{tipo}:{valor}}}"):
                    self.assertIn(valor, letras if tipo == "l" else silabas)

    def test_sem_palavras_em_maiusculas_que_a_voz_soletraria(self):
        for origem, texto in self.falas():
            sem_marcadores = self.MARCADOR.sub("", texto)
            with self.subTest(origem=origem):
                self.assertIsNone(re.search(r"\b[A-ZÀ-Ý]{2,}\b", sem_marcadores), "use minúsculas ou um marcador {l:X}/{s:XX}: " + texto)
                # letra solta em maiúscula ("com B e R"): a voz não sabe se é letra ou palavra
                self.assertIsNone(re.search(r"(?<![\wÀ-ÿ])[B-DF-HJ-NP-TV-XZ](?![\wÀ-ÿ])", sem_marcadores), "letra solta, use {l:X}: " + texto)

    def test_sem_ê_ou_ô_isolados(self):
        for origem, texto in self.falas():
            with self.subTest(origem=origem):
                self.assertIsNone(re.search(r"(?<![\w])[êôÊÔ](?![\w])", self.MARCADOR.sub("", texto)), "a voz diz 'e com acento circunflexo': " + texto)

    def test_titulo_falado_das_familias_usa_marcadores(self):
        """O título aparece em maiúsculas, mas é falado: sem titulo_fala a voz soletra "gue", "nh", "br"."""
        for e in carregar(CONTEUDO / "trilha.json")["etapas"]:
            if e.get("silabas") and e["id"] not in {"ditongos", "til"}:
                with self.subTest(etapa=e["id"]):
                    self.assertTrue(e.get("titulo_fala"), "falta titulo_fala")
                    self.assertTrue(self.MARCADOR.search(e["titulo_fala"]), "o título falado deve usar {l:X}/{s:XX}: " + e["titulo_fala"])
                    self.assertEqual(carregar(RAIZ / e["arquivo"])["titulo_fala"], e["titulo_fala"])

    # Palavras reais com o som das sílabas em E/O (frequência comum no português do Brasil, lista OpenSubtitles pt-BR).
    # "tê" (nome da letra) e "mê" ficam abaixo do limiar de frequência: o clítico "te"/"me" sem acento sai "ti"/"mi".
    PALAVRAS_REAIS = {"cê", "dê", "fé", "lê", "mê", "né", "pé", "ré", "sê", "tê", "vê", "zé", "quê", "dó", "nó", "pó", "só", "tô", "vó"}

    def test_estilo_equilibrado_usa_palavra_real_e_nao_repete_a_silaba(self):
        reais = carregar(CONTEUDO / "silabas-fala.json")["reais"]
        for plana, real in reais.items():
            with self.subTest(silaba=plana):
                self.assertIn(real, self.PALAVRAS_REAIS)
                self.assertEqual(unicodedata.normalize("NFD", real)[0:len(plana) - 1], plana[:-1], "a palavra real deve começar pela mesma consoante")
                self.assertNotEqual(real, plana + plana, "o estilo equilibrado não repete a sílaba")

    def test_nomes_de_letras_sem_letra_acentuada_isolada(self):
        # Só "é" e "ó" são palavras; "ê", "ô" etc. isolados são descritos pela voz.
        for letra, nome in carregar(CONTEUDO / "letras.json").items():
            if len(letra) == 1:
                with self.subTest(letra=letra):
                    decomposto = unicodedata.normalize("NFD", nome)
                    if len(nome) == 1 and len(decomposto) > 1:
                        self.assertIn(nome, {"é", "ó"})

    def test_formas_planas_das_silabas_sem_acento(self):
        """O conteúdo guarda só a forma plana do som; acento e vogal de apoio vêm do estilo escolhido no aparelho.
        Sílabas acentuadas que não são palavras são soletradas pela voz ("g, a com acento agudo")."""
        for chave, fala in carregar(CONTEUDO / "silabas-fala.json")["falas"].items():
            with self.subTest(silaba=chave):
                self.assertEqual(chave, chave.upper())
                self.assertEqual(fala, fala.lower())
                sem_til = fala.replace("ã", "a").replace("õ", "o")   # nasais ão, ãe, õe mantêm o til
                self.assertEqual(unicodedata.normalize("NFD", sem_til), sem_til, "forma plana não leva acento: " + fala)


class TestGeracao(unittest.TestCase):
    def test_arquivos_gerados_estao_em_dia(self):
        """Rodar o gerador deve reproduzir exatamente o que está versionado (ninguém editou à mão)."""
        with tempfile.TemporaryDirectory() as tmp:
            copia = Path(shutil.copytree(RAIZ, tmp + "/copia", ignore=shutil.ignore_patterns(".git", "__pycache__", "_site")))
            r = subprocess.run([sys.executable, "ferramentas/gerar_trilha.py"], cwd=copia, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            diferencas = []
            for p in sorted((RAIZ / "conteudo").glob("*.json")):
                if not filecmp.cmp(p, copia / "conteudo" / p.name, shallow=False):
                    diferencas.append(p.name)
            self.assertEqual(diferencas, [], "regenere com: python3 ferramentas/gerar_trilha.py")


if __name__ == "__main__":
    unittest.main()
