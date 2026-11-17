"""Utilitários compartilhados: servidor local e Chrome headless controlado pelo protocolo DevTools (CDP)."""
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from functools import partial
from pathlib import Path

try:
    import websocket
except ImportError:
    sys.exit("Instale a dependência de teste: pip install websocket-client")

RAIZ = Path(__file__).resolve().parents[2]


def porta_livre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def achar_chrome():
    for nome in filter(None, [os.environ.get("CHROME"), "google-chrome", "chromium", "chromium-browser"]):
        if shutil.which(nome):
            return shutil.which(nome)
    sys.exit("Chrome/Chromium não encontrado (defina a variável CHROME).")


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Navegador:
    def __init__(self, url_inicial):
        self.porta_cdp = porta_livre()
        self.perfil = tempfile.mkdtemp(prefix="pv-e2e-")
        self.proc = subprocess.Popen(
            [achar_chrome(), "--headless=new", "--no-sandbox", "--disable-gpu", f"--user-data-dir={self.perfil}",
             f"--remote-debugging-port={self.porta_cdp}", "--remote-allow-origins=*", "--window-size=390,844", "about:blank"],
            stderr=subprocess.DEVNULL)
        for _ in range(40):
            try:
                abas = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.porta_cdp}/json"))
                break
            except OSError:
                time.sleep(0.25)
        else:
            sys.exit("O navegador não iniciou.")
        self.ws = websocket.create_connection(next(a for a in abas if a["type"] == "page")["webSocketDebuggerUrl"], timeout=600)
        self.n = 0
        self.erros_js, self.erros_log = [], []
        self.cmd("Runtime.enable"); self.cmd("Page.enable"); self.cmd("Log.enable")
        self.cmd("Page.addScriptToEvaluateOnNewDocument",
                 source="window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));")
        self.ir(url_inicial)

    def cmd(self, metodo, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": metodo, "params": params}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get("method") == "Runtime.exceptionThrown":
                self.erros_js.append(r["params"]["exceptionDetails"].get("exception", {}).get("description", "?")[:200])
            if r.get("method") == "Log.entryAdded" and r["params"]["entry"]["level"] == "error":
                self.erros_log.append(r["params"]["entry"]["text"][:200])
            if r.get("id") == self.n:
                return r

    def ev(self, js):
        r = self.cmd("Runtime.evaluate", expression=js, awaitPromise=True, returnByValue=True)["result"]
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"])
        return r["result"].get("value")

    def ir(self, url):
        self.cmd("Page.navigate", url=url)
        time.sleep(2)

    def fechar(self):
        self.proc.terminate()
        shutil.rmtree(self.perfil, ignore_errors=True)


def servir():
    """Sobe o app numa porta livre e devolve (servidor, url)."""
    porta = porta_livre()
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", porta), partial(Silencioso, directory=str(RAIZ)))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    return servidor, f"http://127.0.0.1:{porta}/index.html"
