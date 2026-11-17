# Gera conteudo/trilha.json e conteudo/etapa-*.json. Rode: python3 ferramentas/gerar_trilha.py  (depois aumente VERSAO em sw.js)
import json, random, os, unicodedata
random.seed(11)
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))
letras=json.load(open('conteudo/letras.json'))
def norm(s):
    d=unicodedata.normalize('NFD',s.upper())
    return unicodedata.normalize('NFC',''.join(c for c in d if c not in '̀́̂̃'))
# Forma PLANA do som das sílabas que a escrita não representa de forma direta (U mudo, dígrafos, C/G que mudam de som).
# Sem acento e sem vogal de apoio: a voz soletra sílabas acentuadas que não são palavras ("gá" vira "g, a com acento agudo").
# O app aplica por cima o ESTILO escolhido no aparelho (⚙ → Pronúncia): equilibrado, sem acento, com acento, repetida ou com apoio.
FALAS={'CE':'se','CI':'si','GE':'je','GI':'ji','QUE':'que','QUI':'qui','GUE':'gue','GUI':'gui','CHA':'cha','CHE':'che','CHI':'chi','CHO':'cho','CHU':'chu',
 'LHA':'lha','LHE':'lhe','LHI':'lhi','LHO':'lho','LHU':'lhu','NHA':'nha','NHE':'nhe','NHI':'nhi','NHO':'nho','NHU':'nhu',
 'RRA':'rra','RRE':'rre','RRI':'rri','RRO':'rro','RRU':'rru','SSA':'sa','SSE':'se','SSI':'si','SSO':'so','SSU':'su','ÇA':'sa','ÇO':'so','ÇU':'su',
 'XA':'cha','XE':'che','XI':'chi','XO':'cho','XU':'chu','ÃO':'ão','ÃE':'ãe','ÕE':'õe'}
# No conteúdo, a pronúncia nunca é gravada: use {l:E} (nome da letra) e {s:NHE} (sílaba). O app resolve na hora de falar,
# com os ajustes feitos no aparelho (⚙ → Pronúncia de letras e sílabas).
def L(x): return "{l:%s}"%x
def S(x): return "{s:%s}"%x
# Estilo "equilibrado": sílabas com E e O sem acento perdem o som (a voz lê "be" como "bi"), e acentuadas que não são palavras
# são soletradas. Quando existe uma PALAVRA REAL com o som (frequência comum no português do Brasil, lista OpenSubtitles pt-BR),
# a voz a lê normalmente, sem soletrar e sem repetir a sílaba. As demais ficam na forma plana.
REAIS={'ce':'cê','de':'dê','fe':'fé','le':'lê','me':'mê','ne':'né','pe':'pé','re':'ré','se':'sê','te':'tê','ve':'vê','ze':'zé','que':'quê',
 'do':'dó','no':'nó','po':'pó','so':'só','to':'tô','vo':'vó'}
def salvar(nome,d): json.dump(d,open(f'conteudo/{nome}.json','w'),ensure_ascii=False,indent=2)

# vocabulário: vem de conteudo/vocabulario.json (edite lá; este script não o sobrescreve)
vocab=json.load(open('conteudo/vocabulario.json'))
salvar('silabas-fala',{"_nota":"Forma plana do som das sílabas que a escrita não representa de forma direta (sem acento, sem vogal de apoio). Para as demais (consoante + vogal) o app usa a própria sílaba. O estilo de pronúncia escolhido no aparelho (⚙ → Pronúncia de letras e sílabas) decide o resto; em 'reais' ficam as palavras reais usadas pelo estilo equilibrado para E e O.","falas":FALAS,"reais":REAIS})

alfa={'A':('ABELHA','🐝'),'B':('BOLA','⚽'),'C':('CASA','🏠'),'D':('DADO','🎲'),'E':('ESTRELA','⭐'),'F':('FLOR','🌸'),'G':('GATO','🐱'),'H':('HIPOPÓTAMO','🦛'),'I':('IGREJA','⛪'),'J':('JANELA','🪟'),'K':('KIWI','🥝'),'L':('LUA','🌙'),'M':('MAÇÃ','🍎'),'N':('NAVIO','🚢'),'O':('OVO','🥚'),'P':('PATO','🦆'),'Q':('QUEIJO','🧀'),'R':('RATO','🐭'),'S':('SOL','☀️'),'T':('TARTARUGA','🐢'),'U':('UVA','🍇'),'V':('VACA','🐄'),'W':('WAFFLE','🧇'),'X':('XÍCARA','☕'),'Y':('YOGA','🧘'),'Z':('ZEBRA','🦓')}
trilha=[]; N=[0]
def reg(grupo,id_,titulo,icone,extra=None):
    N[0]+=1; n=N[0]
    e={"n":n,"trilha":grupo,"id":id_,"titulo":titulo,"icone":icone,"arquivo":f"conteudo/etapa-{n}-{id_}.json","disponivel":True}
    if extra: e.update(extra)
    trilha.append(e); return n
