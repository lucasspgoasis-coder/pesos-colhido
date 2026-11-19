/* Captura isolada da própria tela de cadastro, usando apenas o registro salvo. */
var LossFormCapture=(()=>{
 const fields=['cicloProducao','bloco','blocoOutro','blocoAnterior','blocoAnteriorOutro','cultura','culturaOutro','variedade','variedadeOutro','totalTransplantado','totalColhido','statusPlantio','diasProducao','dataFinalizacao'];
 function prepare(win,record){
  const doc=win.document,d=record.data,get=id=>doc.getElementById(id);
  for(const id of fields){const input=get(id);if(!input)continue;const value=d.fields[id]||'';if(input.tagName==='SELECT'&&value&&![...input.options].some(o=>o.value===value))input.add(new win.Option(d.labels[id]||value,value));input.value=value;}
  for(const [select,other] of [['bloco','blocoOutro'],['blocoAnterior','blocoAnteriorOutro'],['cultura','culturaOutro'],['variedade','variedadeOutro']])get(other)?.classList.toggle('hidden',get(select)?.value!=='outros');
  win.eval('causasList='+JSON.stringify(d.causes||[]));win.recalcularTudo();
  get('semanaAtual').textContent=d.fields.cicloProducao||'--';get('dataAtual').textContent=d.day.split('-').reverse().join('/');
  if(get('lossObservationDate'))get('lossObservationDate').value=d.day;
  get('boxDataFim')?.classList.toggle('hidden',d.fields.statusPlantio!=='Finalizado');
  get('registroForm').hidden=false;get('registroForm').classList.remove('hidden');
  get('causaLista')?.closest('.grid')?.parentElement.remove();
  for(const selector of ['.loss-tabs','#lossSaveStatus','.loss-local-note','#lossHistoryFilters','#lossPanel-history','#lossPanel-analysis','button','.no-print'])for(const item of doc.querySelectorAll(selector))item.remove();
  for(const item of doc.querySelectorAll('input,select,textarea')){
   if(item.type==='file'||item.type==='hidden'||item.closest('.hidden,[hidden]')){item.remove();continue;}
   const text=doc.createElement('div');text.id=item.id;text.className=item.className;text.classList.add('loss-export-value');text.textContent=item.tagName==='SELECT'?(item.selectedOptions[0]?.textContent||'—'):item.type==='date'&&item.value?item.value.split('-').reverse().join('/'):(item.value||'—');item.replaceWith(text);
  }
  const capture=get('captureArea');capture.style.cssText='width:1280px!important;max-width:1280px!important;margin:0!important;background:white!important;padding:0!important;';
  return capture;
 }
 function cuts(height,target,blocks=[]){const result=[];let top=0;while(top<height){let bottom=Math.min(height,top+target);if(bottom<height){const crossing=blocks.filter(b=>b.top<bottom&&b.bottom>bottom&&b.bottom-b.top<target*.9).sort((a,b)=>a.top-b.top)[0];if(crossing&&crossing.top>top+target*.35)bottom=Math.floor(crossing.top);}result.push([top,bottom]);top=bottom;}return result;}
 async function capture(record){
  if(typeof window.html2canvas!=='function')throw Error('Conecte-se para carregar a captura do formulário e tente novamente.');
  const source=[...document.scripts].find(script=>!script.src&&script.textContent.includes('function recalcularTudo()'))?.textContent;if(!source)throw Error('O modelo do formulário não foi encontrado. Atualize o aplicativo.');
  const original=document.getElementById('captureArea');if(!original)throw Error('A tela do cadastro não está disponível.');
  const frame=document.createElement('iframe');frame.title='Preparando relatório do cadastro';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-20000px;top:0;width:1280px;height:1000px;border:0;pointer-events:none;';document.body.append(frame);
  try{
   const win=frame.contentWindow,doc=win.document;doc.open();doc.write('<!doctype html><html><head></head><body></body></html>');doc.close();doc.body.className=document.body.className;
   const base=doc.createElement('base');base.href=document.baseURI;doc.head.append(base);
   for(const item of document.head.querySelectorAll('style,link[rel="stylesheet"]'))doc.head.append(item.cloneNode(true));
   const style=doc.createElement('style');style.textContent='html,body{width:1280px!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;background:white!important}*{animation:none!important;transition:none!important;caret-color:transparent!important}.loss-export-value{display:block;min-height:46px;line-height:1.5;padding-top:10px!important;padding-bottom:10px!important;white-space:normal;overflow-wrap:anywhere}.loss-export-value.hidden{display:none!important}#lossEntryTools{margin:18px 24px}';doc.head.append(style);
   const main=doc.createElement('main');main.id='lossMain';main.append(original.cloneNode(true));doc.body.append(main);
   const script=doc.createElement('script');script.textContent=source.replace(/document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\n        \}\);/,'');doc.body.append(script);const element=prepare(win,record);
   await Promise.all([...doc.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.sheet?Promise.resolve():new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Os estilos do cadastro não carregaram. Tente novamente com conexão.')),15000);link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);reject(Error('Não foi possível carregar o visual do cadastro.'));};})));
   if(doc.fonts?.ready)await doc.fonts.ready;
   await Promise.all([...element.querySelectorAll('img')].map(img=>img.complete&&img.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Uma foto do registro não carregou.')),15000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Uma foto do registro não pôde ser incluída.'));};})));
   const height=Math.ceil(element.scrollHeight),scale=Math.min(1.5,24000/height);if(height<100)throw Error('O formulário ainda não está pronto para exportação.');
   const canvas=await window.html2canvas(element,{scale,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:1280,windowHeight:Math.max(1000,height),scrollX:0,scrollY:0});
   const origin=element.getBoundingClientRect().top,blocks=[...element.querySelectorAll('#tabelaCausasBody>tr,#registroForm>section,.packhouse-notice,.flow-entry-result')].map(item=>{const rect=item.getBoundingClientRect();return {top:(rect.top-origin)*scale,bottom:(rect.bottom-origin)*scale};});
   const pages=cuts(canvas.height,Math.round(canvas.width*297/210),blocks).map(([top,bottom])=>{const page=document.createElement('canvas');page.width=canvas.width;page.height=Math.round(canvas.width*297/210);const ctx=page.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,page.width,page.height);ctx.drawImage(canvas,0,top,canvas.width,bottom-top,0,0,canvas.width,bottom-top);return page;});
   return {canvas,pages};
  }finally{frame.remove();}
 }
 return {capture,prepare,cuts};
})();
