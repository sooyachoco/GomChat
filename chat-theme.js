(()=>{
  const root=document.querySelector('.messages');
  if(!root)return;
  const dayBackground=getComputedStyle(root).backgroundImage;
  const NIGHT='linear-gradient(rgba(18,25,43,.18),rgba(18,25,43,.18)),url("./file_000000008a8c822f91344858513e613e.png")';
  function apply(){const h=new Date().getHours(),night=h>=18||h<6;root.style.backgroundImage=night?NIGHT:dayBackground;root.style.backgroundColor=night?'#10192d':'#fffaf5';document.documentElement.style.setProperty('--date-color',night?'#eef4ff':'#705f52');document.querySelectorAll('.date-divider').forEach(e=>{e.style.color=night?'#eef4ff':'#705f52';e.style.textShadow=night?'0 1px 3px rgba(0,0,0,.65)':'0 1px 2px rgba(255,255,255,.8)'})}
  apply();setInterval(apply,60000);

  const style=document.createElement('style');
  style.textContent='.edit-btn{display:none;position:absolute;top:-25px;right:42px;background:#fff;border:1px solid #e5d9cf;border-radius:10px;padding:4px 8px;font-size:11px;color:#806b5d;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer}.me .bubble:hover .edit-btn,.me .bubble:focus-within .edit-btn{display:block}.edited-mark{margin-left:4px;color:#a08f82;font-size:9px}';
  document.head.appendChild(style);

  function getRow(id){return root.querySelector('.row[data-id="'+CSS.escape(id)+'"]')}
  function getEditText(bubble){
    const clone=bubble.cloneNode(true);
    clone.querySelectorAll('img,.msg-meta,.delete-btn,.edit-btn').forEach(e=>e.remove());
    return clone.textContent.trim();
  }
  function markEdited(id,text){
    const row=getRow(id); if(!row)return;
    const bubble=row.querySelector('.bubble'); if(!bubble)return;
    const meta=bubble.querySelector('.msg-meta');
    const buttons=[...bubble.querySelectorAll('.delete-btn,.edit-btn')];
    [...bubble.childNodes].forEach(n=>{if(n!==meta&&!buttons.includes(n)&&n.nodeName!=='IMG')n.remove()});
    if(text){
      const frag=typeof linkify==='function'?linkify(text):document.createTextNode(text);
      bubble.insertBefore(frag,meta||null);
    }
    if(meta){
      meta.querySelector('.edited-mark')?.remove();
      const mark=document.createElement('span');mark.className='edited-mark';mark.textContent='(수정됨)';meta.append(mark);
    }
  }
  function addEditButtons(){
    root.querySelectorAll('.me .bubble').forEach(bubble=>{
      if(bubble.querySelector('img')||bubble.querySelector('.edit-btn'))return;
      const del=bubble.querySelector('.delete-btn');
      if(!del)return;
      const btn=document.createElement('button');
      btn.className='edit-btn';btn.type='button';btn.textContent='수정';
      btn.addEventListener('click',()=>{
        const row=bubble.closest('.row');
        if(!row||typeof socket==='undefined'||socket?.readyState!==WebSocket.OPEN)return;
        const oldText=getEditText(bubble);
        const next=prompt('메시지를 수정하세요.',oldText);
        if(next===null)return;
        const value=next.trim();
        if(!value||value===oldText)return;
        socket.send(JSON.stringify({type:'edit',messageId:row.dataset.id,name:me,text:value}));
      });
      bubble.append(btn);
    });
  }
  const observer=new MutationObserver(()=>addEditButtons());
  observer.observe(root,{childList:true,subtree:true});
  addEditButtons();

  let hookedSocket=null;
  function hookSocket(){
    if(typeof socket==='undefined'||!socket||socket===hookedSocket)return;
    hookedSocket=socket;
    socket.addEventListener('message',e=>{
      try{
        const x=JSON.parse(e.data);
        if(x.type==='edit'&&x.message){markEdited(x.message.id,String(x.message.text||''));}
        if(x.type==='history'&&Array.isArray(x.messages)){
          setTimeout(()=>x.messages.forEach(m=>{if(m.editedAt)markEdited(m.id,String(m.text||''));}),0);
        }
      }catch(_){ }
    });
  }
  setInterval(hookSocket,250);
  hookSocket();
})();
