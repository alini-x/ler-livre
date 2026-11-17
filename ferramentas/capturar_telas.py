#!/usr/bin/env python3
"""Gera as capturas de tela do README (docs/img/) com dados fictícios: sem nome nem palavras de pessoas reais.

Requisitos: Chrome/Chromium e `pip install websocket-client`. Uso: python3 ferramentas/capturar_telas.py
"""
import base64
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests" / "e2e"))
from navegador import RAIZ, Navegador, servir  # noqa: E402

SAIDA = RAIZ / "docs" / "img"
# (arquivo, esquema de cores, etapa e índice a abrir, ações no app)
CAPTURAS = [
    ("home-claro.png", "light", {"concluidas": list(range(1, 10)), "etapa": 10, "indice": 0}, ""),
    ("home-escuro.png", "dark", {"concluidas": list(range(1, 10)), "etapa": 10, "indice": 0}, ""),
    ("atividade-claro.png", "light", {"concluidas": [], "etapa": 1, "indice": 5}, "document.querySelector('.btn-grande').click();"),
    ("montar-escuro.png", "dark", {"concluidas": list(range(1, 23)), "etapa": 23, "indice": 1}, "document.querySelector('.btn-grande').click();"),
]


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    servidor, base = servir()
    nav = Navegador(base)
    try:
        nav.cmd("Emulation.setDeviceMetricsOverride", width=390, height=800, deviceScaleFactor=2, mobile=True)
        for arquivo, esquema, estado, acao in CAPTURAS:
            nav.ev(f"""(async()=>{{const d=await import('/js/db.js');await d.zerarProgresso();
                await d.setConfig('estado',{{etapa:{estado['etapa']},indice:{estado['indice']},primeira:0}});
                await d.setConfig('concluidas',{estado['concluidas']});}})()""")
            nav.cmd("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": esquema}])
            nav.ir(base)
            if acao:
                nav.ev(acao)
                time.sleep(1)
            nav.ev("document.getElementById('aviso-voz').hidden = true")  # o Chrome headless não tem voz
            (SAIDA / arquivo).write_bytes(base64.b64decode(nav.cmd("Page.captureScreenshot", format="png")["result"]["data"]))
            print("gerado:", SAIDA / arquivo)
    finally:
        nav.fechar()
        servidor.shutdown()


if __name__ == "__main__":
    main()