def etapa(n,id_,titulo,icone,fi,tx,fim,acts,criterio,**ex):
    d={"etapa":n,"id":id_,"titulo":titulo,"icone":icone,"fala_inicial":fi,"texto_inicial":tx,"fala_fim":fim,"criterio":criterio,"atividades":acts}; d.update(ex)
    salvar(f'etapa-{n}-{id_}',d)

# 1 e 2
n=reg(1,'vogais','VOGAIS','🔤')
nf={'🐝':'ABELHA','⭐':'ESTRELA','⛪':'IGREJA','🥚':'OVO','🍇':'UVA'}
V=[("A","O"),("E","U"),("I","A"),("O","E"),("U","I")]
acts=[{"tipo":"ouvir-e-tocar","fala":f"Toque na letra {L(c)}.","dica":f"Procure a letra {L(c)}.","opcoes":[c,o],"correta":c,"instrucao":"OUÇA E TOQUE NA LETRA CERTA"} for c,o in V]
FV=[("🐝","A",["E","O"],"Abelha"),("⭐","E",["I","U"],"Estrela"),("⛪","I",["O","A"],"Igreja"),("🥚","O",["U","E"],"Ovo"),("🍇","U",["A","I"],"Uva")]
acts+=[{"tipo":"ouvir-e-tocar","figura":g,"fala":f"{w}. {w} começa com a letra {L(c)}. Toque na letra {L(c)}.","dica":f"{w} começa com {L(c)}.","opcoes":[c]+o,"correta":c,"instrucao":f"{w.upper()} COMEÇA COM QUAL LETRA?"} for g,c,o,w in FV]
etapa(n,'vogais','VOGAIS','🔤',"Vamos conhecer as vogais. Ouça e toque na letra certa.","OUÇA A LETRA E TOQUE NELA. SE ERRAR, É SÓ TENTAR DE NOVO.","Muito bem! Você conheceu as vogais.",acts,{"acertosDePrimeira":0.8})
n=reg(2,'meu-nome','MEU NOME','🪪')
etapa(n,'meu-nome','MEU NOME','🪪',"Agora vamos ver o seu nome.","VAMOS TRABALHAR COM O SEU NOME. TOQUE NELE E DEPOIS MONTE COM AS LETRAS.","Muito bem! Você montou o seu nome.",
 [{"tipo":"ouvir-e-tocar","fonte":"nome","fala":"Qual é o seu nome? Toque no seu nome.","dica":"Procure o seu nome.","instrucao":"TOQUE NO SEU NOME"},
  {"tipo":"montar","fonte":"nome","dicas":True,"fala":"Monte o seu nome. Toque nas letras, uma de cada vez, na ordem.","dica":"Tente outra letra.","instrucao":"TOQUE NAS LETRAS, NA ORDEM, PARA MONTAR O SEU NOME"},
  {"tipo":"montar","fonte":"nome","dicas":False,"fala":"Monte o seu nome mais uma vez.","dica":"Tente outra letra.","instrucao":"MONTE O SEU NOME DE NOVO, SEM AJUDA"}],{"concluiAoTerminar":True},requerNome=True,
 distratores=["ANA","JOÃO","MARIA","PEDRO","JOSÉ","CARLA","LUCAS","ROSA","PAULO","LÚCIA"])

# palavras da vida: logo depois do nome, a partir das palavras da pessoa
n=reg(3,'palavras-da-vida','PALAVRAS DA VIDA','🏡')
etapa(n,'palavras-da-vida','PALAVRAS DA VIDA','🏡',"Agora vamos ver as palavras da sua vida. Olhe, ouça e monte com as sílabas.","OLHE, OUÇA E MONTE AS PALAVRAS DA SUA VIDA.","Muito bem! Você montou as palavras da sua vida.",
 [{"fonte":"palavras-da-vida"}],{"concluiAoTerminar":True},requerPalavras=True)

