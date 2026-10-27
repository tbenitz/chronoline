/* ChronoLine resilient AI journey creation — batched, resumable, locally saved */
(function(){
'use strict';
const $id=id=>document.getElementById(id);
let busy=false,stopAfterBatch=false;
const originalBuilder=openAIBuilder;
const isRetryable=e=>/truncat|length|JSON|empty response|not enough valid|timed out/i.test(String(e?.message||e));
const signature=e=>Math.round(Number(e.year))+'|'+String(e.title||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,75);
function controls(){
 const select=$id('aiCount');
 if(!select)return;
 select.innerHTML='<option value="8">8 · quick</option><option value="14" selected>14 · balanced</option><option value="22">22 · detailed</option><option value="30">30 · extended</option><option value="60">60 · extensive</option><option value="100">100 · deep research starting point</option>';
 const actions=$id('aiCreateNow')?.parentElement;
 if(!actions)return;
 const stop=document.createElement('button');stop.className='btn';stop.id='aiStopBuild';stop.textContent='Stop after this batch';stop.disabled=true;stop.onclick=()=>{stopAfterBatch=true;setAIStatus('Finishing the current request, then saving your progress…')};
 actions.append(stop);
 const resume=document.createElement('button');resume.className='btn';resume.id='aiResumeBuild';resume.textContent='↻ Resume unfinished journey';resume.hidden=true;resume.onclick=()=>resumeSavedJourney();
 actions.append(resume);
 const wrap=document.createElement('div');wrap.id='aiBuildProgress';wrap.style.cssText='margin-top:12px';
 wrap.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:6px"><span id="aiProgressLabel">No generation underway</span><span id="aiProgressCount">0/0</span></div><div style="height:8px;background:var(--surface2);border-radius:8px;overflow:hidden"><div id="aiProgressBar" style="width:0%;height:100%;background:var(--accent);transition:width .3s"></div></div><p class="ai-help">Large timelines are built in small requests. Each finished response is saved to IndexedDB automatically; if one request fails, completed events remain available to resume.</p>';
 const status=$id('aiRequestStatus');status?.parentElement?.insertBefore(wrap,status);
 $id('aiCreateNow').onclick=()=>createAIJourney();
 updateResume();
}
openAIBuilder=function(){originalBuilder();controls()};
const home=$id('aiHome');if(home)home.onclick=openAIBuilder;
async function updateResume(){
 try{
  const rows=await dbAll('journeys'),pending=rows.filter(j=>j.build&&j.build.status!=='complete').sort((a,b)=>b.createdAt-a.createdAt);
  const btn=$id('aiResumeBuild');if(!btn)return;btn.hidden=!pending.length;btn.textContent=pending.length?'↻ Resume "'+tinyText(pending[0].title,26)+'"':'↻ Resume unfinished journey';
 }catch(e){console.warn('Resumable journey lookup:',e)}
}
function progress(count,total,message){
 const status=$id('aiProgressLabel'),amount=$id('aiProgressCount'),bar=$id('aiProgressBar');
 if(status)status.textContent=message||'Building the timeline…';
 if(amount)amount.textContent=count+' / '+total+' events';
 if(bar)bar.style.width=(Math.max(0,Math.min(1,count/Math.max(1,total)))*100).toFixed(1)+'%';
}
function updateButtons(isWorking){
 const go=$id('aiCreateNow'),stop=$id('aiStopBuild'),resume=$id('aiResumeBuild');
 if(go)go.disabled=isWorking;
 if(stop)stop.disabled=!isWorking;
 if(resume)resume.disabled=isWorking;
}
async function resumeSavedJourney(){
 if(busy)return;
 let rows;
 try{rows=(await dbAll('journeys')).filter(j=>j.build&&j.build.status!=='complete').sort((a,b)=>b.createdAt-a.createdAt)}catch(e){setAIStatus('Could not read saved journey: '+e.message,true);return}
 if(!rows.length){setAIStatus('No unfinished AI journeys to resume.');return}
 const row=rows[0];
 if($id('aiTopic'))$id('aiTopic').value=row.build.topic;
 if($id('aiFrom'))$id('aiFrom').value=row.build.from;
 if($id('aiTo'))$id('aiTo').value=row.build.to;
 if($id('aiRegion'))$id('aiRegion').value=row.build.region;
 const counts=$id('aiCount');if(counts&&counts.querySelector('option[value="'+row.build.target+'"]'))counts.value=String(row.build.target);
 if(!saveApiKey()){setAIStatus('Enter your DeepSeek API key to resume.',true);return}
 await runBuild(row);
}
createAIJourney=async function(){
 if(busy)return;
 const topic=$id('aiTopic')?.value.trim(),from=Number($id('aiFrom')?.value),to=Number($id('aiTo')?.value),target=Number($id('aiCount')?.value),region=$id('aiRegion')?.value.trim()||'Global';
 if(!topic||topic.length<8){setAIStatus('Describe your history topic in more detail.',true);return}
 if(!Number.isFinite(from)||!Number.isFinite(to)||from>to||from< -10000||to>2100){setAIStatus('Choose a valid historical year range (-10000 through 2100).',true);return}
 if(!Number.isFinite(target)||target<2||target>100){setAIStatus('Select 8 to 100 events.',true);return}
 if(!saveApiKey()){setAIStatus('Add your DeepSeek API key.',true);return}
 const id='ai-'+(crypto.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2,7));
 const row={id,title:tinyText(topic.replace(/[.!?]+$/,''),100),subtitle:'AI-authored historical journey',description:tinyText('A historical journey through '+topic,300),events:[],createdAt:Date.now(),build:{topic,from,to,region,target,nextBatch:0,status:'building'}};
 try{await dbPut('journeys',row)}catch(e){setAIStatus('Cannot save to IndexedDB: '+e.message+'. No AI request was made.',true);return}
 await runBuild(row);
};
async function runBuild(row){
 busy=true;stopAfterBatch=false;updateButtons(true);
 let error=null;
 const b=row.build, batchSize=4,totalBatches=Math.ceil(b.target/batchSize);
 let keys=new Set(row.events.map(signature));
 const addEvents=async generated=>{
  const next=[];
  for(const raw of generated){
   if(!raw||!Number.isFinite(Number(raw.year)))continue;
   const year=Math.round(Number(raw.year));
   if(year<b.from||year>b.to||!String(raw.title||'').trim())continue;
   const item={
    year,date:tinyText(raw.date,85)||fmtYear(year),title:tinyText(raw.title,150),region:tinyText(raw.region,70)||b.region,
    major:raw.major!==false,tags:Array.isArray(raw.tags)?raw.tags.slice(0,7):['history'],
    summary:tinyText(raw.summary,1100),why:tinyText(raw.why,1200),
    context:tinyText([raw.context,...(Array.isArray(raw.facts)?raw.facts.slice(0,3):[])].filter(Boolean).join(' '),2300),
    wiki:tinyText(raw.wiki,135)
   };
   const sig=signature(item);
   if(keys.has(sig))continue;
   keys.add(sig);next.push(item);
  }
  if(!next.length)return 0;
  row.events.push(...next);row.events.sort((a,c)=>a.year-c.year||a.date.localeCompare(c.date));
  await dbPut('journeys',row);
  installAIJourney(row);
  progress(row.events.length,b.target,'Saved '+row.events.length+' events in IndexedDB');
  return next.length;
 };
 const request=async(low,high,want,attempt=0)=>{
  const already=row.events.filter(e=>e.year>=low&&e.year<=high).slice(-24).map(e=>e.year+' '+e.title).join('; ');
  const compact=attempt>=2;
  const system='You are a careful public historian. Respond with ONE valid JSON object with an events array. Ground dates in widely documented history; use approximate years rather than inventing exact days. JSON structure: {"events":[{"year":1969,"date":"July 20, 1969","title":"Example title","region":"Global","tags":["science"],"major":true,"summary":"Two informative sentences.","why":"Why it mattered.","context":"Historical causes, details and the next consequence.","facts":["lesser-known fact"],"wiki":"Related Wikipedia article title"}]}. Keep each item concise, distinctive and supported by established history. Do not output markdown.';
  const prompt='History topic: '+b.topic+'\nViewpoint: '+b.region+'\nYear window: '+low+' to '+high+'. Produce '+want+' distinct historical moments in this window. At least 1 in 3 should be less-known/minor events. Include human experience, precursor events, culture, discoveries, policy and consequences. Ensure chronological order and do not invent sources. '+(compact?'Each entry should have one-sentence summary, why, and context.':'Each entry should have 2 sentence summary, 1–2 sentence significance, 2–3 sentence context and 1–2 precise facts.')+'\nExclude similar events already covered: '+already.slice(0,1100)+'\nReturn JSON only.';
  try{
   const data=await deepseekJSON(system,prompt,Math.max(3000,Math.min(6500,want*900+1200)));
   if(!Array.isArray(data.events))throw Error('JSON missing the events list.');
   const added=await addEvents(data.events.slice(0,want+2));
   if(!added)throw Error('No new valid events returned for '+fmtYear(low)+'–'+fmtYear(high)+'.');
   return added;
  }catch(e){
   if(isRetryable(e)&&want>1&&attempt<4){
    const left=Math.floor(want/2),right=want-left;
    const mid=Math.floor((low+high)/2);
    setAIStatus('DeepSeek reply was too large; retrying as smaller requests automatically. '+row.events.length+' events already saved.');
    const n1=await request(low,mid,left,attempt+1);
    const n2=await request(Math.max(low,mid),high,right,attempt+1);
    return n1+n2;
   }
   if(isRetryable(e)&&attempt<2){
    setAIStatus('Retrying '+fmtYear(low)+' with a shorter JSON response…');
    return request(low,high,want,attempt+1);
   }
   throw e;
  }
 };
 try{
 for(let i=b.nextBatch;i<totalBatches;i++){
  if(stopAfterBatch)break;
  const desired=Math.min(batchSize,b.target-i*batchSize);
  const low=Math.floor(b.from+(b.to-b.from)*i/totalBatches);
  const high=Math.ceil(b.from+(b.to-b.from)*(i+1)/totalBatches);
  progress(row.events.length,b.target,'Batch '+(i+1)+' of '+totalBatches+' · '+fmtYear(low)+'–'+fmtYear(high));
  setAIStatus('Generating batch '+(i+1)+' of '+totalBatches+'. Completed batches are saved automatically.');
  await request(low,high,desired);
  b.nextBatch=i+1;
  await dbPut('journeys',row);
 }
 if(!stopAfterBatch&&b.nextBatch===totalBatches){b.status='complete';b.finishedAt=Date.now();}
 else b.status='paused';
 }catch(e){error=e;b.status='interrupted'}
 finally{
  try{await dbPut('journeys',row)}catch(saveError){error=error||saveError}
  if(row.events.length){installAIJourney(row);renderHome()}
  busy=false;updateButtons(false);
  progress(row.events.length,b.target,b.status==='complete'?'Your journey has been saved':b.status==='paused'?'Paused · saved':'Interrupted · saved');
  if(error){setAIStatus('Saved '+row.events.length+' events, but a request failed: '+error.message+'. Use Resume unfinished journey to continue.',true)}
  else if(b.status==='paused'){setAIStatus('Paused safely. '+row.events.length+' events are saved. Use Resume unfinished journey to finish.')}
  else{setAIStatus('Saved '+row.events.length+' events locally. Opening your timeline…');if(row.events.length>=2){startJourney(row.id,false,false);toast('Created a '+row.events.length+'-event historical journey!')}}
  updateResume();
 }
}
window.ChronoLineAIBuilder={open:()=>openAIBuilder(),resume:resumeSavedJourney,version:'2026-10-27-batch-2'};
})();