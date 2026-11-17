#!/usr/bin/env python3
"""Teste de ponta a ponta (opcional, local): abre o app num Chromium headless e percorre toda a trilha.

Verifica: todas as etapas concluem (numa tela de 320 px, sem texto estourando o botão), nenhum erro de JavaScript, nenhuma violação da CSP,
e a área da mediadora recusa arquivos de importação maliciosos sem executar nada.

Requisitos: Chromium ou Chrome instalado e o pacote `websocket-client` (pip install websocket-client).
Uso: python3 tests/e2e/run.py          (variável CHROME para indicar o executável)
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from navegador import RAIZ, Navegador, servir  # noqa: E402

# Palavras reais acentuadas e nomes de letras (grafia correta do alfabeto) são lidos normalmente; sílabas acentuadas, não.
PERMITIDAS = {"já", "lá", "cá", "dá", "pá", "há", "vá", "ré", "dó", "só", "nó", "lê", "vê", "sê"} | {
    v.lower() for k, v in json.load(open(RAIZ / "conteudo" / "letras.json", encoding="utf-8")).items() if len(k) == 1} | set(
    json.load(open(RAIZ / "conteudo" / "silabas-fala.json", encoding="utf-8"))["reais"].values())   # palavras reais do estilo equilibrado
ROBO = (Path(__file__).parent / "robo.js").read_text(encoding="utf-8")

# Layout: registra toda tela em que um texto passa do botão/cartão ou a página ganha rolagem horizontal.
VIGIA_LAYOUT = """window.__over=[];(function(){
 const T=document.getElementById('tela'); let t=null;
 const checar=()=>{ for(const e of [...document.querySelectorAll('#topo, #topo button'), ...T.querySelectorAll('.cartao,.peca,.espaco,.texto-apresenta,.texto-ler,.btn-grande,.btn-medio,.item-etapa,.grupo,.instrucao')]){
   if(e.scrollWidth>e.clientWidth+1) window.__over.push((e.className.split(' ')[0])+" '"+(e.textContent||'').trim().slice(0,20)+"' "+e.scrollWidth+'>'+e.clientWidth); }
   if(document.documentElement.scrollWidth>innerWidth+1) window.__over.push('PÁGINA com rolagem horizontal'); };
 new MutationObserver(()=>{clearTimeout(t);t=setTimeout(checar,30)}).observe(T,{childList:true,subtree:true});})();"""

CAPTURA_FALAS = """window.__falas=[];speechSynthesis.speak=u=>{window.__falas.push(u.text);setTimeout(()=>u.onend&&u.onend(),0)};"""

VARIAR_GUE = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 const linha=T().querySelector('.pron-linha[data-chave="GUE"]'); const campo=linha.querySelector('input'); const out={inicial:campo.value};
 window.__falas.length=0; linha.querySelector('button[aria-label^="Testar outra"]').click(); await sl(300);
 out.depois=campo.value; out.falou=window.__falas[window.__falas.length-1];
 linha.querySelector('button[aria-label^="Restaurar"]').click(); await sl(200); out.restaurado=campo.value;
 return JSON.stringify(out)})()"""

TITULO_FALADO = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms)); await sl(600); return window.__falas.join(' | ')})()"""

ABRIR_MEDIADORA = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 document.getElementById('btn-mediadora').click();await sl(300);
 await sl(700);return !!T().querySelector('.pron-linha[data-chave="NHE"]')})()"""

AJUSTAR_PRONUNCIA = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');const out={};
 const db=await import('/js/db.js');
 const linha=()=>T().querySelector('.pron-linha[data-chave="NHE"]');
 const campo=linha().querySelector('input'); out.padrao=campo.value;
 campo.value='ninhe2'; campo.dispatchEvent(new Event('change')); await sl(300);
 out.salvo=((await db.getConfig('pronuncias'))||{}).silabas?.NHE;
 window.__falas.length=0; linha().querySelector('button[aria-label^="Ouvir"]').click(); await sl(200);
 out.falaDoBotao=window.__falas[window.__falas.length-1];
 return JSON.stringify(out)})()"""

USAR_NA_ETAPA = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 window.__falas.length=0; T().querySelector('.btn-grande').click(); await sl(500);   // COMEÇAR (início)
 T().querySelector('.btn-grande').click(); await sl(500);                            // COMEÇAR (abertura da etapa)
 return window.__falas.some(t=>t.includes('ninhe2'))})()"""

