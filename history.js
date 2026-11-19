/* Histórico neste aparelho: rascunho, registros, imagens, PDFs e análises. */
let lossDb=null,lossRecords=[],lossCurrentId=null,lossReady=false,lossSaveTimer,lossSaveQueue=Promise.resolve(),lossActiveTab='form';
const lossFileJobs=new Map(),lossCharts=[],lossDeletedIds=new Set();
const lossFieldIds=['cicloProducao','bloco','blocoOutro','blocoAnterior','blocoAnteriorOutro','cultura','culturaOutro','variedade','variedadeOutro','totalTransplantado','totalColhido','statusPlantio','diasProducao','dataFinalizacao'];
const lossCopyOptions=value=>Array.isArray(value)?value.map(lossCopyOptions):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,lossCopyOptions(item)])):value;
const lossGet=id=>document.getElementById(id);
const lossToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date());
function lossStatus(text,error=false){const node=lossGet('lossSaveStatus');node.textContent=text;node.dataset.state=error?'error':'saved';}
function lossCapture(){const fields=Object.fromEntries(lossFieldIds.map(id=>[id,lossGet(id)?.value||'']));return {day:lossGet('lossObservationDate').value||lossToday(),fields,labels:{bloco:getSelectValue('bloco','blocoOutro'),blocoAnterior:getSelectValue('blocoAnterior','blocoAnteriorOutro'),cultura:getSelectValue('cultura','culturaOutro'),variedade:getSelectValue('variedade','variedadeOutro')},causes:structuredClone(causasList)};}
function lossSetRecord(record){lossRecords=lossRecords.filter(r=>r.id!==record.id);lossRecords.push(record);}
function lossQueueSave(){if(!lossReady||(lossCurrentId&&lossDeletedIds.has(lossCurrentId)))return;clearTimeout(lossSaveTimer);lossStatus('Salvando alterações neste aparelho…');lossSaveTimer=setTimeout(()=>lossSave(false).catch(()=>{}),1500);}
function lossSave(manual=false){
 if(!lossDb){lossStatus('Histórico indisponível neste navegador. Os dados ainda não foram salvos.',true);return Promise.reject(Error('Armazenamento local indisponível.'));}
 if(lossCurrentId&&lossDeletedIds.has(lossCurrentId))return Promise.resolve(null);
 clearTimeout(lossSaveTimer);const data=lossCapture(),errors=LossHistoryCore.validate(data),now=new Date().toISOString();
 if(!errors.length&&!lossCurrentId)lossCurrentId=crypto.randomUUID();const id=lossCurrentId;
 const run=lossSaveQueue.catch(()=>{}).then(async()=>{
  if(id&&lossDeletedIds.has(id))return null;
  await LossHistoryCore.draft(lossDb,{data,currentId:id,updatedAt:now});
  if(errors.length){lossStatus('Rascunho salvo neste aparelho. '+errors[0],true);if(manual)throw Error(errors[0]);return null;}
  const fingerprint=JSON.stringify(data),old=lossRecords.find(r=>r.id===id);
  if(old?.fingerprint===fingerprint){lossStatus('Registro salvo neste aparelho.');return old;}
  const record={id,createdAt:old?.createdAt||now,updatedAt:now,data,fingerprint,jpeg:null,png:null,pdf:null,pageBlobs:null};
  await LossHistoryCore.put(lossDb,record);lossSetRecord(record);lossStatus('Registro salvo. Preparando PNG e PDF…');lossRefresh();
  lossFiles(record).catch(error=>lossStatus('Dados salvos. Não foi possível preparar os arquivos: '+error.message,true));return record;
 });lossSaveQueue=run.catch(()=>{});return run.catch(error=>{lossStatus('Falha ao salvar: '+error.message,true);throw error;});
}
function lossFiles(record){
 const prior=lossFileJobs.get(record.id)||Promise.resolve();
 const task=prior.catch(()=>{}).then(async()=>{
  const current=await LossHistoryCore.get(lossDb,record.id);if(!current||current.fingerprint!==record.fingerprint)return current;
  if(current.reportVersion===LossHistoryReport.version&&current.jpeg&&current.png&&(current.pdf||!window.jspdf?.jsPDF))return current;
  const files=await LossHistoryReport.build(current),attached=await LossHistoryCore.attachFiles(lossDb,current.id,current.fingerprint,files),saved=await LossHistoryCore.get(lossDb,current.id);
  if(attached){lossSetRecord(saved);if(lossCurrentId===saved.id)lossStatus('Registro e imagens salvos neste aparelho.'+(saved.pdf?' PDF também disponível.':' PDF será gerado quando a biblioteca estiver disponível.'));lossRefresh();}return saved;
 });lossFileJobs.set(record.id,task);task.finally(()=>{if(lossFileJobs.get(record.id)===task)lossFileJobs.delete(record.id);}).catch(()=>{});return task;
}
async function lossDownload(id,format){try{let record=await LossHistoryCore.get(lossDb,id);if(!record)throw Error('Registro não encontrado.');record=await lossFiles(record);const blob=record?.[format];if(!blob)throw Error(format==='pdf'?'Conecte-se para carregar a biblioteca PDF e tente novamente.':'Imagem ainda indisponível.');const stem='Perdas_'+record.data.day+'_Ciclo'+String(record.data.fields.cicloProducao).replace(/[^\w-]/g,'')+'_'+id.slice(0,8);LossHistoryReport.download(blob,stem+(format==='pdf'?'.pdf':format==='png'?'.png':'.jpg'));}catch(error){showToast(error.message,'error');}}
async function lossSaveAndDownload(format){try{const record=await lossSave(true);if(record)await lossDownload(record.id,format);}catch(error){showToast(error.message,'error');}}
function lossRestore(data){
 if(!data)return;for(const id of lossFieldIds)if(lossGet(id))lossGet(id).value=data.fields[id]||'';
 for(const id of ['bloco','blocoAnterior','cultura','variedade'])lossGet(id).dispatchEvent(new Event('change',{bubbles:true}));
 lossGet('lossObservationDate').value=data.day||lossToday();causasList=structuredClone(data.causes||[]);lossGet('semanaAtual').textContent=data.fields.cicloProducao||'--';lossGet('relSemana').textContent=data.fields.cicloProducao||'--';toggleDataFim();recalcularTudo();lossUpdateDate();
}
function lossUpdateDate(){const value=lossGet('lossObservationDate').value||lossToday();lossGet('dataAtual').textContent=formatarDataInputToBR(value);lossGet('relData').textContent=formatarDataInputToBR(value);}
function lossTab(name){lossActiveTab=name;for(const tab of ['form','history','analysis']){lossGet(tab==='form'?'registroForm':'lossPanel-'+tab).hidden=name!==tab;const btn=lossGet('lossTab-'+tab);btn.classList.toggle('active',name===tab);btn.setAttribute('aria-selected',String(name===tab));}lossGet('lossFormActions').hidden=name!=='form';lossGet('lossEntryTools').hidden=name!=='form';lossGet('lossHistoryFilters').hidden=name==='form';lossRefresh();}
function lossFiltered(){const block=lossGet('lossFilterBlock').value,start=lossGet('lossFilterStart').value,end=lossGet('lossFilterEnd').value;return lossRecords.filter(r=>(!block||r.data.labels.bloco===block)&&(!start||r.data.day>=start)&&(!end||r.data.day<=end));}
function lossRefresh(){
 const select=lossGet('lossFilterBlock'),chosen=select.value;select.replaceChildren(new Option('Todos os blocos',''));for(const name of [...new Set(lossRecords.map(r=>r.data.labels.bloco))].sort())select.add(new Option(name,name));select.value=[...select.options].some(o=>o.value===chosen)?chosen:'';
 if(lossActiveTab==='history')lossRenderHistory();if(lossActiveTab==='analysis')lossRenderAnalysis();lossGet('lossHistoryCount').textContent=lossRecords.length+' registro(s) salvo(s) neste aparelho';
}
function lossNode(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function lossRenderHistory(){
 const target=lossGet('lossHistoryList');target.replaceChildren();const records=lossFiltered().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 if(!records.length){target.append(lossNode('p','Nenhum registro nos filtros selecionados. Preencha um levantamento na aba Registrar.','loss-empty'));return;}
 for(const record of records){const m=LossHistoryCore.metrics(record.data),card=lossNode('article',undefined,'loss-history-card');card.append(lossNode('span',record.data.day.split('-').reverse().join('/')+' · Ciclo '+record.data.fields.cicloProducao,'loss-eyebrow'),lossNode('h3',record.data.labels.bloco),lossNode('p',record.data.labels.cultura+' · '+record.data.labels.variedade),lossNode('strong',m.lost.toLocaleString('pt-BR')+' perdas / não colhido · '+m.lossPercent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%'),lossNode('p','Transplantado: '+m.transplanted.toLocaleString('pt-BR')+' · Colhido: '+m.harvested.toLocaleString('pt-BR')),lossNode('small','Atualizado em '+new Date(record.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'})));
  const actions=lossNode('div',undefined,'loss-actions');for(const [label,action] of [['Ver registro','view'],['PNG','png'],['PDF','pdf'],['Editar','edit'],['Excluir','delete']]){const button=lossNode('button',label);button.type='button';button.dataset.lossAction=action;button.dataset.recordId=record.id;if(action==='delete'){button.classList.add('loss-delete-button');button.setAttribute('aria-label','Excluir '+record.data.labels.bloco+' · Ciclo '+record.data.fields.cicloProducao);const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML='<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>';button.prepend(icon);}actions.append(button);}card.append(actions,lossNode('small',record.png?'PNG'+(record.pdf?' e PDF':'')+' disponíveis no histórico.':'Dados salvos · arquivos serão preparados ao abrir.'));target.append(card);
 }
}
function lossRenderAnalysis(){
 const summary=LossHistoryCore.summarize(lossFiltered());lossGet('lossAnalysisCount').textContent=summary.count+' levantamento(s) considerado(s)';
 const metrics=lossGet('lossAnalysisMetrics');metrics.replaceChildren();for(const [label,value] of [['Transplantado',summary.transplanted.toLocaleString('pt-BR')+' un'],['Colhido',summary.harvested.toLocaleString('pt-BR')+' un'],['Perda / não colhido',summary.lost.toLocaleString('pt-BR')+' un'],['Percentual de perda',summary.lossPercent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%']]){const card=lossNode('div',undefined,'card kpi');const badge=lossNode('span',undefined,'metric-badge');badge.innerHTML=lossGet('lossTab-analysis').querySelector('svg').outerHTML;card.append(badge,lossNode('span',label),lossNode('strong',value));metrics.append(card);}
 for(const chart of lossCharts)chart.destroy();lossCharts.length=0;lossGet('lossAnalysisEmpty').hidden=summary.count>0;if(typeof Chart==='undefined')return;
 const common={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},datalabels:{display:'auto',anchor:'end',align:'top',color:'#294956',font:{weight:'bold'},formatter:v=>v?v.toLocaleString('pt-BR'):''}},scales:{y:{beginAtZero:true,title:{display:true,text:'Unidades'}}}};
 lossCharts.push(new Chart(lossGet('lossBlockChart'),{type:'bar',data:{labels:summary.blocks.map(b=>b.name),datasets:[{label:'Colhido',data:summary.blocks.map(b=>b.harvested),backgroundColor:'#16835e'},{label:'Perdas com causa',data:summary.blocks.map(b=>b.detailed),backgroundColor:'#ca8c2a'},{label:'Saldo não detalhado',data:summary.blocks.map(b=>b.balance),backgroundColor:'#b04d45'}]},options:lossCopyOptions(common)}));
 const causes=[...summary.causes];if(summary.balance)causes.push({name:'Saldo não detalhado',value:summary.balance});lossGet('lossCausePlot').style.height=Math.max(330,causes.length*48)+'px';const causeOptions=lossCopyOptions(common);causeOptions.indexAxis='y';causeOptions.scales={x:{beginAtZero:true,title:{display:true,text:'Unidades'}},y:{ticks:{autoSkip:false}}};causeOptions.plugins.datalabels.align='right';causeOptions.layout={padding:{right:75}};
 lossCharts.push(new Chart(lossGet('lossCauseChart'),{type:'bar',data:{labels:causes.map(c=>c.name),datasets:[{label:'Perdas / não colhido',data:causes.map(c=>c.value),backgroundColor:causes.map(c=>c.name==='Saldo não detalhado'?'#7c9098':'#b04d45')}]},options:causeOptions}));
}
async function lossView(id){try{let record=await LossHistoryCore.get(lossDb,id);if(!record)return;const target=lossGet('lossRecordView');target.replaceChildren(lossNode('h3',record.data.labels.bloco+' · Ciclo '+record.data.fields.cicloProducao),lossNode('p','Levantamento de '+record.data.day.split('-').reverse().join('/')+' · '+record.data.labels.cultura+' · '+record.data.labels.variedade));for(const c of record.data.causes)target.append(lossNode('p',[c.categoria,c.especificacao].filter(Boolean).join(' · ')+': '+c.qtd.toLocaleString('pt-BR')+' un'));record=await lossFiles(record);if(record?.jpeg){if(lossView.url)URL.revokeObjectURL(lossView.url);lossView.url=URL.createObjectURL(record.jpeg);const image=lossNode('img');image.src=lossView.url;image.alt='Relatório salvo com gráficos e fotos';target.append(image);}lossView.recordId=id;lossGet('lossRecordDialog').showModal();}catch(error){showToast(error.message,'error');}}
async function lossEdit(id){try{if(lossReady)await lossSave(false);const record=await LossHistoryCore.get(lossDb,id);if(!record)return;lossReady=false;lossCurrentId=record.id;lossRestore(record.data);lossReady=true;lossTab('form');lossStatus('Editando o registro salvo. As alterações atualizam este registro.');}catch(error){showToast(error.message,'error');}}
async function lossDelete(id){
 if(!lossDb||lossDeletedIds.has(id))return false;
 try{const record=await LossHistoryCore.get(lossDb,id);if(!record)return false;const label=record.data.labels.bloco+' · Ciclo '+record.data.fields.cicloProducao+' · '+record.data.day.split('-').reverse().join('/');if(!window.confirm('Excluir o registro de '+label+'?\n\nO registro e seus arquivos salvos neste aparelho serão removidos. Não é possível desfazer.'))return false;
  lossDeletedIds.add(id);if(lossCurrentId===id)clearTimeout(lossSaveTimer);await lossSaveQueue.catch(()=>{});await LossHistoryCore.remove(lossDb,id);lossRecords=lossRecords.filter(item=>item.id!==id);
  if(lossCurrentId===id){const ready=lossReady;lossReady=false;clearTimeout(lossSaveTimer);lossOriginalClear();lossCurrentId=null;lossGet('lossObservationDate').value=lossToday();lossUpdateDate();lossReady=ready;}
  if(lossView.recordId===id){const dialog=lossGet('lossRecordDialog');if(dialog.open)dialog.close();if(lossView.url){URL.revokeObjectURL(lossView.url);lossView.url=null;}lossView.recordId=null;lossGet('lossRecordView').replaceChildren();}
  lossRefresh();lossStatus('Registro excluído do histórico deste aparelho.');showToast('Registro excluído.');return true;
 }catch(error){lossDeletedIds.delete(id);lossStatus('Não foi possível excluir: '+error.message,true);showToast('Não foi possível excluir o registro.','error');if(lossReady&&lossCurrentId===id)lossQueueSave();return false;}
}
async function lossBackup(){try{await lossSaveQueue;const records=await LossHistoryCore.all(lossDb),data={format:'oasis-perdas-backup-v1',exportedAt:new Date().toISOString(),records:records.map(({id,createdAt,updatedAt,data})=>({id,createdAt,updatedAt,data}))};LossHistoryReport.download(new Blob([JSON.stringify(data)],{type:'application/json'}),'Historico_Perdas_'+lossToday()+'.json');}catch(error){showToast(error.message,'error');}}
async function lossInitialize(){
 try{lossDb=await LossHistoryCore.open();lossRecords=await LossHistoryCore.all(lossDb);const draft=await LossHistoryCore.draft(lossDb);if(draft?.data){lossCurrentId=draft.currentId||null;lossRestore(draft.data);lossStatus('Último rascunho restaurado deste aparelho.');}else{lossGet('lossObservationDate').value=lossToday();lossUpdateDate();lossStatus('Pronto. Os dados serão salvos automaticamente neste aparelho.');}lossReady=true;lossRefresh();}catch(error){lossStatus('Histórico indisponível: '+error.message,true);}
 lossGet('registroForm').addEventListener('input',lossQueueSave);lossGet('registroForm').addEventListener('change',lossQueueSave);lossGet('lossObservationDate').addEventListener('change',()=>{lossUpdateDate();lossQueueSave();});
 for(const id of ['lossFilterBlock','lossFilterStart','lossFilterEnd'])lossGet(id).addEventListener('change',lossRefresh);
 lossGet('lossHistoryList').addEventListener('click',event=>{const button=event.target.closest('button[data-loss-action]');if(!button)return;const id=button.dataset.recordId,action=button.dataset.lossAction;if(action==='view')lossView(id);else if(action==='edit')lossEdit(id);else if(action==='delete'){button.disabled=true;lossDelete(id).finally(()=>{if(button.isConnected)button.disabled=false;});}else lossDownload(id,action);});
 lossGet('lossSaveNow').addEventListener('click',async()=>{const button=lossGet('lossSaveNow');button.disabled=true;try{const record=await lossSave(true);await lossFiles(record);showToast('Registro salvo no histórico deste aparelho.');}catch(error){showToast(error.message,'error');}finally{button.disabled=false;}});
}
const lossOriginalStatus=atualizarStatusCausas;atualizarStatusCausas=function(){lossOriginalStatus();lossQueueSave();};
const lossOriginalClear=limparFormulario;limparFormulario=async function(){try{if(lossReady)await lossSave(false);lossReady=false;clearTimeout(lossSaveTimer);lossOriginalClear();lossCurrentId=null;lossGet('lossObservationDate').value=lossToday();lossUpdateDate();if(lossDb)await LossHistoryCore.draft(lossDb,{data:lossCapture(),currentId:null,updatedAt:new Date().toISOString()});lossReady=true;lossStatus('Novo levantamento. O registro anterior permanece no histórico.');}catch(error){showToast('Não foi possível iniciar outro registro: '+error.message,'error');}};
exportarJPEG=()=>lossSaveAndDownload('jpeg');exportarPNG=()=>lossSaveAndDownload('png');exportarPDF=()=>lossSaveAndDownload('pdf');
const lossOriginalSend=enviarParaPlanilha;enviarParaPlanilha=async()=>{try{await lossSave(true);await lossOriginalSend();}catch(error){showToast(error.message,'error');}};
document.addEventListener('DOMContentLoaded',lossInitialize,{once:true});
