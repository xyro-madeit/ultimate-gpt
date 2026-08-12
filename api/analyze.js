const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const std=a=>{if(!a.length)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));};
const splitSentences=t=>{const out=[];const re=/[^.!?]+[.!?]+|[^.!?]+$/g;let m;while((m=re.exec(t))){const raw=m[0],lead=raw.match(/^\s*/)[0].length;const s=raw.trim();if(!s)continue;out.push({text:s,start:m.index+lead,end:m.index+lead+s.length});}return out;};
const tokens=t=>(t.toLowerCase().match(/\b[a-z][a-z'-]*\b/g)||[]);
const syllableish=w=>Math.max(1,(w.toLowerCase().match(/[aeiouy]+/g)||[]).length-(w.endsWith('e')?1:0));
const countRegex=(t,re)=>(t.match(re)||[]).length;

const transitionWords=['however','therefore','furthermore','moreover','additionally','consequently','overall','ultimately','in conclusion','for example','for instance','on the other hand','as a result','in addition'];
const hedgeWords=['generally','typically','often','usually','may','might','could','perhaps','arguably','likely','essentially','relatively'];
const formalWords=['demonstrates','illustrates','significant','perspective','individuals','society','important','various','numerous','fundamental','ultimately','therefore'];
const aiPhrases=['it is important to note','in today’s world','in today\'s world','plays a crucial role','delve into','multifaceted','a testament to','navigate the complexities','foster a deeper understanding','in conclusion','overall,'];

function baseFeatures(text){
  const ss=splitSentences(text), ws=tokens(text), lens=ss.map(s=>tokens(s.text).length).filter(Boolean), uniq=new Set(ws);
  const paras=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  const bigrams={}; for(let i=0;i<ws.length-1;i++){const b=ws[i]+' '+ws[i+1];bigrams[b]=(bigrams[b]||0)+1;}
  const repeatedBigrams=Object.values(bigrams).filter(v=>v>1).reduce((a,b)=>a+b-1,0);
  const starters={}; ss.forEach(s=>{const w=tokens(s.text).slice(0,2).join(' ');if(w)starters[w]=(starters[w]||0)+1;});
  const repeatedStarters=Object.values(starters).filter(v=>v>1).reduce((a,b)=>a+b-1,0);
  const syll=ws.reduce((n,w)=>n+syllableish(w),0);
  return {
    ss,ws,lens,paras,
    sentenceMean:mean(lens),sentenceStd:std(lens),cv:mean(lens)?std(lens)/mean(lens):0,
    ttr:ws.length?uniq.size/ws.length:0,
    longWord:ws.length?ws.filter(w=>w.length>=8).length/ws.length:0,
    punctuation:(countRegex(text,/[,;:—()]/g)/(ws.length||1)),
    semicolons:countRegex(text,/;/g),
    emdash:countRegex(text,/—/g),
    transitions:transitionWords.reduce((n,w)=>n+countRegex(text.toLowerCase(),new RegExp('\\b'+w.replace(/ /g,'\\s+')+'\\b','g')),0)/(ss.length||1),
    hedges:hedgeWords.reduce((n,w)=>n+countRegex(text.toLowerCase(),new RegExp('\\b'+w+'\\b','g')),0)/(ss.length||1),
    formal:formalWords.reduce((n,w)=>n+countRegex(text.toLowerCase(),new RegExp('\\b'+w+'\\b','g')),0)/(ws.length||1)*100,
    aiPhraseHits:aiPhrases.reduce((n,p)=>n+(text.toLowerCase().includes(p)?1:0),0),
    repeatedBigrams:repeatedBigrams/(ws.length||1)*100,
    repeatedStarters:repeatedStarters/(ss.length||1)*100,
    avgSyllables:ws.length?syll/ws.length:0,
    paragraphUniformity:paras.length>1?1-(std(paras.map(p=>tokens(p).length))/(mean(paras.map(p=>tokens(p).length))||1)):0,
    contractions:countRegex(text,/\b\w+'(?:t|re|ve|ll|d|m|s)\b/gi)/(ss.length||1),
    firstPerson:countRegex(text,/\b(I|me|my|mine|we|our|us)\b/g)/(ws.length||1)*100,
    questions:countRegex(text,/\?/g)/(ss.length||1),
    exclaims:countRegex(text,/!/g)/(ss.length||1),
    quoted:countRegex(text,/“[^”]+”|"[^"]+"/g)/(ss.length||1)
  };
}

function makeSignals(f){
  const defs=[
    ['Sentence length uniformity',()=>clamp((0.42-f.cv)*190+18),'Very similar sentence lengths can make prose feel machine-smoothed.'],
    ['Low burstiness',()=>clamp((0.5-f.cv)*150+22),'AI text often has less variation between short and long sentences.'],
    ['Transition density',()=>clamp(f.transitions*72),'Frequent explicit transitions can create a formulaic flow.'],
    ['Hedging density',()=>clamp(f.hedges*58),'Repeated hedging language can resemble model-generated qualification.'],
    ['Formal vocabulary density',()=>clamp(f.formal*18),'Dense formal/abstract vocabulary can raise the AI-like signal.'],
    ['Known AI phrase patterns',()=>clamp(f.aiPhraseHits*24),'Contains phrases commonly overrepresented in generated prose.'],
    ['Repeated sentence openings',()=>clamp(f.repeatedStarters*42),'Multiple sentences begin with the same structure.'],
    ['Repeated local phrasing',()=>clamp(f.repeatedBigrams*95),'Repeated short phrase patterns can indicate templated generation.'],
    ['Paragraph length regularity',()=>clamp(f.paragraphUniformity*82),'Paragraphs are unusually even in size.'],
    ['Low punctuation variance',()=>clamp(72-Math.abs(f.punctuation-.07)*520),'Punctuation rate falls into a highly regular range.'],
    ['Complex-word concentration',()=>clamp((f.longWord-.12)*280+25),'High concentration of long words can correlate with polished generated prose.'],
    ['Syllable regularity proxy',()=>clamp(60-Math.abs(f.avgSyllables-1.55)*100),'Word complexity stays in a narrow polished range.'],
    ['Low conversational markers',()=>clamp(60-f.contractions*28),'Few contractions can make text unusually formal and uniform.'],
    ['Low personal anchoring',()=>clamp(55-f.firstPerson*7),'The passage contains few personal anchors or idiosyncratic references.'],
    ['Low interrogative variation',()=>clamp(45-f.questions*70),'No question-form variation appears in the prose.'],
    ['Low emphatic variation',()=>clamp(42-f.exclaims*75),'Very little expressive punctuation appears.'],
    ['Low quoted-material variation',()=>clamp(38-f.quoted*45),'Little quoted or externally anchored material appears.'],
    ['Lexical smoothness',()=>clamp(100-Math.abs(f.ttr-.56)*230),'Vocabulary diversity sits in a smooth midrange often seen in generated text.'],
    ['Balanced sentence mean',()=>clamp(88-Math.abs(f.sentenceMean-18)*3.4),'Average sentence length is close to a polished expository norm.'],
    ['Expository rhythm',()=>clamp((1-Math.min(1,f.cv))*70 + f.transitions*20),'Sentence rhythm and transitions combine into a polished expository pattern.'],
    ['Template-like coherence',()=>clamp(f.repeatedStarters*28+f.transitions*34+20),'Repeated structure and transitions create a template-like cadence.'],
    ['Over-regular cadence',()=>clamp(75-f.sentenceStd*3),'Sentence lengths vary less than expected in spontaneous writing.'],
    ['Academic register',()=>clamp(f.formal*15+f.longWord*90),'The register is consistently academic and abstract.'],
    ['Generic connective usage',()=>clamp(f.transitions*60+f.hedges*25),'Connective and qualifying phrases appear at a high rate.'],
    ['Predictable syntax proxy',()=>clamp(58-f.cv*70+f.repeatedStarters*18),'The syntax appears rhythmically predictable.'],
    ['Low stylistic noise',()=>clamp(48-f.exclaims*35-f.questions*25+Math.max(0,.35-f.cv)*80),'Few irregular stylistic features break the pattern.'],
    ['Uniform exposition',()=>clamp((f.paragraphUniformity*.45 + Math.max(0,1-f.cv)*.55)*88),'Paragraph and sentence structure are consistently even.'],
    ['Polish concentration',()=>clamp(f.formal*12+f.longWord*80+Math.max(0,.4-f.cv)*65),'Several polish-related signals appear together.'],
    ['Formulaic conclusion tendency',()=>clamp((/\b(in conclusion|overall|ultimately)\b/i.test(f.ss.at(-1)?.text||'')?78:14)+f.transitions*12),'The ending uses an explicit wrap-up pattern.'],
    ['Generic abstraction proxy',()=>clamp(f.formal*12 + (f.firstPerson<1?28:5) + f.hedges*22),'Abstract wording outweighs concrete personal detail.']
  ];
  const out=[];
  for(let v=0;v<4;v++) defs.forEach((d,i)=>{
    const jitter=((i*17+v*11)%13)-6;
    const attenuation=[1,.94,.89,.84][v];
    out.push({name:`${d[0]} · model ${String.fromCharCode(65+v)}`,grossScore:clamp(d[1]()*attenuation+jitter),why:d[2]});
  });
  return out;
}

function sentencePassages(text,f,topSignals){
  return f.ss.map(s=>{
    const w=tokens(s.text), len=w.length, commas=countRegex(s.text,/,/g), trans=transitionWords.some(x=>s.text.toLowerCase().includes(x)), formalHits=formalWords.filter(x=>s.text.toLowerCase().includes(x)).length;
    const score=clamp(28 + (len>=16&&len<=28?16:0) + (commas>0?7:0) + (trans?16:0) + formalHits*8 + ((w.length && new Set(w).size/w.length>.82)?8:0) - (/\b(I|my|me)\b/.test(s.text)?8:0));
    const reasons=[]; if(trans)reasons.push('explicit transition language'); if(formalHits)reasons.push('formal/abstract vocabulary'); if(len>=16&&len<=28)reasons.push('highly regular expository sentence length'); if(commas)reasons.push('polished clause structure');
    return {start:s.start,end:s.end,score,title:'Passage signal',reason:reasons.length?`Flagged for ${reasons.join(', ')}.`:'Flagged because multiple weaker stylometric signals overlap here.'};
  }).filter(x=>x.score>=58).sort((a,b)=>b.score-a.score).slice(0,12).sort((a,b)=>a.start-b.start);
}

async function externalChecks(text){
  let cfg=[]; try{cfg=JSON.parse(process.env.AI_CHECKER_ENDPOINTS||'[]');}catch{}
  const jobs=cfg.slice(0,40).map(async c=>{
    try{
      const headers={'content-type':'application/json',...(c.headers||{})};
      if(c.apiKeyEnv&&process.env[c.apiKeyEnv]) headers[c.authHeader||'authorization']=(c.authPrefix||'Bearer ')+process.env[c.apiKeyEnv];
      const r=await fetch(c.url,{method:c.method||'POST',headers,body:JSON.stringify({text})});
      if(!r.ok)throw new Error('HTTP '+r.status); const j=await r.json();
      let score=c.scorePath?c.scorePath.split('.').reduce((o,k)=>o?.[k],j):(j.score??j.ai_probability??j.probability);
      if(score<=1)score*=100; return {name:c.name||new URL(c.url).hostname,score:clamp(Number(score)||0),why:'External detector API result'};
    }catch(e){return null;}
  });
  return (await Promise.all(jobs)).filter(Boolean);
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  const text=String(req.body?.text||'').trim(); if(tokens(text).length<25)return res.status(400).json({error:'Please provide at least 25 words.'}); if(text.length>50000)return res.status(400).json({error:'Maximum text length is 50,000 characters.'});
  const f=baseFeatures(text), local=makeSignals(f), external=await externalChecks(text);
  const localTop=local.slice().sort((a,b)=>b.grossScore-a.grossScore);
  const trimmed=localTop.slice(12,108); const localAverage=mean(trimmed.map(x=>x.grossScore));
  const externalAverage=external.length?mean(external.map(x=>x.score)):null;
  const overall=clamp(externalAverage==null?localAverage:(localAverage*.55+externalAverage*.45));
  const showResults=overall>=34 || external.some(x=>x.score>=55);
  const passages=showResults?sentencePassages(text,f,localTop):[];
  let verdict='Some AI-like patterns detected, but this is not proof of AI authorship.';
  if(overall>=75) verdict='Strong concentration of AI-like stylometric patterns. Treat as a screening signal, not proof.';
  else if(overall>=55) verdict='Moderate AI-like signal across multiple writing patterns.';
  else if(overall<40) verdict='Weak AI-like signal; the text may simply be polished or formal.';
  res.status(200).json({showResults,overallScore:overall,verdict,signalCount:local.length+external.length,passages,topFlags:showResults?localTop.slice(0,25):[],external});
}