RESTAURAR_PRONUNCIA = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 const linha=T().querySelector('.pron-linha[data-chave="NHE"]');
 linha.querySelector('button[aria-label^="Restaurar"]').click(); await sl(300);
 return linha.querySelector('input').value})()"""

# ---- Experiência de uso: a pessoa nunca fica presa numa tela ----
PATCH_ERRO = """(()=>{const f=window.fetch;window.fetch=async(u,...r)=>{const res=await f(u,...r);if(String(u).includes('etapa-')&&window.__MODO==='erra'){const j=await res.json();for(const a of j.atividades||[]){if(a.tipo==='ouvir-e-tocar'&&a.opcoes)a.opcoes=[...a.opcoes,'ZZ'];}return new Response(JSON.stringify(j));}
 if(String(u).includes('etapa-')&&window.__MODO==='falha')throw new TypeError('sem rede');return res;};})()"""

SAIDAS = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');const I=document.getElementById('btn-inicio');const out={};
 speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
 const home=()=>T().innerText.includes('MEU CAMINHO');
 out.home_sem_botao_inicio=I.hidden;
 T().querySelector('.btn-grande').click(); await sl(400); out.abertura_com_botao=!I.hidden;
 T().querySelector('.btn-grande').click(); await sl(400); out.atividade_com_botao=!I.hidden;
 I.click(); await sl(500); out.botao_inicio_volta=home();
 T().querySelector('.btn-grande').click(); await sl(300); T().querySelector('.btn-grande').click(); await sl(300);
 history.back(); await sl(500); out.voltar_do_android_volta=home();
 document.getElementById('btn-mediadora').click(); await sl(300); out.mediadora_sem_botao_inicio=getComputedStyle(I).display==='none';
 history.back(); await sl(700); out.voltar_da_mediadora_volta=home();
 return JSON.stringify(out)})()"""

PULAR_QUIZ = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');const out={};
 speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
 T().querySelector('.btn-grande').click(); await sl(400); T().querySelector('.btn-grande').click(); await sl(400);
 const pular=()=>[...T().querySelectorAll('.btn-grande')].find(b=>b.textContent.includes('PULAR'));
 out.pular_oculto_no_inicio=!pular()||pular().hidden;
 const zz=()=>[...T().querySelectorAll('.cartao')].find(c=>c.textContent.trim()==='ZZ');
 for(let i=0;i<4;i++){zz().click();await sl(60);}
 out.pular_aparece_apos_4_erros=!!pular()&&!pular().hidden;
 const antes=T().querySelector('.instrucao').innerText;
 pular().click(); await sl(600);
 out.pulou_para_outra_atividade=T().querySelector('.cartao,.btn-grande')!==null&&!T().innerText.includes('MUITO BEM!');
 const db=await import('/js/db.js'); const p=await db.getProgresso('1:0'); out.pulo_registrado=p&&p.pulos===1&&p.acertos===0;
 return JSON.stringify(out)})()"""

PULAR_TRACAR = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
 T().querySelector('.btn-grande').click(); await sl(400); T().querySelector('.btn-grande').click(); await sl(500);
 const pular=()=>[...T().querySelectorAll('.btn-grande')].find(b=>b.textContent.includes('PULAR'));
 const cv=T().querySelector('.cv-traco'); const r=cv.getBoundingClientRect();
 const ev=(t,x,y)=>cv.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,pointerId:1,bubbles:true}));
 const antes=!pular()||pular().hidden;
 for(let i=0;i<3;i++){ev('pointerdown',4,4);ev('pointermove',8,8);ev('pointerup',8,8);await sl(80);}
 return JSON.stringify({pular_oculto_antes:antes,pular_aparece_apos_3_tentativas:!!pular()&&!pular().hidden})})()"""

