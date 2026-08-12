const $ = (s) => document.querySelector(s);
const input = $('#textInput');
const btn = $('#analyzeBtn');
const clearBtn = $('#clearBtn');

function words(t){ return (t.trim().match(/\b[\w’'-]+\b/g)||[]).length; }
input.addEventListener('input',()=> $('#wordCount').textContent = words(input.value));
clearBtn.addEventListener('click',()=>{input.value='';input.dispatchEvent(new Event('input'));$('#results').classList.add('hidden');$('#emptyState').classList.remove('hidden');$('#errorBox').classList.add('hidden');});

function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

function renderAnnotated(text, passages){
  const sorted=[...passages].sort((a,b)=>a.start-b.start);
  let html='', pos=0;
  sorted.forEach((p,i)=>{
    if(p.start<pos)return;
    html += esc(text.slice(pos,p.start));
    html += `<span class="hit ${p.score>=75?'high':''}" data-i="${i}" title="Click to inspect">${esc(text.slice(p.start,p.end))}</span>`;
    pos=p.end;
  });
  html += esc(text.slice(pos));
  $('#annotatedText').innerHTML=html;
  $('#annotatedText').querySelectorAll('.hit').forEach(el=>el.addEventListener('click',()=>{
    const p=sorted[Number(el.dataset.i)];
    const rp=$('#reasonPanel');
    rp.innerHTML=`<strong>${esc(p.title)} · ${Math.round(p.score)}%</strong><p>${esc(p.reason)}</p>`;
    rp.classList.remove('hidden');
  }));
}

function renderFlags(flags, target){
  target.innerHTML = flags.map(f=>`<div class="flag"><div><div class="flag-name">${esc(f.name)}</div><div class="flag-sub">${esc(f.why||'Raw detector signal')}</div></div><div class="flag-score">${Math.round(f.grossScore)}%<small>GROSS</small></div></div>`).join('');
}

btn.addEventListener('click', async()=>{
  const text=input.value.trim();
  $('#errorBox').classList.add('hidden');
  if(words(text)<25){$('#errorBox').textContent='Paste at least 25 words so the analysis has enough text to work with.';$('#errorBox').classList.remove('hidden');return;}
  btn.disabled=true;btn.textContent='Analyzing…';
  try{
    const res=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Analysis failed');

    if(!data.showResults){
      $('#results').classList.add('hidden');$('#emptyState').classList.remove('hidden');
      $('#emptyState').innerHTML='<div class="orb"></div><h3>No meaningful AI signal detected</h3><p>The ensemble stayed below the display threshold, so no flags are shown.</p>';
      return;
    }
    $('#emptyState').classList.add('hidden');$('#results').classList.remove('hidden');
    $('#overallScore').textContent=Math.round(data.overallScore);$('#meterFill').style.width=`${data.overallScore}%`;
    $('#verdict').textContent=data.verdict;$('#signalCount').textContent=data.signalCount;$('#flaggedCount').textContent=data.passages.length;$('#externalCount').textContent=data.external.length;
    renderAnnotated(text,data.passages);renderFlags(data.topFlags,$('#flagsList'));
    const es=$('#externalSection');
    if(data.external.length){es.classList.remove('hidden');renderFlags(data.external.map(x=>({name:x.name,grossScore:x.score,why:x.why||'External API result'})),$('#externalList'));} else es.classList.add('hidden');
  }catch(e){$('#errorBox').textContent=e.message;$('#errorBox').classList.remove('hidden');}
  finally{btn.disabled=false;btn.textContent='Analyze writing';}
});
