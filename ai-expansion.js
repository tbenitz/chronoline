/* ChronoLine AI Expansion Studio — private IndexedDB additions on top of curated journeys */
(function(){
'use strict';
const EXPANSION_PREFIX='chrono-expansion:';
let running=false,stopRequested=false,completed=0,targetTotal=0;
let historyEntries=[];
const selected=(id)=>document.getElementById(id);
const safe=(s)=>escapeHTML(String(s==null?'':s));
function uniqueTitle(e){return String(e.title||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,65)+':'+Math.round(Number(e.year)||0)}
function existingExpansions(){return EVENTS.filter(e=>e.expansionFor)}
function updateCounts(){const btn=selected('aiExpandJourney');if(btn){const own=existingExpansions().filter(e=>e.expansionFor===activeJourney).length;btn.title='Generate more historical moments. '+own+' already added here.';} const count=selected('expansionTotal');if(count)count.textContent=existingExpansions().length+' AI-added events saved locally'}
function installExpansion(row){
 if(!row||!Array.isArray(row.events)||!JOURNEYS[row.target])return 0;
 const oldIds=new Set(EVENTS.map(e=>e.id)), oldTitles=new Set(EVENTS.filter(e=>e.expansionFor===row.target||(!e.aiGenerated&&JOURNEYS[row.target].filter(e))||e.journeyId===row.target).map(uniqueTitle));
 let added=0;
 row.events.forEach((raw,i)=>{
  const norm=normalizeEvent(raw,row.id,i);
  if(!norm||oldIds.has(norm.id)||oldTitles.has(uniqueTitle(norm)))return;
  norm.expansionFor=row.target;
  norm.aiGenerated=true;
  norm.facts=Array.isArray(raw.facts)?raw.facts.map(x=>tinyText(x,180)).filter(Boolean).slice(0,5):[];
  if(norm.facts.length) norm.context=[norm.context,'Additional context: '+norm.facts.join('. ')+'.'].filter(Boolean).join(' ');
  norm.narration=tinyText(raw.narration,1100);
  norm.generatedAt=row.createdAt;
  EVENTS.push(norm);oldIds.add(norm.id);oldTitles.add(uniqueTitle(norm));added++;
 });
 if(added)EVENTS.sort((a,b)=>a.year-b.year||String(a.date).localeCompare(String(b.date)));
 return added;
}
async function hydrate(){
 try{
 const rows=await dbAll('improvements');
 rows.filter(r=>r&&r.kind==='timeline-expansion').sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).forEach(installExpansion);
 if(!selected('home').classList.contains('hidden'))renderHome();
 else if(visible.length&&activeJourney){const before=visible[currentIndex]?.id;visible=allJourneyEvents(activeJourney);currentIndex=Math.max(0,visible.findIndex(e=>e.id===before));renderTimeline();updateNowUI();}
 updateCounts();
 }catch(e){console.warn('Could not load AI timeline additions',e);}
}
function refreshTimeline(){
 if(selected('timelinePage').classList.contains('hidden')){renderHome();updateCounts();return}
 const prior=visible[currentIndex]?.id;
 visible=allJourneyEvents(activeJourney);
 currentIndex=Math.max(0,visible.findIndex(e=>e.id===prior));
 renderTimeline();updateNowUI();updateCounts();
}
function openStudio(){
 pause();
 const journey=JOURNEYS[activeJourney]||JOURNEYS.century;
 const base=allJourneyEvents(activeJourney);
 const first=base[0]?.year??1900,last=base.at(-1)?.year??2026;
 const total=base.filter(e=>e.expansionFor).length;
 const previewYear=base[currentIndex]?.year??first;
 const html=modalHeader('DEEPSEEK · THE MISSING MOMENTS','Expand this timeline')+
 '<div class="modal-body"><div class="ai-warn"><strong>Expand '+safe(journey.title)+'</strong> · '+base.length+' moments currently ('+total+' added by AI). Add overlooked discoveries, daily life, milestones, politics and context between the existing dates. Original curated events are never overwritten.</div>'+
 '<div class="ai-form-grid">'+
 '<div class="ai-field"><label for="expandScope">Where should AI look?</label><select id="expandScope"><option value="all">Across the full journey</option><option value="near">Around the current event ('+safe(fmtYear(previewYear))+')</option><option value="custom">Custom year range</option></select></div>'+
 '<div class="ai-field"><label for="expandAmount">How many new events?</label><select id="expandAmount"><option value="12">12 · quick</option><option value="30" selected>30 · substantial</option><option value="60">60 · deep</option><option value="100">100 · full expansion</option></select></div>'+
 '<div class="ai-field"><label for="expandFrom">First year (negative = BCE)</label><input type="number" id="expandFrom" value="'+first+'"></div>'+
 '<div class="ai-field"><label for="expandTo">Final year</label><input type="number" id="expandTo" value="'+last+'"></div></div>'+
 '<div class="ai-field"><label for="expandTheme">What should the AI uncover?</label><textarea id="expandTheme" rows="3">Find authentic but often-overlooked developments between major events: everyday life, smaller discoveries, important people, political decisions, social movements, cultural shifts, and the causes and consequences of headline events.</textarea></div>'+
 '<div class="ai-form-grid"><div class="ai-field"><label for="expandMix">Detail mix</label><select id="expandMix"><option value="balanced">Balanced: major + minor</option><option value="minor">Mostly minor events & everyday life</option><option value="major">Major milestones and precursors</option></select></div>'+
 '<div class="ai-field"><label for="expandDetail">Narrative depth</label><select id="expandDetail"><option value="rich" selected>Rich facts, 3–5 sentence context</option><option value="deep">Deep, 5–8 sentences per event</option></select></div></div>'+
 aiKeyFields()+
 '<p class="ai-help">DeepSeek responses are AI-generated, not independently verified. Each batch is saved in IndexedDB before the next begins. Results are private to this browser, not published into the shared GitHub site. Check the linked Wikipedia references.</p>'+
 '<div class="ai-actions"><button class="btn primary" id="expansionGenerate">✦ Add historical events & facts</button><button class="btn" id="expansionStop" disabled>Stop after this batch</button><button class="btn" id="expansionMakeNew">Create a separate journey</button></div>'+
 '<div class="ai-status" id="aiRequestStatus" role="status">Ready. You can add 100+ events across repeated expansions.</div>'+
 '<div id="expansionProgress" class="ai-help">No generation started yet.</div>'+
 '<div class="ai-actions"><button class="btn sm" id="expansionClear">Remove all AI additions from this journey</button><span class="muted" style="font-size:11px" id="expansionTotal"></span></div></div>';
 openModal(html,true);
 const scope=selected('expandScope'),from=selected('expandFrom'),to=selected('expandTo');
 function autoYears(){
  if(scope.value==='all'){from.value=first;to.value=last;}
  if(scope.value==='near'){const radius=8,low=base[Math.max(0,currentIndex-radius)],hi=base[Math.min(base.length-1,currentIndex+radius)];from.value=low?.year??first;to.value=hi?.year??last;}
  from.disabled=to.disabled=scope.value!=='custom';
 }
 scope.onchange=autoYears;autoYears();
 selected('expansionGenerate').onclick=generate;
 selected('expansionStop').onclick=()=>{stopRequested=true;setAIStatus('Stopping after the current request finishes. Saved events are preserved.')};
 selected('expansionMakeNew').onclick=openAIBuilder;
 selected('expansionClear').onclick=clearCurrent;
 updateCounts();
}
async function clearCurrent(){
 if(running){setAIStatus('Finish or stop generation before clearing.',true);return}
 if(!confirm('Remove ALL AI-added events from this journey on this browser? Curated history and improved descriptions will remain.'))return;
 try{
  const rows=await dbAll('improvements');
  const remove=rows.filter(r=>r.kind==='timeline-expansion'&&r.target===activeJourney);
  for(const r of remove)await dbDelete('improvements',r.id);
  for(let i=EVENTS.length-1;i>=0;i--)if(EVENTS[i].expansionFor===activeJourney)EVENTS.splice(i,1);
  refreshTimeline();closeModal();toast('Removed '+remove.length+' saved batches of AI-added events.');
 }catch(e){setAIStatus('Could not clear additions: '+e.message,true)}
}
async function generate(){
 if(running)return;
 const journeyKey=activeJourney,base=allJourneyEvents(journeyKey), scope=selected('expandScope').value;
 const from=Number(selected('expandFrom').value),to=Number(selected('expandTo').value);
 const goal=Number(selected('expandAmount').value),theme=selected('expandTheme').value.trim(),mix=selected('expandMix').value,depth=selected('expandDetail').value;
 if(!Number.isFinite(from)||!Number.isFinite(to)||from>to||from< -10000||to>2100){setAIStatus('Enter a valid year range from -10000 to 2100.',true);return}
 if(!saveApiKey()){setAIStatus('Enter a DeepSeek API key first.',true);return}
 if(!theme){setAIStatus('Describe what to discover.',true);return}
 const launch=selected('expansionGenerate'),halt=selected('expansionStop');
 launch.disabled=true;halt.disabled=false;running=true;stopRequested=false;completed=0;targetTotal=goal;
 const batches=Math.ceil(goal/10);
 const baseAnchors=base.filter(e=>e.year>=from&&e.year<=to).filter(e=>!e.expansionFor).sort((a,b)=>a.year-b.year);
 const allKnown=new Set(EVENTS.filter(e=>e.expansionFor===journeyKey||base.includes(e)).map(uniqueTitle));
 let error=null;
 try{
 for(let step=0;step<batches;step++){
  if(stopRequested)break;
  const requested=Math.min(10,goal-step*10);
  const lo=(baseAnchors.length>=batches&&scope!=='custom')?baseAnchors[Math.floor(step*baseAnchors.length/batches)].year:Math.floor(from+(to-from)*step/batches);
  const hi=(baseAnchors.length>=batches&&scope!=='custom')?baseAnchors[Math.min(baseAnchors.length-1,Math.floor((step+1)*baseAnchors.length/batches))].year:Math.ceil(from+(to-from)*(step+1)/batches);
  const low=Math.max(from,Math.min(lo,hi)),high=Math.min(to,Math.max(lo,hi));
  const known=EVENTS.filter(e=>e.year>=low&&e.year<=high&&(e.expansionFor===journeyKey||base.includes(e))).slice(0,65);
  const anchors=known.map(e=>e.date+' — '+e.title+' ('+(e.major?'major':'minor')+')').join('\n');
  const prompt='Timeline: '+JOURNEYS[journeyKey].title+'\nFocus: '+theme+'\nPeriod for this batch: '+low+' through '+high+' (inclusive).\n'+
   'Produce approximately '+requested+' NEW, UNIQUE real events. Mix: '+mix+'. Detail level: '+depth+'. '+
   'Prefer precise established dates, or mark approximate dates explicitly. Never duplicate any of these existing moments:\n'+anchors+'\n'+
   'Return only JSON with {"events":[{"year":1912,"date":"April 1912","title":"...","region":"...","tags":["culture","science"],"major":false,"summary":"2–3 sentences","why":"2–3 sentences of consequences","context":"'+(depth==='deep'?'5–8':'3–5')+' connected historical sentences","facts":["specific lesser-known fact 1","fact 2"],"narration":"optional natural spoken explanation","wiki":"relevant real English Wikipedia article title"}]}. All events must be within the designated period. Use at least '+(mix==='major'?2:mix==='minor'?7:4)+' minor events out of 10; explore circumstances between famous events. If exact day is unknown, give approximate year, do not invent exact dates. No fabricated quotations, URLs or citations.';
  setAIStatus('Batch '+(step+1)+' of '+batches+': discovering events between '+fmtYear(low)+' and '+fmtYear(high)+'…');
  selected('expansionProgress').textContent=completed+' added so far · each completed batch is already saved.';
  const data=await deepseekJSON('You are a careful historical timeline editor. Output a JSON object only. Prefer widely documented, verifiable events. No fictional dates or sources. Use a diverse mix of everyday life, politics, arts, science, innovations and precursor events where relevant.',prompt,Math.min(10500,Math.max(3800,requested*650)));
  if(!Array.isArray(data.events))throw Error('The API did not return a JSON events array.');
  const clean=data.events.filter(e=>e&&Number.isFinite(Number(e.year))&&Number(e.year)>=low&&Number(e.year)<=high&&String(e.title||'').trim()).filter(e=>{const u=uniqueTitle(e);if(allKnown.has(u))return false;allKnown.add(u);return true}).slice(0,requested);
  if(!clean.length){setAIStatus('Batch '+(step+1)+' returned no new distinct events. Continuing…');continue}
  const record={id:EXPANSION_PREFIX+journeyKey+':'+Date.now()+':'+step+':'+Math.random().toString(36).slice(2,7),kind:'timeline-expansion',target:journeyKey,createdAt:Date.now(),scope,focus:theme,events:clean};
  await dbPut('improvements',record);
  const added=installExpansion(record);completed+=added;
  refreshTimeline();
  selected('expansionProgress').textContent=completed+' new events saved in IndexedDB · '+(step+1)+' of '+batches+' batches.';
 }
 }catch(e){error=e;console.warn('ChronoLine expansion',e)}
 finally{
 running=false;launch.disabled=false;halt.disabled=true;
 refreshTimeline();
 if(error)setAIStatus((completed?'Saved '+completed+' events, but the next request failed: ':'')+error.message,true);
 else setAIStatus(stopRequested?'Stopped. Saved '+completed+' new events successfully.':'Completed! Added '+completed+' real-world historical candidates across '+batches+' requests. Review AI facts for accuracy.');
 selected('expansionProgress').textContent=completed+' saved locally. Original curated history remains unchanged.';
 }
}
function installEntryPoints(){
 const navigation=document.querySelector('.header-nav');
 if(navigation&&!selected('aiStudioNavigation')){const b=document.createElement('button');b.className='navlink';b.id='aiStudioNavigation';b.textContent='✦ DeepSeek AI';b.style.color='var(--accent)';b.onclick=()=>{if(selected('timelinePage').classList.contains('hidden'))openAIBuilder();else openStudio()};navigation.append(b)}
 const actions=document.querySelector('.journey-header-actions');
 if(actions&&!selected('aiExpandJourney')){const b=document.createElement('button');b.className='btn sm primary';b.id='aiExpandJourney';b.textContent='✦ Add events & facts';b.onclick=openStudio;actions.prepend(b)}
 const promo=selected('aiHome');if(promo){promo.textContent='✦ DeepSeek AI — Create New Journey'}
 const existing=selected('aiImproveJourney');if(existing){existing.textContent='✦ Enrich existing cards';existing.title='Improve descriptions of existing events (does not add new ones)'}
 const home=selected('home');if(home&&!selected('aiStartBanner')){const banner=document.createElement('div');banner.id='aiStartBanner';banner.className='page';banner.innerHTML='<div style="padding:12px 16px;margin:14px auto 0;background:var(--surface2);border:1px solid var(--accent);border-radius:13px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><strong>✦ DeepSeek History Studio</strong><div class="muted" style="font-size:12px">Build any timeline · Add 100+ overlooked events · Enrich context and facts · Save locally</div></div><button class="btn primary sm" id="aiBannerButton">Create with AI ↗</button></div>';home.prepend(banner);selected('aiBannerButton').onclick=openAIBuilder}
}
const oldAllJourneyEvents=allJourneyEvents;
allJourneyEvents=function(key){const events=oldAllJourneyEvents(key);const extra=EVENTS.filter(e=>e.expansionFor===key&&!events.includes(e));return events.concat(extra).sort((a,b)=>a.year-b.year||String(a.date).localeCompare(String(b.date)))};
installEntryPoints();
hydrate();
window.ChronoLineExpand={open:openStudio,refresh:hydrate};
})();