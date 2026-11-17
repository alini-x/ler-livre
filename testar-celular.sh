#!/bin/sh
# Serve o app na rede local (mesmo Wi-Fi) para testar no celular. Encerre com Ctrl+C.
# Atenção: por ser HTTP (não HTTPS), o celular NÃO registra o service worker (sem modo offline nem
# instalação). Voz, toque, telas e progresso funcionam normalmente.
# Para testar offline/instalação, use o app publicado no GitHub Pages (HTTPS) — veja o README.
cd "$(dirname "$0")" || exit 1
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") print $(i + 1)}')
if [ -z "$IP" ]; then
  echo "Não encontrei o IP da rede. Conecte-se ao Wi-Fi e tente de novo." >&2
  exit 1
fi
PORTA=8000
while ss -ltn 2>/dev/null | grep -q ":$PORTA "; do PORTA=$((PORTA + 1)); done
URL="http://$IP:$PORTA/index.html"
echo "No celular (no MESMO Wi-Fi), abra no Chrome:"
echo
echo "    $URL"
echo
if command -v qrencode >/dev/null 2>&1; then qrencode -t ANSIUTF8 "$URL"; fi
echo "Escutando só em $IP (rede local). Cada acesso do celular aparece abaixo. Ctrl+C para encerrar."
exec python3 -m http.server "$PORTA" --bind "$IP"