# 4 alfabeto
for i,b in enumerate(['ABCDE','FGHIJ','KLMNO','PQRST','UVWXYZ']):
    n=reg(4,f'alfabeto-{i+1}',f'ALFABETO {i+1}','🔠'); acts=[]
    for X in b:
        p,f=alfa[X]; acts.append({"tipo":"apresentar","figura":f,"texto":X,"subtexto":p,"fala":f"{L(X)}, de {p.lower()}.","instrucao":"OLHE E OUÇA A LETRA"})
    for X in b:
        o=[x for x in b if x!=X]; random.shuffle(o)
        acts.append({"tipo":"ouvir-e-tocar","fala":f"Toque na letra {L(X)}.","dica":f"Procure a letra {L(X)}.","opcoes":[X]+o[:2],"correta":X,"instrucao":"OUÇA E TOQUE NA LETRA CERTA"})
    etapa(n,f'alfabeto-{i+1}',f"ALFABETO {i+1}: {' '.join(b)}",'🔠',"Vamos conhecer as letras. Primeiro olhe e ouça cada letra. Depois toque na letra que você ouvir.","PRIMEIRO OLHE E OUÇA CADA LETRA. DEPOIS TOQUE NA LETRA QUE VOCÊ OUVIR.","Muito bem! Você aprendeu estas letras.",acts,{"acertosDePrimeira":0.8})

# famílias silábicas
def familia(id_,titulo,sils,fig,finais=None,tit_fala=None):
    # O título aparece escrito em maiúsculas, mas é FALADO a partir de titulo_fala (com marcadores): a voz soletra "gue", "nh" etc.
    tf=tit_fala or titulo.lower()
    n=reg(5,id_,titulo,'🧩',{"silabas":sils,"titulo_fala":tf,**({"finais":finais} if finais else {})})
    acts=[{"tipo":"apresentar","figura":fig,"texto":' '.join(sils),"subtexto":"","fala":', '.join(S(s) for s in sils)+'.',"instrucao":f"OLHE E OUÇA: {titulo}"}]
    for s in sils:
        o=[x for x in sils if x!=s]; random.shuffle(o)
        acts.append({"tipo":"ouvir-e-tocar","fala":f"Toque na sílaba {S(s)}.","dica":f"Procure a sílaba {S(s)}.","opcoes":[s]+o[:2],"correta":s,"instrucao":"OUÇA E TOQUE NA SÍLABA CERTA"})
    acts.append({"fonte":"palavras-da-pessoa"})
    etapa(n,id_,titulo,'🧩',f"Vamos aprender {tit_fala or titulo.lower()}. Olhe e ouça as sílabas. Depois toque na sílaba que você ouvir.","OLHE E OUÇA AS SÍLABAS. DEPOIS TOQUE NA SÍLABA QUE VOCÊ OUVIR.","Muito bem! Você aprendeu estas sílabas.",acts,{"acertosDePrimeira":0.8 if len(sils)>=5 else 0.66},silabas=sils,titulo_fala=tf)
def revisao(qtd=8,tipo_id='montar-palavras'):
    desde=max([e['n'] for e in trilha if e['id'].startswith('revisao')]+[0])+1
    k=len([e for e in trilha if e['id'].startswith('revisao')])+1
    n=reg(6,f'revisao-{k}',f'MONTAR PALAVRAS {k}','🧱',{"desde":desde})
    etapa(n,f'revisao-{k}',f'MONTAR PALAVRAS {k}','🧱',"Agora vamos montar palavras. Olhe a figura e toque nas sílabas, na ordem.","OLHE A FIGURA E TOQUE NAS SÍLABAS, NA ORDEM, PARA FORMAR A PALAVRA.","Muito bem! Você montou as palavras.",
      [{"fonte":"vocabulario","tipo":"montar","quantidade":qtd}],{"acertosDePrimeira":0.66})
def fam_simples(c,vs,fig):
    familia(f'familia-{c.lower()}',f'FAMÍLIA DO {c}',[c+v for v in vs],fig,tit_fala=f"a família do {L(c)}")
