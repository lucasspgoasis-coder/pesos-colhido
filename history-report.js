/* Arquivos gerados a partir do registro salvo, sem depender do formulário atual. */
var LossHistoryReport=(()=>{
 const W=1240,H=1754,M=70,colors={ink:'#173447',accent:'#b04d45',green:'#16835e',amber:'#ca8c2a',light:'#edf4f6'};
 const num=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1});
 const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'});
 function textLines(ctx,text,width){const lines=[];let line='';for(const word of String(text).split(/\s+/)){if(ctx.measureText((line?line+' ':'')+word).width>width&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
 const pdfSourceVersion='history-images-v1';
 async function imageData(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));return data;}
 async function savedPdf(record){
  if(!window.jspdf?.jsPDF)return null;
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
  let sources=record.pageBlobs?.length?record.pageBlobs:null;
  if(!sources){
   if(!record.jpeg)throw Error('A imagem do histórico ainda não está disponível.');
   const bytes=await imageData(record.jpeg),props=doc.getImageProperties(bytes);
   if(props.height/props.width>1.5){
    const binary=bytes;
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Não foi possível abrir a imagem salva no histórico.'));img.src='data:image/jpeg;base64,'+btoa(binary);});
    const pageHeight=Math.round(image.width*H/W);sources=[];
    for(let top=0;top<image.height;top+=pageHeight){const c=document.createElement('canvas');c.width=image.width;c.height=Math.min(pageHeight,image.height-top);c.getContext('2d').drawImage(image,0,top,c.width,c.height,0,0,c.width,c.height);sources.push(await new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(Error('Falha ao separar as páginas salvas.')),'image/jpeg',.94)));}
   }else sources=[record.jpeg];
  }
  for(let i=0;i<sources.length;i++){if(i)doc.addPage();const bytes=await imageData(sources[i]),props=doc.getImageProperties(bytes),scale=Math.min(210/props.width,297/props.height),width=props.width*scale,height=props.height*scale;doc.addImage(bytes,'JPEG',(210-width)/2,0,width,height);}
  doc.setProperties({title:'Registro de perdas · '+(record.data?.labels?.bloco||'Histórico'),creator:'Sistema integrado'});return doc.output('blob');
 }
 async function build(record){
  const pages=[];let canvas,ctx,y;const d=record.data,m=LossHistoryCore.metrics(d);
  function page(){canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle=colors.ink;ctx.fillRect(0,0,W,150);ctx.fillStyle='#fff';ctx.font='bold 32px Arial';ctx.fillText('FAZENDA OÁSIS · CONTAGEM DE PERDAS',M,65);ctx.font='18px Arial';ctx.fillText('Registro salvo neste aparelho · '+date(record.updatedAt),M,105);ctx.fillStyle='#6d8490';ctx.font='15px Arial';ctx.fillText('Registro '+record.id+' · página '+(pages.length+1),M,H-36);pages.push(canvas);y=195;}
  function ensure(height){if(y+height>H-80)page();}
  function text(value,size=20,bold=false,color=colors.ink,width=W-M*2){ctx.font=(bold?'bold ':'')+size+'px Arial';ctx.fillStyle=color;const lines=textLines(ctx,value,width);ensure(lines.length*(size+10));ctx.font=(bold?'bold ':'')+size+'px Arial';ctx.fillStyle=color;for(const line of lines){ctx.fillText(line,M,y);y+=size+10;}}
  function section(title){ensure(90);y+=20;text(title,25,true);y+=10;}
  function bar(label,value,total,color){ctx.font='18px Arial';const lines=textLines(ctx,label,W-M*2-230),height=Math.max(72,lines.length*26+32);ensure(height);ctx.font='18px Arial';ctx.fillStyle=colors.ink;for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],M,y+i*26);ctx.font='bold 19px Arial';ctx.textAlign='right';ctx.fillText(num(value)+' un · '+num(total?value/total*100:0)+'%',W-M,y);ctx.textAlign='left';y+=lines.length*26+8;ctx.fillStyle=colors.light;ctx.fillRect(M,y,W-M*2,16);ctx.fillStyle=color;ctx.fillRect(M,y,(W-M*2)*Math.min(1,total?value/total:0),16);y+=35;}
  page();
  text(d.labels.bloco+' · Ciclo '+d.fields.cicloProducao,28,true);text('Data do levantamento: '+d.day.split('-').reverse().join('/'),18);text(d.labels.cultura+' · '+d.labels.variedade,22);text('Situação: '+(d.fields.statusPlantio||'Não informada')+' · Finalização: '+(d.fields.dataFinalizacao?d.fields.dataFinalizacao.split('-').reverse().join('/'):'Não informada'),18);
  if(d.fields.diasProducao)text('Dias de produção: '+d.fields.diasProducao,18);
  if(d.labels.blocoAnterior&&!/não inf/i.test(d.labels.blocoAnterior))text('Bloco anterior: '+d.labels.blocoAnterior,18);
  section('Resumo da produção e perdas');
  text('Transplantado: '+num(m.transplanted)+' un   |   Colhido: '+num(m.harvested)+' un',23,true);
  text('Perda / não colhido: '+num(m.lost)+' un ('+num(m.lossPercent)+'%)',23,true,colors.accent);
  text('Detalhado por causa: '+num(m.detailed)+' un   |   Saldo não detalhado: '+num(m.balance)+' un',19);
  section('Gráfico · participação no total transplantado');
  bar('Colhido',m.harvested,m.transplanted,colors.green);bar('Perdas com causa registrada',m.detailed,m.transplanted,colors.amber);bar('Saldo não detalhado',m.balance,m.transplanted,colors.accent);
  section('Gráfico · causas registradas');
  if(!d.causes.length)text('Nenhuma causa detalhada neste levantamento.',19);
  for(const cause of [...d.causes].sort((a,b)=>b.qtd-a.qtd)){bar([cause.categoria,cause.especificacao].filter(Boolean).join(' · '),cause.qtd,m.transplanted,colors.accent);if(Number(cause.qtdAnterior)>0){const delta=cause.qtd-Number(cause.qtdAnterior);text('Referência anterior: '+num(cause.qtdAnterior)+' un · Diferença: '+(delta>0?'+':'')+num(delta)+' un ('+(delta>0?'+':'')+num(delta/cause.qtdAnterior*100)+'%)',16,false,'#6d8490');}}
  text('Percentuais calculados sobre o total transplantado. O saldo não detalhado não recebe uma causa presumida.',16,false,'#6d8490');
  for(const cause of d.causes){const photos=cause.fotosBase64||(cause.fotoBase64?[cause.fotoBase64]:[]);if(!photos.length)continue;section('Fotos · '+cause.categoria);for(const src of photos){if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src))continue;ensure(390);try{const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Foto indisponível'));img.src=src;});const scale=Math.min((W-M*2)/image.width,340/image.height);ctx.drawImage(image,M,y,image.width*scale,image.height*scale);y+=image.height*scale+30;}catch{text('Não foi possível desenhar esta foto; o arquivo original permanece no registro.',16,false,'#8b4e36');}}}
  const pageBlobs=await Promise.all(pages.map(c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Falha ao gerar imagem JPEG.')),'image/jpeg',.9))));
  const combined=document.createElement('canvas'),scale=Math.min(1,24000/(H*pages.length));combined.width=Math.round(W*scale);combined.height=Math.round(H*pages.length*scale);const combinedCtx=combined.getContext('2d');pages.forEach((c,i)=>combinedCtx.drawImage(c,0,Math.round(i*H*scale),combined.width,Math.round(H*scale)));
  const jpeg=await new Promise((resolve,reject)=>combined.toBlob(b=>b?resolve(b):reject(Error('Falha ao gerar JPEG.')),'image/jpeg',.9));
  const pdf=await savedPdf({...record,jpeg,pageBlobs});
  return {jpeg,pdf,pageBlobs,pageCount:pages.length,filesAt:new Date().toISOString(),pdfSourceVersion};
 }
 function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
 return {build,download,savedPdf,pdfSourceVersion};
})();
