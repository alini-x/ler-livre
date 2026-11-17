# Confere conteudo/vocabulario.json: sílabas somam a palavra, figura preenchida e palavra liberada em algum ponto da trilha.
import json, os, sys, unicodedata
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
def norm(s):
    d = unicodedata.normalize('NFD', s.upper()); return unicodedata.normalize('NFC', ''.join(c for c in d if c not in '̀́̂̃'))
voc = json.load(open('conteudo/vocabulario.json')); tr = json.load(open('conteudo/trilha.json'))['etapas']
conj = {'A','E','I','O','U'} | {norm(s) for e in tr for s in e.get('silabas', [])}; fin = {f for e in tr for f in e.get('finais', [])}
def ok(s):
    x = norm(s)
    if x in conj: return True
    for _ in range(2):
        if x and x[-1] in fin: x = x[:-1]
        else: break
        if x in conj: return True
    return False
erros = 0
vistas = set()
for v in voc:
    p = v['palavra']
    if ''.join(v['silabas']) != p: print('sílabas não somam:', p, v['silabas']); erros += 1
    if not v.get('figura'): print('sem figura:', p); erros += 1
    if p in vistas: print('repetida:', p); erros += 1
    vistas.add(p)
    faltam = [s for s in v['silabas'] if not ok(s)]
    if faltam: print('sílaba que a trilha não ensina:', p, faltam); erros += 1
print(f'{len(voc)} palavras, {erros} problema(s)'); sys.exit(1 if erros else 0)