for c,vs,fig in [('B','AEIOU','⚽'),('C','AOU','🏠'),('D','AEIOU','🎲'),('F','AEIOU','🔥')]: fam_simples(c,vs,fig)
revisao()
for c,vs,fig in [('G','AOU','🐱'),('L','AEIOU','🌙'),('M','AEIOU','🍎'),('N','AEIOU','🚢')]: fam_simples(c,vs,fig)
revisao()
for c,vs,fig in [('P','AEIOU','🦆'),('R','AEIOU','🐭'),('S','AEIOU','☀️'),('T','AEIOU','🐢'),('V','AEIOU','🐄')]: fam_simples(c,vs,fig)
revisao()
familia('ce-ci-ge-gi','CE CI GE GI',['CE','CI','GE','GI'],'🧊',tit_fala=f"as sílabas com {L('C')} e {L('G')}, que mudam de som")
fam_simples('J','AEIOU','🪟'); fam_simples('Z','AEIOU','🦓'); fam_simples('X','AEIOU','🍍')
familia('que-qui-gue-gui','QUE QUI GUE GUI',['QUE','QUI','GUE','GUI'],'🧀',tit_fala=f"as sílabas com {L('Q')} e {L('G')}, com o {L('U')} que não se fala")
revisao()
for pre,fig in [('CH','🔑'),('LH','🐑'),('NH','🐔')]: familia(f'familia-{pre.lower()}',f'FAMÍLIA DO {pre}',[pre+v for v in 'AEIOU'],fig,tit_fala=f'a família do {L(pre[0])} {L(pre[1])}')
familia('familia-rr','FAMÍLIA DO RR',['RR'+v for v in 'AEIOU'],'🚗',tit_fala=f'a família do {L("R")} {L("R")}')
familia('familia-ss','FAMÍLIA DO SS',['SS'+v for v in 'AEIOU'],'🦴',tit_fala=f'a família do {L("S")} {L("S")}')
familia('familia-cedilha','FAMÍLIA DO Ç',['ÇA','ÇO','ÇU'],'🎀',tit_fala=f'a família do {L("Ç")}')
revisao()
for c,fig in [('BR','💪'),('CR','🦀'),('DR','🐉'),('FR','🍎'),('GR','🌱'),('PR','🍽️'),('TR','🌾'),('VR','📖')]:
    familia(f'familia-{c.lower()}',f'FAMÍLIA DO {c}',[c+v for v in 'AEIOU'],fig,tit_fala=f'as sílabas com {L(c[0])} e {L(c[1])}')
revisao()
for c,fig in [('BL','👚'),('CL','🚲'),('FL','🌸'),('GL','🌐'),('PL','🪴')]:
    familia(f'familia-{c.lower()}',f'FAMÍLIA DO {c}',[c+v for v in 'AEIOU'],fig,tit_fala=f'as sílabas com {L(c[0])} e {L(c[1])}')
revisao()
familia('ditongos','DITONGOS',['AI','EI','OI','UI','AU','EU','OU'],'👨',finais=['I','U'],tit_fala='as sílabas com duas vogais')
for Lt,fin,fig in [('R','R','🚜'),('L','L','📄'),('S','S','💐')]:
    familia(f'final-{Lt.lower()}',f'SÍLABAS COM {Lt} NO FIM',['A'+fin,'E'+fin,'I'+fin,'O'+fin,'U'+fin],fig,finais=[fin],tit_fala=f'as sílabas que terminam em {L(Lt)}')
familia('nasais-m','SÍLABAS COM M NO FIM',['AM','EM','IM','OM','UM'],'☁️',finais=['M'],tit_fala=f'as sílabas que terminam em {L("M")}')
familia('nasais-n','SÍLABAS COM N NO FIM',['AN','EN','IN','ON','UN'],'🦷',finais=['N'],tit_fala=f'as sílabas que terminam em {L("N")}')
familia('til','SÍLABAS COM TIL',['ÃO','ÃE','ÕE'],'🦁',finais=['O','E'],tit_fala='as sílabas com til')
revisao(10)

# criar palavras novas com as sílabas já aprendidas, depois da última revisão
n=reg(6,'criar-palavras','CRIAR PALAVRAS','🧱')
etapa(n,'criar-palavras','CRIAR PALAVRAS','🧱',"Agora crie palavras novas com as sílabas que você já aprendeu.","CRIE PALAVRAS NOVAS COM AS SÍLABAS.","Muito bem! Você criou palavras novas.",
 [{"tipo":"criar-palavras","fonte":"vocabulario","fala":"Agora crie palavras novas. Olhe as figuras e toque nas sílabas para formar cada palavra. Depois toque no botão roxo.","instrucao":"TOQUE NAS SÍLABAS PARA FORMAR PALAVRAS, DEPOIS TOQUE NO ✔"}],{"concluiAoTerminar":True},requerPalavras=True)
# frases, escrita
for k in (1,2):
    n=reg(7,f'frases-{k}',f'FRASES CURTAS {k}','💬')
    etapa(n,f'frases-{k}',f'FRASES CURTAS {k}','💬',"Agora vamos formar frases. Toque nas palavras, na ordem, e depois ouça a frase.","TOQUE NAS PALAVRAS, NA ORDEM, PARA FORMAR A FRASE.","Muito bem! Você formou frases.",
     [{"fonte":"frases","tipo":"ordenar","quantidade":5}]+([{"fonte":"frases-da-pessoa","tipo":"ordenar"}] if k==1 else []),{"acertosDePrimeira":0.8})
