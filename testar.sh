#!/bin/sh
# Abre o app para testar COM SOM no computador.
# Uso: ./testar.sh [chromium|brave|firefox]   (padrão: chromium)
# Chromium e Brave só enxergam a voz do sistema com --enable-speech-dispatcher (este script liga).
cd "$(dirname "$0")" || exit 1
NAVEGADOR="${1:-chromium}"
PORTA=8000
while ss -ltn 2>/dev/null | grep -q ":$PORTA "; do PORTA=$((PORTA + 1)); done
python3 -m http.server "$PORTA" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT INT TERM
# espera o servidor responder antes de abrir o navegador
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null "http://127.0.0.1:$PORTA/index.html" && break; sleep 0.5; done
URL="http://127.0.0.1:$PORTA/index.html"
PERFIL="${XDG_CACHE_HOME:-$HOME/.cache}/ler-livre/perfil-$NAVEGADOR"
mkdir -p "$PERFIL" && chmod 700 "$PERFIL"
echo "Aberto em $URL — feche o navegador (ou Ctrl+C aqui) para encerrar o servidor."
case "$NAVEGADOR" in
  brave) brave-browser --enable-speech-dispatcher --user-data-dir="$PERFIL" "$URL" ;;
  firefox) firefox --new-instance --profile "$(mktemp -d)" "$URL" ;;
  *) chromium --enable-speech-dispatcher --user-data-dir="$PERFIL" "$URL" ;;
esac