PULAR_CRIAR = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
 T().querySelector('.btn-grande').click(); await sl(600);
 const pular=()=>[...T().querySelectorAll('.btn-grande')].find(b=>b.textContent.includes('PULAR'));
 if(!T().querySelector('.pistas')) return JSON.stringify({erro:'não abriu a atividade de criar palavras'});
 const antes=!pular()||pular().hidden;
 for(let i=0;i<3;i++){T().querySelector('.peca').click();await sl(30);[...T().querySelectorAll('.btn-medio')].find(b=>b.textContent.includes('PRONTO')).click();await sl(80);}
 return JSON.stringify({pular_oculto_antes:antes,pular_aparece_apos_3_erros:!!pular()&&!pular().hidden})})()"""

ERRO_AO_ABRIR = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
 window.__MODO='falha'; T().querySelector('.btn-grande').click(); await sl(600);
 const txt=T().innerText; const out={mostra_erro:txt.includes('NÃO CONSEGUI ABRIR'),tem_tentar:txt.includes('TENTAR'),tem_inicio_na_tela:txt.includes('INÍCIO'),botao_inicio_do_topo:!document.getElementById('btn-inicio').hidden};
 window.__MODO='ok'; [...T().querySelectorAll('.btn-grande')].find(b=>b.textContent.includes('TENTAR')).click(); await sl(700);
 out.tentar_de_novo_abre=T().innerText.includes('VOGAIS')||T().querySelector('.instrucao')!==null;
 return JSON.stringify(out)})()"""

FIM_DA_TRILHA = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');
 const txt=T().innerText; const db=await import('/js/db.js'); const c=await db.getConfig('concluidas');
 return JSON.stringify({parabens:txt.includes('PARABÉNS'),sem_botao_que_apaga:![...T().querySelectorAll('button')].some(b=>b.textContent.includes('DE NOVO')),progresso_intacto:(c||[]).length>=70})})()"""

CICLO_DE_REPETICAO = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');const out={};
 speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
 const vis=t=>[...t.querySelectorAll('.btn-grande')].find(b=>!b.hidden&&!b.classList.contains('oculto'));
 const rodada=async()=>{ for(let g=0;g<80;g++){ const t=T(); if(t.innerText.includes('VAMOS TENTAR'))return; const cs=[...t.querySelectorAll('.cartao')];
     if(cs.length){const z=cs.find(c=>c.textContent.trim()==='ZZ'); z&&z.click(); await sl(15); for(const c of cs){if(t.querySelector('.cartao.certo'))break;c.click();await sl(10);} await sl(40); const b=vis(t); b&&b.click(); await sl(60); continue;}
     const b=vis(t); if(b) b.click(); await sl(60);} };
 T().querySelector('.btn-grande').click(); await sl(400);
 await rodada(); out.r1_sem_seguir=!T().innerText.includes('SEGUIR'); out.r1_tem_de_novo=T().innerText.includes('DE NOVO'); out.r1_botao_inicio=!document.getElementById('btn-inicio').hidden;
 [...T().querySelectorAll('.btn-grande')].find(b=>b.textContent.includes('DE NOVO')).click(); await sl(400);
 await rodada(); out.r2_oferece_seguir=T().innerText.includes('SEGUIR'); 
 [...T().querySelectorAll('.btn-grande')].find(b=>b.textContent.includes('SEGUIR')).click(); await sl(800);
 const db=await import('/js/db.js'); const est=await db.getConfig('estado'); const c=(await db.getConfig('concluidas'))||[];
 out.seguiu_para_etapa_2=est.etapa===2; out.etapa_1_nao_marcada_como_feita=!c.includes(1);
 return JSON.stringify(out)})()"""