for i,b in enumerate(['AEIOU','BCDFG','HJLMN','PQRST','VWXYZ']):
    n=reg(8,f'tracar-{i+1}',f'TRAÇAR LETRAS {i+1}','✏️')
    acts=[{"tipo":"tracar","letra":x,"fala":f"Passe o dedo sobre a letra {L(x)}.","instrucao":"PASSE O DEDO SOBRE A LETRA"} for x in b]
    if i==0: acts.append({"fonte":"nome-inicial","tipo":"tracar","instrucao":"PASSE O DEDO SOBRE A PRIMEIRA LETRA DO SEU NOME"})
    etapa(n,f'tracar-{i+1}',f'TRAÇAR LETRAS {i+1}','✏️',"Agora vamos escrever. Passe o dedo sobre a letra, seguindo o desenho.","PASSE O DEDO SOBRE A LETRA, SEGUINDO O DESENHO.","Muito bem! Você escreveu as letras.",acts,{"concluiAoTerminar":True})
n=reg(8,'ler-em-voz-alta','LER EM VOZ ALTA','🗣️')
etapa(n,'ler-em-voz-alta','LER EM VOZ ALTA','🗣️',"Agora vamos ler em voz alta. Leia a frase com a sua voz. Depois o aplicativo lê para você conferir.","LEIA A FRASE EM VOZ ALTA. DEPOIS TOQUE NO BOTÃO PARA OUVIR E CONFERIR.","Muito bem! Você leu em voz alta.",
 [{"fonte":"frases","tipo":"ler","quantidade":6},{"fonte":"frases-da-pessoa","tipo":"ler"}],{"concluiAoTerminar":True})
for k in (1,2):
    n=reg(8,f'ditado-{k}',f'DITADO {k}','📝')
    etapa(n,f'ditado-{k}',f'DITADO {k}','📝',"Agora o ditado. Ouça a palavra e escreva com as letras.","OUÇA A PALAVRA E ESCREVA COM AS LETRAS.","Muito bem! Você escreveu as palavras.",
     [{"fonte":"vocabulario","tipo":"ditado","quantidade":8}],{"concluiAoTerminar":True})

frases=[("O GATO DORME","🐱"),("A BOLA É REDONDA","⚽"),("O SOL É QUENTE","☀️"),("A LUA É BONITA","🌙"),("O PATO NADA","🦆"),("O CACHORRO LATE","🐶"),("A GALINHA COME MILHO","🐔"),("A VACA DÁ LEITE","🐄"),("EU GOSTO DE BANANA","🍌"),("A CHUVA CAI","🌧️"),("O MENINO JOGA BOLA","⚽"),("A MENINA LÊ UM LIVRO","📖"),("O PEIXE VIVE NA ÁGUA","🐟"),("MAMÃE FAZ BOLO","🎂"),("PAPAI DIRIGE O CARRO","🚗"),("O AVIÃO VOA ALTO","✈️"),("A FLOR É BONITA","🌸"),("O BEBÊ DORME","👶"),("EU BEBO SUCO","🧃"),("A CASA É AMARELA","🏠"),("O SAPO PULA","🐸"),("A ABELHA FAZ MEL","🐝"),("VOVÓ FAZ CAFÉ","☕"),("O PÃO ESTÁ QUENTE","🍞"),("O TREM É GRANDE","🚆"),("O LEÃO É FORTE","🦁"),("A BORBOLETA É LINDA","🦋"),("O RATO COME QUEIJO","🧀")]
salvar('frases',[{"frase":f,"figura":g} for f,g in frases])
json.dump({"_nota":"n é a ordem de jogo; 'trilha' é a etapa de 1 a 8 da trilha; 'silabas' e 'finais' definem o que a pessoa já aprendeu; 'desde' marca onde começa a revisão.","etapas":trilha},open('conteudo/trilha.json','w'),ensure_ascii=False,indent=2)

# validação: toda palavra do vocabulário fica disponível em algum ponto?
def conhecida(s,conj,fin):
    x=norm(s)
    if x in conj: return True
    for _ in range(2):
        if x and x[-1] in fin: x=x[:-1]
        else: break
        if x in conj: return True
    return False
conj={'A','E','I','O','U'}|{norm(s) for e in trilha for s in e.get('silabas',[])}
fin={f for e in trilha for f in e.get('finais',[])}
ruins=[v['palavra'] for v in vocab if not all(conhecida(s,conj,fin) for s in v['silabas'])]
print("etapas:",len(trilha),"| palavras:",len(vocab),"| nunca liberadas:",ruins)
