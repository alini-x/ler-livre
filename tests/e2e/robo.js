// Robô de ponta a ponta: percorre toda a trilha como uma pessoa faria (tocando em cartões, peças e botões).
// Para poder concluir todas as etapas, o critério de 80% é neutralizado só aqui (o robô erra de propósito até acertar).
// Executado por tests/e2e/run.py dentro do navegador; não faz parte do app.
const _f=window.fetch; window.fetch=async(u,...r)=>{const res=await _f(u,...r); if(String(u).includes('etapa-')){const j=await res.json(); if(j.criterio)j.criterio={concluiAoTerminar:true}; return new Response(JSON.stringify(j));} return res;};
window.robo = async function(){
const T=()=>document.getElementById('tela'); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const log=[]; const voc=await (await _f('conteudo/vocabulario.json')).json(); let etapas=0, ativ={};
for(let guard=0;guard<6000;guard++){
  await sleep(15);
  const t=T(); const txt=t.innerText.replace(/\n/g,' | ');
  if(t.querySelector('.cartao')){ ativ.ouvir=(ativ.ouvir||0)+1; for(const c of t.querySelectorAll('.cartao')){ if(t.querySelector('.cartao.certo'))break; c.click(); await sleep(3);} await sleep(40); t.querySelector('.btn-grande').click(); continue;}
  if(t.querySelector('.peca')&&!t.querySelector('.pistas')){ ativ.montar=(ativ.montar||0)+1; const slots=[...t.querySelectorAll('.espaco:not(.vazio-sep)')]; for(const s of slots){ for(const p of [...t.querySelectorAll('.peca')]){ if(s.classList.contains('cheio'))break; if(!p.classList.contains('usado')){p.click(); await sleep(2);} } } await sleep(80); t.querySelector('.btn-grande').click(); continue;}
  if(t.querySelector('.pistas')){ ativ.criar=(ativ.criar||0)+1; const pool=[...t.querySelectorAll('.peca')].map(p=>p.textContent); const alvos=voc.filter(w=>w.silabas.length>1&&w.silabas.every(s=>pool.includes(s))).slice(0,3);
    for(const w of alvos){ for(const s of w.silabas){[...t.querySelectorAll('.peca')].find(p=>p.textContent==s).click(); await sleep(2);} [...t.querySelectorAll('.btn-medio')].find(b=>b.textContent.includes('PRONTO')).click(); await sleep(8);} await sleep(80); t.querySelector('.btn-grande').click(); continue;}
  if(t.querySelector('.cv-traco')){ ativ.tracar=(ativ.tracar||0)+1; const cv=t.querySelector('.cv-traco'); const r=cv.getBoundingClientRect(); const ev=(ty,x,y)=>cv.dispatchEvent(new PointerEvent(ty,{clientX:r.left+x,clientY:r.top+y,pointerId:1,bubbles:true}));
    ev('pointerdown',5,5); for(let y=5;y<r.height;y+=10){ for(let x=5;x<r.width;x+=r.width/12) ev('pointermove',x,y);} ev('pointerup',5,5); await sleep(80); t.querySelector('.btn-grande').click(); continue;}
  if(t.querySelector('.texto-ler')){ ativ.ler=(ativ.ler||0)+1; t.querySelector('.btn-grande').click(); await sleep(60); [...t.querySelectorAll('.btn-grande')].pop().click(); continue;}
  if(t.querySelector('.texto-apresenta')){ t.querySelector('.btn-grande').click(); continue;}
  const b=[...t.querySelectorAll('.btn-grande')]; if(!b.length)break;
  if(txt.includes('TERMINOU TUDO')&&txt.includes('PARABÉNS'))break;
  if(txt.includes('MUITO BEM!')&&txt.includes('PRÓXIMA ETAPA')) etapas++;
  if(txt.includes('FALTA CADASTRAR')) { log.push('SEM: '+txt.slice(0,60)); b.find(x=>x.textContent.includes('PULAR')).click(); continue;}
  if(txt.includes('TENTAR MAIS UMA VEZ')) log.push('!!! REPETIU');
  b[0].click();
}
log.push('etapas concluídas: '+etapas, JSON.stringify(ativ)); return log;};