MEDIADORA = """(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const T=()=>document.getElementById('tela');const out={};
 document.getElementById('btn-mediadora').click();await sl(300);
 await sl(700);
 out.painel=T().querySelector('h1')?.textContent;
 const subir=async(c)=>{const fi=T().querySelector('input[type=file]');const dt=new DataTransfer();dt.items.add(new File([c],'x.json'));fi.files=dt.files;fi.dispatchEvent(new Event('change'));await sl(600)};
 await subir(JSON.stringify({palavras:[{palavra:'<img src=x onerror=window.__pwn=1>',silabas:'A',aprovada:true},
   {palavra:'GATO',silabas:'GA-TO',figura:'<script>window.__pwn=2</script>',frase:'<img src=x onerror=window.__pwn=3>',aprovada:true},
   {palavra:'__proto__'},null,5]}));
 out.pwn=window.__pwn||null; out.imgInjetada=!!T().querySelector('img'); out.polui=({}).polluted||null;
 await subir('A'.repeat(1100000)); out.grande=(T().querySelector('.aviso')?.textContent||'').startsWith('Arquivo inválido');
 await subir(JSON.stringify(Array.from({length:501},(_,k)=>({palavra:'P'+String.fromCharCode(65+k%26)+k}))));out.mais500=(T().querySelector('.aviso')?.textContent||'').startsWith('Arquivo inválido');
 await subir('{nao e json');out.invalido=(T().querySelector('.aviso')?.textContent||'').startsWith('Arquivo inválido');
 return JSON.stringify(out)})()"""


