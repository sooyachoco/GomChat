(()=>{
  const root=document.querySelector('.messages');
  if(!root)return;
  const dayBackground=getComputedStyle(root).backgroundImage;
  const NIGHT='linear-gradient(rgba(18,25,43,.18),rgba(18,25,43,.18)),url("./file_000000008a8c822f91344858513e613e.png")';
  function apply(){const h=new Date().getHours(),night=h>=18||h<6;root.style.backgroundImage=night?NIGHT:dayBackground;root.style.backgroundColor=night?'#10192d':'#fffaf5';document.documentElement.style.setProperty('--date-color',night?'#eef4ff':'#705f52');document.querySelectorAll('.date-divider').forEach(e=>{e.style.color=night?'#eef4ff':'#705f52';e.style.textShadow=night?'0 1px 3px rgba(0,0,0,.65)':'0 1px 2px rgba(255,255,255,.8)'})}
  apply();setInterval(apply,60000);

  const style=document.createElement('style');
  style.textContent=`
    .edit-btn{display:none;position:absolute;top:-25px;right:42px;background:#fff;border:1px solid #e5d9cf;border-radius:10px;padding:4px 8px;font-size:11px;color:#806b5d;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer}.me .bubble:hover .edit-btn,.me .bubble:focus-within .edit-btn{display:block}.edited-mark{margin-left:4px;color:#a08f82;font-size:9px}
    .emoticon-btn{position:absolute!important;width:36px!important;height:36px!important;min-width:36px!important;border:0!important;border-radius:50%!important;background:transparent!important;color:#806b5d!important;font-size:21px!important;padding:0!important;margin:0!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:8!important;cursor:pointer!important;opacity:.9!important;box-sizing:border-box!important}.emoticon-btn:hover{opacity:1!important;background:#f5ece5!important}
    .emoticon-picker{position:absolute;z-index:50;left:4px;right:4px;bottom:62px;background:rgba(255,250,245,.98);border:1px solid #e5d9cf;border-radius:18px;padding:2px;box-shadow:0 8px 28px rgba(65,48,35,.18);display:grid;grid-template-columns:repeat(4,1fr);gap:0;max-height:400px;overflow:visible}
    .emoticon-picker.hidden{display:none}.emoticon-item{border:0;background:transparent!important;border-radius:0!important;padding:0!important;aspect-ratio:1;cursor:pointer;box-shadow:none!important;display:flex;align-items:center;justify-content:center;overflow:visible}.emoticon-item:hover,.emoticon-item:active{background:transparent!important;transform:scale(1.03)}.emoticon-item img{width:100%;height:100%;object-fit:contain;display:block;transform:scale(1.34);transform-origin:center;pointer-events:none}
    .emoticon-img{display:block!important;width:150px!important;height:150px!important;max-width:150px!important;max-height:150px!important;object-fit:contain!important;border-radius:0!important}.emoticon-message .bubble{padding:5px;background:transparent!important;border-color:transparent!important;box-shadow:none!important}.emoticon-message .msg-meta{padding-right:4px}.inputbar{position:relative}
  `;
  document.head.appendChild(style);

  const EMOTICONS=[['01.png','ㅋㅋㅋㅋ'],['02.png','미안해'],['03.png','고마워'],['04.png','흥!'],['05.png','힘내'],['06.png','잘자'],['07.png','보고싶어...'],['08.png','사랑해'],['09.png','화이팅!'],['10.png','안녕?'],['11.png','배고파'],['12.png','한잔할래?']];
  const emoticonById=new Map();

  function renderEmoticon(id,file){
    if(!id||!file)return;const row=root.querySelector('.row[data-id="'+CSS.escape(id)+'"]');if(!row)return;const bubble=row.querySelector('.bubble');if(!bubble)return;const existing=bubble.querySelector('.emoticon-img');const meta=bubble.querySelector('.msg-meta');if(existing){existing.src='./emoticons/'+file;return} [...bubble.childNodes].forEach(n=>{if(n!==meta&&!n.classList?.contains('delete-btn')&&!n.classList?.contains('edit-btn'))n.remove()});const img=document.createElement('img');img.className='emoticon-img';img.src='./emoticons/'+file;img.alt=EMOTICONS.find(x=>x[0]===file)?.[1]||'이모티콘';img.loading='lazy';bubble.insertBefore(img,meta||null);row.classList.add('emoticon-message')
  }
  function renderKnownEmoticons(){emoticonById.forEach((file,id)=>renderEmoticon(id,file))}

  function setupEmoticonPicker(){
    const form=document.querySelector('#form');
    const attach=document.querySelector('#attach');
    if(!form||!attach||document.querySelector('#emoticonBtn'))return;
    if(getComputedStyle(form).position==='static')form.style.position='relative';
    const btn=document.createElement('button');btn.id='emoticonBtn';btn.type='button';btn.className='emoticon-btn';btn.textContent='😊';btn.title='이모티콘';btn.setAttribute('aria-label','이모티콘');
    form.append(btn);
    const picker=document.createElement('div');picker.id='emoticonPicker';picker.className='emoticon-picker hidden';
    EMOTICONS.forEach(([file,label])=>{const item=document.createElement('button');item.type='button';item.className='emoticon-item';item.title=label;item.setAttribute('aria-label',label);const img=document.createElement('img');img.src='./emoticons/'+file;img.alt=label;img.loading='lazy';item.append(img);item.onclick=()=>{if(typeof socket==='undefined'||!socket||socket.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'message',name:me,text:'',image:'',emoticon:file}));picker.classList.add('hidden')};picker.append(item)});
    form.append(picker);

    const field=form.querySelector('input,textarea');
    function placeButton(){
      if(!field)return;
      const formRect=form.getBoundingClientRect(),fieldRect=field.getBoundingClientRect();
      btn.style.left=(fieldRect.right-formRect.left-46)+'px';
      btn.style.top=(fieldRect.top-formRect.top+(fieldRect.height-36)/2)+'px';
    }
    placeButton();
    window.addEventListener('resize',placeButton);
    if(window.ResizeObserver)new ResizeObserver(placeButton).observe(form);
    btn.onclick=e=>{e.stopPropagation();picker.classList.toggle('hidden')};
    document.addEventListener('click',e=>{if(!picker.contains(e.target)&&e.target!==btn)picker.classList.add('hidden')});
  }
  setupEmoticonPicker();

  function getRow(id){return root.querySelector('.row[data-id="'+CSS.escape(id)+'"]')}
  function getEditText(bubble){const clone=bubble.cloneNode(true);clone.querySelectorAll('img,.msg-meta,.delete-btn,.edit-btn').forEach(e=>e.remove());return clone.textContent.trim()}
  function markEdited(id,text){const row=getRow(id);if(!row)return;const bubble=row.querySelector('.bubble');if(!bubble)return;const meta=bubble.querySelector('.msg-meta');const buttons=[...bubble.querySelectorAll('.delete-btn,.edit-btn')];[...bubble.childNodes].forEach(n=>{if(n!==meta&&!buttons.includes(n)&&n.nodeName!=='IMG')n.remove()});if(text){const frag=typeof linkify==='function'?linkify(text):document.createTextNode(text);bubble.insertBefore(frag,meta||null)}if(meta){meta.querySelector('.edited-mark')?.remove();const mark=document.createElement('span');mark.className='edited-mark';mark.textContent='(수정됨)';meta.append(mark)}}
  function addEditButtons(){root.querySelectorAll('.me .bubble').forEach(bubble=>{if(bubble.querySelector('img')||bubble.querySelector('.edit-btn'))return;const del=bubble.querySelector('.delete-btn');if(!del)return;const btn=document.createElement('button');btn.className='edit-btn';btn.type='button';btn.textContent='수정';btn.addEventListener('click',()=>{const row=bubble.closest('.row');if(!row||typeof socket==='undefined'||socket?.readyState!==WebSocket.OPEN)return;const oldText=getEditText(bubble);const next=prompt('메시지를 수정하세요.',oldText);if(next===null)return;const value=next.trim();if(!value||value===oldText)return;socket.send(JSON.stringify({type:'edit',messageId:row.dataset.id,name:me,text:value}))});bubble.append(btn)})}
  const observer=new MutationObserver(()=>{addEditButtons();renderKnownEmoticons()});observer.observe(root,{childList:true,subtree:true});addEditButtons();

  let hookedSocket=null;function hookSocket(){if(typeof socket==='undefined'||!socket||socket===hookedSocket)return;hookedSocket=socket;socket.addEventListener('message',e=>{try{const x=JSON.parse(e.data);if(x.type==='message'&&x.message?.emoticon){emoticonById.set(x.message.id,String(x.message.emoticon));setTimeout(()=>renderEmoticon(x.message.id,String(x.message.emoticon)),0)}if(x.type==='history'&&Array.isArray(x.messages)){x.messages.forEach(m=>{if(m.emoticon)emoticonById.set(m.id,String(m.emoticon))});setTimeout(()=>{renderKnownEmoticons();x.messages.forEach(m=>{if(m.editedAt)markEdited(m.id,String(m.text||''))})},0)}if(x.type==='edit'&&x.message){markEdited(x.message.id,String(x.message.text||''))}}catch(_){}})}setInterval(hookSocket,250);hookSocket();
})();
