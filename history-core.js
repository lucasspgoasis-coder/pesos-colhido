/* Registros locais completos. Nenhuma chamada de rede é feita por este módulo. */
var LossHistoryCore=(()=>{
 const DB_NAME='oasis-contagem-perdas-v1';
 function number(value){const result=Number(value);return Number.isFinite(result)?result:0;}
 function validate(data){
  const errors=[];
  if(!String(data.fields.cicloProducao||'').trim())errors.push('Informe o ciclo.');
  for(const [key,label] of [['bloco','bloco'],['cultura','cultura'],['variedade','variedade']])if(!data.labels[key]||/não inf/i.test(data.labels[key]))errors.push('Informe '+label+'.');
  const total=Number(data.fields.totalTransplantado),harvest=Number(data.fields.totalColhido||0);
  if(!Number.isSafeInteger(total)||total<=0)errors.push('O total transplantado deve ser um número inteiro maior que zero.');
  if(!Number.isSafeInteger(harvest)||harvest<0||harvest>total)errors.push('O total colhido deve estar entre zero e o total transplantado.');
  if(data.causes.some(c=>!Number.isSafeInteger(Number(c.qtd))||Number(c.qtd)<0))errors.push('Revise as quantidades das causas.');
  if(data.causes.reduce((s,c)=>s+number(c.qtd),0)>total-harvest)errors.push('As causas ultrapassam o total de perdas.');
  if(data.fields.statusPlantio==='Finalizado'&&!data.fields.dataFinalizacao)errors.push('Informe a data de finalização.');
  return errors;
 }
 function metrics(data){const transplanted=number(data.fields.totalTransplantado),harvested=number(data.fields.totalColhido),lost=Math.max(0,transplanted-harvested),detailed=data.causes.reduce((sum,c)=>sum+number(c.qtd),0);return {transplanted,harvested,lost,detailed,balance:Math.max(0,lost-detailed),lossPercent:transplanted?lost/transplanted*100:0};}
 function latest(records){const result=new Map();for(const record of [...records].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))){const d=record.data,key=JSON.stringify([d.labels.bloco,d.fields.cicloProducao,d.labels.cultura,d.labels.variedade]);result.set(key,record);}return [...result.values()];}
 function summarize(records){
  const rows=latest(records),blocks=new Map(),causes=new Map();let total={transplanted:0,harvested:0,lost:0,detailed:0,balance:0};
  for(const record of rows){const m=metrics(record.data),name=record.data.labels.bloco;if(!blocks.has(name))blocks.set(name,{name,transplanted:0,harvested:0,lost:0,detailed:0,balance:0});for(const key of Object.keys(total)){total[key]+=m[key];blocks.get(name)[key]+=m[key];}for(const cause of record.data.causes){const label=[cause.categoria,cause.especificacao].filter(Boolean).join(' · ');causes.set(label,(causes.get(label)||0)+number(cause.qtd));}}
  return {count:rows.length,...total,lossPercent:total.transplanted?total.lost/total.transplanted*100:0,blocks:[...blocks.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true})),causes:[...causes].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)};
 }
 function open(factory=globalThis.indexedDB){return new Promise((resolve,reject)=>{if(!factory)return reject(Error('Este navegador não oferece armazenamento local.'));const request=factory.open(DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'id'});if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts');};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Feche outras abas do módulo para atualizar o histórico.'));request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};});}
 function transaction(db,store,mode,action){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),request=action(tx.objectStore(store));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||request.error);tx.onabort=()=>reject(tx.error||Error('Não foi possível salvar o histórico.'));});}
 const get=(db,id)=>transaction(db,'records','readonly',s=>s.get(id));
 const all=db=>transaction(db,'records','readonly',s=>s.getAll());
 const put=(db,record)=>transaction(db,'records','readwrite',s=>s.put(record));
 const draft=(db,value)=>value===undefined?transaction(db,'drafts','readonly',s=>s.get('active')):transaction(db,'drafts','readwrite',s=>s.put(value,'active'));
 function attachFiles(db,id,fingerprint,files){return new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),request=store.get(id);let attached=false;request.onsuccess=()=>{const record=request.result;if(record&&record.fingerprint===fingerprint){store.put({...record,...files});attached=true;}};tx.oncomplete=()=>resolve(attached);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Falha ao guardar os arquivos.'));});}
 return {validate,metrics,latest,summarize,open,get,all,put,draft,attachFiles};
})();