def main():
    servidor, base = servir()
    nav = Navegador(base)
    nav.cmd("Emulation.setDeviceMetricsOverride", width=320, height=700, deviceScaleFactor=1, mobile=True)   # a tela mais estreita que o app suporta
    falhas = []
    try:
        nav.ev("""(async()=>{const d=await import('/js/db.js');await d.zerarProgresso();await d.setConfig('nome',{texto:'ANA',fala:'ana'});
            await d.salvarPalavra({palavra:'BOLA',silabas:'BO-LA',figura:'⚽',frase:'A bola é redonda.',fala:'',aprovada:true});})()""")
        nav.ir(base)
        nav.ev(ROBO)
        nav.ev(CAPTURA_FALAS)
        nav.ev(VIGIA_LAYOUT)
        log = nav.ev("window.robo()")
        estouros = sorted(set(nav.ev("window.__over")))
        if estouros:
            falhas.append(f"texto estoura o botão ou a página rola na horizontal (320 px): {estouros[:8]}")
        resumo = " ".join(log[-2:])
        print("Trilha:", resumo)
        # O critério é o que ficou salvo: as 70 etapas concluídas e o ponteiro depois da última.
        total = len(json.load(open(RAIZ / "conteudo" / "trilha.json", encoding="utf-8"))["etapas"])
        salvo = json.loads(nav.ev("import('/js/db.js').then(async d=>JSON.stringify({c:await d.getConfig('concluidas'),e:await d.getConfig('estado')}))"))
        if len(set(salvo["c"] or [])) != total or salvo["e"]["etapa"] != total + 1:
            falhas.append(f"a trilha não foi concluída por inteiro ({len(set(salvo['c'] or []))}/{total}): {salvo}")
        if "REPETIU" in " ".join(log):
            falhas.append("alguma etapa repetiu mesmo com o critério neutralizado")

        falas = nav.ev("window.__falas")
        print(f"Falas capturadas na trilha: {len(falas)} ({len(set(falas))} distintas)")
        problemas = [t for t in set(falas) if re.search(r"[{}]", t) or re.search(r"(?<![\wÀ-ÿ])[êôÊÔ](?![\wÀ-ÿ])", t) or re.search(r"\b[A-ZÀ-Ý]{2,}\b", t)]
        if problemas:
            falhas.append(f"falas que a voz soletraria ou com marcador não resolvido: {sorted(problemas)[:8]}")
        if not any(re.search(r"\bnhe\b", t) for t in falas):
            falhas.append("a pronúncia de NHE ('nhe', estilo equilibrado) não foi falada na família do NH")
        # Estilo equilibrado: nenhuma sílaba falada repetida ("bebe", "nhenhe") nas listas de sílabas.
        repetidas = sorted({tok for t in falas if re.fullmatch(r"(?:[a-zçãõáéíóúâêô]{1,6}, ){2,}[a-zçãõáéíóúâêô]{1,6}\.", t)
                            for tok in re.findall(r"[a-zçãõáéíóúâêô]+", t) if re.fullmatch(r"([a-zç]{2,3})\1", tok)})
        if repetidas:
            falhas.append(f"sílabas faladas repetidas no estilo equilibrado: {repetidas[:8]}")
        acentuadas = sorted({m for t in falas for m in re.findall(r"\b(?:[b-df-hj-np-tv-z]{1,3}[áâêôíóú])\b", t.lower()) if m not in PERMITIDAS})
        if acentuadas:
            falhas.append(f"sílabas acentuadas na fala (a voz as soletra): {acentuadas[:10]}")

        nav.ir(base)
        med = json.loads(nav.ev(MEDIADORA))
        print("Mediadora:", med)
        if med["painel"] != "Área de quem ajuda":
            falhas.append("não abriu a área da mediadora")
        if med["pwn"] or med["imgInjetada"] or med["polui"]:
            falhas.append(f"importação maliciosa teve efeito: {med}")
        if not (med["grande"] and med["mais500"] and med["invalido"]):
            falhas.append(f"importação não rejeitou arquivos inválidos: {med}")

        # Ajuste de pronúncia: ouvir, salvar, usar na etapa do NH e restaurar.
        nav.ir(base)
        nav.ev(CAPTURA_FALAS)
        if not nav.ev(ABRIR_MEDIADORA):
            falhas.append("a seção de pronúncias não apareceu na área da mediadora")
        else:
            pron = json.loads(nav.ev(AJUSTAR_PRONUNCIA))
            n_nh = next(e["n"] for e in json.load(open(RAIZ / "conteudo" / "trilha.json", encoding="utf-8"))["etapas"] if e["id"] == "familia-nh")
            nav.ev(f"import('/js/db.js').then(d=>d.setConfig('estado',{{etapa:{n_nh},indice:0,primeira:0}}))")
            nav.ir(base)
            nav.ev(CAPTURA_FALAS)
            pron["falaNaEtapa"] = nav.ev(USAR_NA_ETAPA)
            nav.ir(base)
            nav.ev(CAPTURA_FALAS)
            nav.ev(ABRIR_MEDIADORA)
            pron["restaurado"] = nav.ev(RESTAURAR_PRONUNCIA)
            print("Pronúncia:", pron)
            for chave, esperado in {"padrao": "nhe", "salvo": "ninhe2", "falaDoBotao": "ninhe2", "falaNaEtapa": True, "restaurado": "nhe"}.items():
                if pron.get(chave) != esperado:
                    falhas.append(f"ajuste de pronúncia: {chave} = {pron.get(chave)!r}, esperado {esperado!r}")

        # Botão de variações: troca a forma, fala e restaura.
        nav.ir(base)
        nav.ev(CAPTURA_FALAS)
        nav.ev(ABRIR_MEDIADORA)
        var = json.loads(nav.ev(VARIAR_GUE))
        print("Variação:", var)
        if var["depois"] == var["inicial"] or var["falou"] != var["depois"] or var["restaurado"] != var["inicial"]:
            falhas.append(f"botão de variações de pronúncia não funcionou: {var}")

        # O título da etapa é FALADO a partir de titulo_fala (a voz soletraria "gue", "nh").
        trilha = json.load(open(RAIZ / "conteudo" / "trilha.json", encoding="utf-8"))["etapas"]
        for id_ in ("que-qui-gue-gui", "familia-nh", "ce-ci-ge-gi"):
            n_etapa = next(e["n"] for e in trilha if e["id"] == id_)
            nav.ev(f"import('/js/db.js').then(d=>d.setConfig('estado',{{etapa:{n_etapa},indice:0,primeira:0}}))")
            nav.ir(base)
            nav.ev("window.__falas=[];speechSynthesis.speak=u=>{window.__falas.push(u.text);setTimeout(()=>u.onend&&u.onend(),0)};")
            nav.ev("document.getElementById('btn-ouvir').click()")
            falado = nav.ev(TITULO_FALADO)
            print(f"Título falado ({id_}):", falado[:150])
            if re.search(r"hoje: [^.]*\b(gue|gui|qui|nh|ce|ci|ge|gi)\b", falado, re.I) or "Hoje:" not in falado and "hoje:" not in falado:
                falhas.append(f"título falado cru na etapa {id_}: {falado[:150]}")

        # Experiência de uso: nunca ficar preso numa tela.
        trilha_ux = json.load(open(RAIZ / "conteudo" / "trilha.json", encoding="utf-8"))["etapas"]
        n_de = lambda id_: next(e["n"] for e in trilha_ux if e["id"] == id_)
        sempre = ("import('/js/db.js').then(async d=>{await d.zerarProgresso();await d.setConfig('nome',{texto:'ANA',fala:'ana'});"
                  "for(const p of await d.listarPalavras())await d.removerPalavra(p.id);%s})")

        def cenario(nome, script, preparar="", modo=None):
            nav.ev(sempre % preparar)
            nav.ir(base)
            nav.ev(PATCH_ERRO)
            if modo:
                nav.ev(f"window.__MODO='{modo}'")
            r = json.loads(nav.ev(script))
            print(f"UX {nome}:", r)
            for chave, valor in r.items():
                if valor is not True:
                    falhas.append(f"UX {nome}: {chave} = {valor!r}")

        cenario("saídas", SAIDAS)
        cenario("pular no quiz", PULAR_QUIZ, modo="erra")
        cenario("pular no traçar", PULAR_TRACAR, preparar=f"await d.setConfig('estado',{{etapa:{n_de('tracar-1')},indice:0,primeira:0}});")
        cenario("pular em criar palavras", PULAR_CRIAR, preparar=(
            "await d.salvarPalavra({palavra:'BOLA',silabas:'BO-LA',figura:'⚽',frase:'A bola é redonda.',fala:'',aprovada:true});"
            f"await d.setConfig('estado',{{etapa:{n_de('palavras-da-vida')},indice:99,primeira:0}});"))
        cenario("erro ao abrir", ERRO_AO_ABRIR)
        cenario("ciclo de repetição", CICLO_DE_REPETICAO, modo="erra")
        nav.ev(sempre % f"await d.setConfig('concluidas',{list(range(1, len(trilha_ux) + 1))});await d.setConfig('estado',{{etapa:{len(trilha_ux) + 1},indice:0,primeira:0}});")
        nav.ir(base)
        fim = json.loads(nav.ev(FIM_DA_TRILHA))
        print("UX fim da trilha:", fim)
        for chave, valor in fim.items():
            if valor is not True:
                falhas.append(f"UX fim da trilha: {chave} = {valor!r}")

        csp = nav.ev("window.__csp")
        if csp:
            falhas.append(f"violações de CSP: {csp}")
        if nav.erros_js:
            falhas.append(f"erros de JavaScript: {nav.erros_js}")
        if nav.erros_log:
            falhas.append(f"erros no console: {nav.erros_log}")
    finally:
        nav.fechar()
        servidor.shutdown()
    if falhas:
        print("\nFALHOU:\n- " + "\n- ".join(falhas))
        sys.exit(1)
    print("\nOK: trilha completa, mediadora segura, sem erros nem violações de CSP.")


if __name__ == "__main__":
    main()
