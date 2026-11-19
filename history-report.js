/* Arquivos gerados a partir do registro salvo, sem depender do formulário atual. */
var LossHistoryReport=(()=>{
 const W=1240,H=1754;
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
 const visualVersion='form-screen-v1';
 async function build(record){
  if(typeof LossFormCapture==='undefined')throw Error('Atualize o aplicativo para carregar a exportação do cadastro.');
  const {canvas,pages}=await LossFormCapture.capture(record);
  const blob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Falha ao salvar a imagem do cadastro.')),'image/jpeg',.94));
  const pageBlobs=await Promise.all(pages.map(blob)),jpeg=await blob(canvas),pdf=await savedPdf({...record,jpeg,pageBlobs});
  return {jpeg,pdf,pageBlobs,pageCount:pages.length,filesAt:new Date().toISOString(),pdfSourceVersion,visualVersion};
 }
 function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
 return {build,download,savedPdf,pdfSourceVersion,visualVersion};
})();
