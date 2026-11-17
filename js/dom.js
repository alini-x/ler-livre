// Cria elementos do DOM sem innerHTML: os textos entram como nós de texto, nunca como HTML.
// A CSP e os testes de segurança dependem disso; por isso o estilo vai por CSSOM, não pelo atributo style.
export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'checked') el.checked = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null) el.append(f);
  return el;
}
