(function () {
'use strict';
const Core=createChessCore(), AI=createChessAI(Core);
const {Chess,START,P,N,B,R,Q,K,EP,CK,CQ,coord,index,color}=Core;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const icon=(name,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const NAME={1:'Tốt',2:'Mã',3:'Tượng',4:'Xe',5:'Hậu',6:'Vua'}, SLUG={1:'pawn',2:'knight',3:'bishop',4:'rook',5:'queen',6:'king'};
const LABEL={easy:'Dễ',normal:'Trung bình',hard:'Khó'};
const DESC={easy:'Làm quen bàn cờ. Đối thủ chơi thoáng và đôi khi bỏ lỡ chiến thuật.',normal:'Cân bằng tấn công, phòng thủ và kiểm soát bàn cờ.',hard:'Tìm kiếm sâu hơn, tính chuỗi bắt quân và ưu tiên an toàn cho Vua.'};
const STORE='chess-beyond.neon.v1', VERSION=1;
const boardEl=$('#board'),arenaEl=$('#arena'), spaceEl=$('#arenaSpace');
let settings={level:'normal',human:1,vfx:!matchMedia('(prefers-reduced-motion: reduce)').matches};
let game=new Chess(),orientation=1,selected=-1,selectionMoves=[],hint=null,legal=[],ended=null;
let busy=null,animating=false,epoch=0,activeTask=null,aiTimer=0,animationStop=null,toastTimer=0;
let modalType='',modalClose=null,previousFocus=null,newLevel='normal',newSide=1;
let elapsed=0,hintsUsed=0,created=new Date().toISOString(),lastTick=performance.now(),saveOK=true,storageNotice='',focusSquare=index('e2');
let hintReportedFallback=false;
const pieceSrc=p=>ASSETS[(color(p)===settings.human?'blue':'purple')+'-'+SLUG[Math.abs(p)]];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rootState=()=>({initial:game.initial,moves:game.history.map(m=>({from:m.from,to:m.to,promo:m.promo}))});
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3300);}
function save(){try{localStorage.setItem(STORE,JSON.stringify({version:VERSION,...rootState(),settings,orientation,ended,elapsed,hintsUsed,created}));saveOK=true;}catch(e){saveOK=false;}renderSave();}
function renderSave(){const el=$('#saveNote');el.textContent=saveOK?'Tự động lưu trên thiết bị':'Bộ nhớ bị chặn · ván này chưa được lưu';el.classList.toggle('warn',!saveOK);}
function restore(){
  let raw;try{raw=localStorage.getItem(STORE);}catch(e){saveOK=false;return;}
  try {if(!raw)return;const data=JSON.parse(raw);if(data.version!==VERSION||!Array.isArray(data.moves)||data.moves.length>2500)throw Error('Dữ liệu lưu không hợp lệ.');
    const s=data.settings||{};settings={level:LABEL[s.level]?s.level:'normal',human:s.human===-1?-1:1,vfx:typeof s.vfx==='boolean'?s.vfx:settings.vfx};
    const candidate=new Chess(data.initial||START);for(const m of data.moves)candidate.play(m);game=candidate;
    orientation=data.orientation===-1?-1:1;elapsed=Number.isFinite(data.elapsed)?Math.max(0,Math.min(data.elapsed,31536000000)):0;hintsUsed=Number.isInteger(data.hintsUsed)?Math.max(0,data.hintsUsed):0;
    created=typeof data.created==='string'?data.created:new Date().toISOString();
    if(data.ended&&['resign','threefold','fifty','agreement'].includes(data.ended.type)&&[1,-1,0].includes(data.ended.winner))ended={type:data.ended.type,winner:data.ended.winner};
    ended=ended||game.terminal();if(game.history.length)storageNotice='Đã khôi phục ván cờ gần nhất.';
  }catch(e){game=new Chess();ended=null;orientation=settings.human;storageNotice='Không đọc được ván lưu cũ. Một ván mới đã được tạo.';}
}
function displayIndex(s){let r=s>>4,f=s&7;return orientation===1?{r,f}:{r:7-r,f:7-f};}
function squareAt(r,f){return orientation===1?r*16+f:(7-r)*16+(7-f);}
function cellFor(s){return boardEl.querySelector(`[data-square="${s}"]`);}
function boardSize(){const rect=spaceEl.getBoundingClientRect();const size=Math.max(100,Math.floor(Math.min(rect.width,rect.height-4)));arenaEl.style.setProperty('--arena-size',size+'px');}
function updateLegal(){legal=game.moves();}
function renderBoard(hidden=[]){
  const last=game.history.at(-1),check=game.inCheck(), hide=new Set(hidden);const frag=document.createDocumentFragment();
  for(let r=0;r<8;r++)for(let f=0;f<8;f++){
    const s=squareAt(r,f),p=game.board[s],dark=((s>>4)+(s&7))%2===1;
    const cell=document.createElement('button');cell.className='cell '+(dark?'dark':'light');cell.dataset.square=s;cell.tabIndex=s===focusSquare?0:-1;cell.setAttribute('role','gridcell');cell.setAttribute('aria-selected',s===selected?'true':'false');
    let label=`${coord(s)}${p?', '+NAME[Math.abs(p)]+(color(p)===settings.human?' phe Lam':' phe Tím'):', ô trống'}`;
    const candidate=selectionMoves.find(m=>m.to===s);if(candidate){cell.classList.add(candidate.capture?'capture':'legal');label+=candidate.capture?', có thể bắt quân':', có thể di chuyển';}
    if(s===selected)cell.classList.add('selected');if(last?.from===s)cell.classList.add('last-from');if(last?.to===s)cell.classList.add('last-to');if(check&&s===game.kings[game.turn])cell.classList.add('check');
    if(hint?.from===s)cell.classList.add('hint-from');if(hint?.to===s)cell.classList.add('hint-to');cell.setAttribute('aria-label',label);
    const tile=document.createElement('span');tile.className='tile-skin';tile.style.setProperty('--tile',`url("${ASSETS['tile-'+(dark?'dark':'light')+'-'+(((s>>4)*3+(s&7)*7)%3)]}")`);tile.style.setProperty('--rotate',(((s>>4)+(s&7)*3)%4)*90+'deg');cell.append(tile);
    if(p){const img=document.createElement('img');img.className='piece';img.src=pieceSrc(p);img.alt='';img.draggable=false;img.style.zIndex=String(r*3+5);if(hide.has(s))img.style.visibility='hidden';cell.append(img);}
    frag.append(cell);
  }
  boardEl.replaceChildren(frag);
  $('#fileLabels').innerHTML=Array.from({length:8},(_,f)=>`<span>${coord(squareAt(7,f))[0].toUpperCase()}</span>`).join('');
  $('#rankLabels').innerHTML=Array.from({length:8},(_,r)=>`<span>${coord(squareAt(r,0))[1]}</span>`).join('');
  arenaEl.style.setProperty('--top-glow',orientation===settings.human?'#f641ef':'#41b4ff');arenaEl.style.setProperty('--bottom-glow',orientation===settings.human?'#41b4ff':'#f641ef');
  if(hint){const a=displayIndex(hint.from),b=displayIndex(hint.to);const x1=a.f*100+50,y1=a.r*100+64,x2=b.f*100+50,y2=b.r*100+64;
    boardEl.insertAdjacentHTML('beforeend',`<svg class="hint-arrows" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="hintHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#ffdc91"/></marker></defs><path d="M${x1} ${y1} L${x2} ${y2}" stroke="#141222" stroke-width="12" opacity=".3"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="#ffdc91" stroke-width="7" opacity=".86" stroke-linecap="round" marker-end="url(#hintHead)"/><circle cx="${x1}" cy="${y1}" r="8" fill="#ffdc91"/></svg>`);
  }
}
function renderHistory(){
  const list=$('#historyList'),hist=game.history;$('#plyCount').textContent=String(hist.length).padStart(2,'0')+' NƯỚC';
  if(!hist.length){list.innerHTML=`<div class="history-empty">${icon('list')}<span>Chưa có nước đi.<br>Viết nên chiến thuật của bạn.</span></div>`;return;}
  let num=+game.initial.split(' ')[5],side=game.initial.split(' ')[1]==='w'?1:-1,rows=[],current={num,w:null,b:null};
  hist.forEach((m,i)=>{if(side===1&&current.b){rows.push(current);current={num,w:null,b:null};}current[side===1?'w':'b']={m,i};if(side===-1){num++;}side=-side;});rows.push(current);
  list.innerHTML=rows.map(row=>`<div class="move-row"><span class="number">${row.num}.</span>${['w','b'].map(c=>{const v=row[c];return `<span class="san ${v?.i===hist.length-1?'latest ':''}${v&&v.m.color!==settings.human?'enemy':''}" title="${v?NAME[Math.abs(v.m.piece)]+' '+coord(v.m.from)+' → '+coord(v.m.to):''}">${v?escapeText(v.m.san):'—'}</span>`;}).join('')}</div>`).join('');
  $('#historyScroll').scrollTop=$('#historyScroll').scrollHeight;
}
function capturedMarkup(by){const captures=game.history.filter(m=>m.color===by&&m.capture).map(m=>m.capture);const value={1:1,2:3,3:3,4:5,5:9,6:0};let white=0,black=0;for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=game.board[s];if(p>0)white+=value[p];if(p<0)black+=value[-p];}const advantage=by===1?white-black:black-white;
 return captures.length?captures.map(p=>`<img src="${pieceSrc(p)}" alt="${NAME[Math.abs(p)]}" title="Đã bắt ${NAME[Math.abs(p)]}">`).join('')+(advantage>0?`<span class="advantage">+${advantage}</span>`:''):`<span class="empty">Chưa bắt quân${advantage>0?' · +'+advantage:''}</span>`;
}
function reasonText(type){return ({mate:'Vua đối phương không còn nước đi thoát chiếu.',stalemate:'Bên đến lượt không bị chiếu nhưng không còn nước đi hợp lệ.',material:'Không đủ lực lượng để tạo thế chiếu hết.',fivefold:'Cùng một thế cờ đã xuất hiện năm lần.',seventyfive:'75 nước mỗi bên không di chuyển Tốt và không bắt quân.',threefold:'Yêu cầu hòa do lặp lại cùng thế cờ ba lần.',fifty:'Yêu cầu hòa theo quy tắc 50 nước.',resign:'Ván cờ kết thúc bằng đầu hàng.',agreement:'Hai bên đồng ý hòa.'})[type]||'Ván cờ đã kết thúc.';}
function statusTitle(){if(!ended)return'';if(ended.winner===0)return'Ván cờ hòa.';return ended.winner===settings.human?'Bạn đã chiến thắng!':'Violet Legion chiến thắng.';}
function renderCoach(){
 let main,detail,meta;
 if(ended){main=statusTitle();detail=reasonText(ended.type);meta='KẾT THÚC · CÓ THỂ XEM LẠI HOẶC TẠO VÁN MỚI';}
 else if(animating){const m=game.history.at(-1);main=m.capture?`${NAME[Math.abs(m.piece)]} tấn công!`:`${NAME[Math.abs(m.piece)]} · ${coord(m.from)} → ${coord(m.to)}`;detail=m.capture?`Bắt ${NAME[Math.abs(m.capture)]}${m.flag&EP?' qua đường':''}. Hiệu ứng không làm thay đổi luật cờ.`:'Đang hoàn tất nước đi trên chiến trường.';meta='NEON BATTLEFIELD · '+m.san;}
 else if(busy==='hint'){main='Đang tìm nước đi gợi ý…';detail='Phân tích nước hợp lệ, phản công và an toàn của Vua.';meta='TRỢ LÝ CHIẾN THUẬT ĐANG TÍNH';}
 else if(busy==='ai'||game.turn!==settings.human){main='Violet Legion đang suy nghĩ…';detail=DESC[settings.level];meta='AI · '+LABEL[settings.level].toUpperCase();}
 else if(hint){main=`${NAME[Math.abs(game.board[hint.from])]} ${coord(hint.from)} → ${coord(hint.to)}${hint.promo?' = '+NAME[hint.promo]:''}`;detail=hint.explanation;meta=`GỢI Ý · SÂU ${hint.depth} · ${hint.nodes.toLocaleString('vi-VN')} NÚT`;}
 else if(selected>=0){const p=game.board[selected],targets=new Set(selectionMoves.map(m=>m.to));main=`${NAME[Math.abs(p)]} tại ${coord(selected)} · ${targets.size} ô hợp lệ`;detail=targets.size?'Chạm một ô sáng để di chuyển. Khung hồng là ô có thể bắt quân.':'Quân này chưa có nước đi hợp lệ. Chọn một quân khác để tiếp tục.';meta=game.inCheck()?'ĐANG BỊ CHIẾU · CHỈ HIỂN THỊ NƯỚC CỨU VUA':'Ô XANH: DI CHUYỂN · KHUNG HỒNG: BẮT QUÂN';}
 else if(game.inCheck()){main='Vua của bạn đang bị chiếu!';detail='Di chuyển Vua, chặn đường chiếu hoặc bắt quân đang chiếu. Các ô gợi ý đã lọc nước đi an toàn.';meta='CẢNH BÁO · BẮT BUỘC HÓA GIẢI CHIẾU';}
 else{main=game.history.length?'Đến lượt bạn.':'Nước đi đầu tiên là của bạn.';detail='Chọn một quân cờ. Những ô sáng là vị trí quân đó có thể di chuyển hợp lệ.';meta='SẴN SÀNG · KHÔNG GIỚI HẠN GỢI Ý';}
 $('#coachMain').textContent=main;$('#coachDetail').textContent=detail;$('#coachMeta').textContent=meta;$('#mobileNote').textContent=main;$('#mobileNote').classList.toggle('check-note',game.inCheck()&&!ended);
}
function renderStatus(){
 const yours=game.turn===settings.human,locked=Boolean(ended||animating||busy);$('#enemyBar').classList.toggle('active',!yours&&!ended);$('#humanBar').classList.toggle('active',yours&&!ended);
 $('#enemySub').textContent='AI · '+LABEL[settings.level].toUpperCase();$('#humanSub').textContent='AZURE ORDER · '+(settings.human===1?'TRẮNG':'ĐEN');
 $('#enemyTurn').innerHTML=ended?'KẾT THÚC':(!yours?(busy==='ai'?'<span class="thinking-dots"><i></i><i></i><i></i></span> ĐANG TÍNH':(game.inCheck()?'BỊ CHIẾU':'ĐẾN LƯỢT')):'ĐỐI THỦ');
 $('#humanTurn').textContent=ended?(ended.winner===settings.human?'CHIẾN THẮNG':ended.winner===0?'HÒA':'KẾT THÚC'):yours?(game.inCheck()?'ĐANG BỊ CHIẾU':'LƯỢT CỦA BẠN'):'CHỜ ĐỐI THỦ';
 $('#humanCaptured').innerHTML=capturedMarkup(settings.human);$('#enemyCaptured').innerHTML=capturedMarkup(-settings.human);
 $('#hintBtn').disabled=locked||!yours;$('#hintBtn').querySelector('span').textContent=busy==='hint'?'Đang tính…':'Gợi ý nước đi';
 $('#undoBtn').disabled=!game.history.some(m=>m.color===settings.human);$('#flipBtn').disabled=animating;
 $('#fxBtn').classList.toggle('active',settings.vfx);$('#fxBtn').setAttribute('aria-pressed',String(settings.vfx));$('#fxBtn').title=settings.vfx?'Tắt hiệu ứng tấn công':'Bật hiệu ứng tấn công';
 $('#resignBtn').disabled=Boolean(ended);$('#drawBtn').disabled=locked||!yours;
 $$('#levelTabs [data-level]').forEach(b=>{b.classList.toggle('active',b.dataset.level===settings.level);b.setAttribute('aria-pressed',String(b.dataset.level===settings.level));});
 $('#levelDesc').textContent=DESC[settings.level];const bars=settings.level==='easy'?1:settings.level==='normal'?2:3;$('#difficultyTag').innerHTML=[0,1,2].map(i=>`<i class="${i>=bars?'off':''}"></i>`).join('')+'&nbsp; '+LABEL[settings.level].toUpperCase()+' · TACTICAL AI';
 $('#roundTag').textContent='ROUND '+String(game.full).padStart(2,'0')+' · SOLO';renderCoach();renderSave();
}
function renderAll(){updateLegal();renderBoard();renderHistory();renderStatus();}
function clearSelection(){selected=-1;selectionMoves=[];hint=null;}
function selectSquare(s){hint=null;selected=s;focusSquare=s;selectionMoves=legal.filter(m=>m.from===s);renderBoard();renderStatus();}
function handleCell(s){
 if(ended){toast('Ván cờ đã kết thúc. Chọn Ván mới hoặc Đi lại.');return;}
 if(animating||busy){if(busy==='ai')toast('Đối thủ đang tính nước đi.');return;}
 if(game.turn!==settings.human)return;
 if(s===selected){clearSelection();renderBoard();renderStatus();return;}
 const candidates=selectionMoves.filter(m=>m.to===s);
 if(candidates.length){if(candidates[0].promo){showPromotion(candidates);return;}performMove(candidates[0]);return;}
 if(color(game.board[s])===settings.human){selectSquare(s);return;}
 clearSelection();renderBoard();renderStatus();
}
boardEl.addEventListener('click',e=>{const cell=e.target.closest('[data-square]');if(cell)handleCell(+cell.dataset.square);});
boardEl.addEventListener('keydown',e=>{const cell=e.target.closest('[data-square]');if(!cell)return;const dir={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];if(!dir)return;e.preventDefault();const pos=displayIndex(+cell.dataset.square),r=Math.max(0,Math.min(7,pos.r+dir[0])),f=Math.max(0,Math.min(7,pos.f+dir[1]));focusSquare=squareAt(r,f);for(const c of boardEl.querySelectorAll('[data-square]'))c.tabIndex=+c.dataset.square===focusSquare?0:-1;cellFor(focusSquare)?.focus();});
boardEl.addEventListener('contextmenu',e=>e.preventDefault());boardEl.addEventListener('dragstart',e=>e.preventDefault());
function clearAsync(){epoch++;clearTimeout(aiTimer);aiTimer=0;if(activeTask){activeTask.finish(null);activeTask=null;}if(animationStop){animationStop();animationStop=null;}busy=null;animating=false;arenaEl.classList.remove('shake');}
function compute(kind){
 const snapshot=rootState(),token=epoch;
 return new Promise(resolve=>{
  let finished=false,worker=null,url=null,watchdog=0;
  const finish=result=>{if(finished)return;finished=true;clearTimeout(watchdog);if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);if(activeTask?.finish===finish)activeTask=null;resolve(result);};
  const fallback=()=>{if(finished)return;if(worker){worker.terminate();worker=null;}if(url){URL.revokeObjectURL(url);url=null;}
    if(!hintReportedFallback){hintReportedFallback=true;toast('AI đang dùng chế độ tương thích của trình duyệt.');}
    setTimeout(()=>{if(finished||token!==epoch){finish(null);return;}try{const g=new Chess(snapshot.initial);snapshot.moves.forEach(m=>g.play(m));finish(AI.choose(g,kind==='hint'?'hint':settings.level,{time:140,depth:2,qdepth:2}));}catch(e){finish({error:e.message});}},30);
  };
  activeTask={finish};
  try{
   const source=`'use strict';const Core=(${createChessCore.toString()})();const AI=(${createChessAI.toString()})(Core);self.onmessage=function(e){try{const d=e.data,g=new Core.Chess(d.initial);for(const m of d.moves)g.play(m);self.postMessage(AI.choose(g,d.level));}catch(error){self.postMessage({error:String(error.message||error)});}};`;
   url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>{if(e.data?.error)fallback();else finish(e.data);};worker.onerror=e=>{e.preventDefault();fallback();};worker.postMessage({...snapshot,level:kind==='hint'?'hint':settings.level});
   watchdog=setTimeout(fallback,(kind==='hint'?1500:AI.LEVELS[settings.level].time)+4000);
  }catch(e){fallback();}
 });
}
function scheduleAI(delay=200){clearTimeout(aiTimer);if(ended||game.turn===settings.human||animating)return;aiTimer=setTimeout(runAI,delay);}
async function runAI(){
 if(ended||game.turn===settings.human||animating||busy)return;
 const claim=game.claimable();if(claim){finishGame({type:claim,winner:0});return;}
 const proposed=game.claimMoves();if(proposed.length){finishGame({type:proposed[0].reason,winner:0});return;}
 busy='ai';renderStatus();const token=epoch,fen=game.fen();const started=performance.now();let result=await compute('ai');if(epoch!==token||fen!==game.fen())return;
 if(performance.now()-started<280)await sleep(280-(performance.now()-started));if(epoch!==token||fen!==game.fen())return;
 busy=null;
 if(!result?.move){if(result?.error)toast('AI gặp lỗi phân tích; dùng một nước đi hợp lệ dự phòng.');const m=game.moves()[0];if(m)await performMove(m);else{ended=game.terminal();renderAll();if(ended)showResult();}return;}
 try{await performMove(result.move);}catch(e){renderStatus();toast('Không thể thực hiện nước AI. Bạn có thể Đi lại hoặc tạo Ván mới.');}
}
function hintExplanation(m){
 const clone=new Chess(game.fen());clone.play(m);const terminal=clone.terminal();if(terminal?.type==='mate')return 'Nước này chiếu hết. Chạm ô được đánh dấu để kết thúc ván cờ.';
 if(game.inCheck())return 'Nước đi hợp lệ này hóa giải thế chiếu. Hãy quan sát cả quân tấn công lẫn các ô Vua có thể đến.';
 if(m.promo)return `Đưa Tốt đến hàng cuối và phong thành ${NAME[m.promo]}. Bạn vẫn được tự chọn quân ở hộp phong cấp.`;
 if(m.flag&(CK|CQ))return 'Nhập thành: Vua và Xe cùng di chuyển trong một nước đi hợp lệ.';
 if(m.capture)return `Bắt ${NAME[Math.abs(m.capture)]} ${m.flag&EP?'qua đường':`tại ${coord(m.to)}`}${clone.inCheck()?', đồng thời chiếu Vua đối thủ':''}. Gợi ý dựa trên tìm kiếm có giới hạn, không bảo đảm là nước tối ưu tuyệt đối.`;
 if(clone.inCheck())return 'Tạo thế chiếu, buộc đối thủ phải bảo vệ Vua ở lượt tiếp theo.';
 const t=Math.abs(m.piece);return ({1:'Tiến Tốt và tạo thêm không gian hoạt động. Xem kỹ các ô chéo trước khi tiếp tục.',2:'Phát triển Mã và tăng kiểm soát khu vực xung quanh ô đến.',3:'Mở thêm đường chéo cho Tượng và phối hợp với các quân khác.',4:'Đưa Xe vào một vị trí hoạt động tốt hơn trên hàng hoặc cột.',5:'Điều chỉnh vị trí Hậu để tạo sức ép và phối hợp lực lượng.',6:'Điều chỉnh vị trí Vua trong một nước đi an toàn, hợp lệ.'})[t];
}
async function requestHint(){
 if(ended||animating||busy||game.turn!==settings.human)return;
 busy='hint';renderStatus();const token=epoch,fen=game.fen();const result=await compute('hint');if(token!==epoch||fen!==game.fen())return;busy=null;
 if(!result?.move){renderStatus();toast('Chưa tìm được gợi ý. Hãy thử lại.');return;}
 const m=game.moves().find(m=>m.from===index(result.move.from)&&m.to===index(result.move.to)&&m.promo===(result.move.promo||0));if(!m){renderStatus();return;}
 hintsUsed++;selected=m.from;selectionMoves=legal.filter(x=>x.from===selected);hint={...m,...result,from:m.from,to:m.to,promo:m.promo,explanation:hintExplanation(m)};renderBoard();renderStatus();save();
}
function spriteBox(s){const b=boardEl.getBoundingClientRect(),c=cellFor(s).getBoundingClientRect(),w=c.width*.92,h=w*416/256;return {x:c.left-b.left+(c.width-w)/2,y:c.bottom-b.top-c.height*.07-h,w,h,cw:c.width,cx:c.left-b.left+c.width/2,cy:c.top-b.top+c.height*.76};}
function animateMove(m,token){
 if(!settings.vfx||matchMedia('(prefers-reduced-motion: reduce)').matches)return sleep(30);
 return new Promise(resolve=>{
  const start=spriteBox(m.from),end=spriteBox(m.to),captureSquare=m.flag&EP?m.to+color(m.piece)*16:m.to,hit=spriteBox(captureSquare),type=Math.abs(m.piece),isCapture=!!m.capture,duration=isCapture?(type===Q?740:620):310;
  const team=color(m.piece)===settings.human,primary=team?'#56d6ff':'#ff50ed',secondary=team?'#ff77d5':'#b981ff';
  let fly=document.createElement('img');fly.className='flyer';fly.src=pieceSrc(m.piece);fly.alt='';fly.style.cssText=`left:${start.x}px;top:${start.y}px;width:${start.w}px;height:${start.h}px`;boardEl.append(fly);
  let ghost=null;if(isCapture){ghost=document.createElement('img');ghost.className='capture-ghost';ghost.src=pieceSrc(m.capture);ghost.alt='';ghost.style.cssText=`left:${hit.x}px;top:${hit.y}px;width:${hit.w}px;height:${hit.h}px`;boardEl.append(ghost);}
  let rook=null,rs,re;if(m.flag&(CK|CQ)){rs=spriteBox(m.from+(m.flag&CK?3:-4));re=spriteBox(m.from+(m.flag&CK?1:-1));rook=document.createElement('img');rook.src=pieceSrc(color(m.piece)*R);rook.className='flyer';rook.alt='';rook.style.cssText=`left:${rs.x}px;top:${rs.y}px;width:${rs.w}px;height:${rs.h}px`;boardEl.append(rook);}
  const canvas=document.createElement('canvas');canvas.className='fx-canvas';canvas.setAttribute('aria-hidden','true');const width=boardEl.clientWidth,height=boardEl.clientHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);boardEl.append(canvas);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const parts=Array.from({length:isCapture?32:12},(_,i)=>({a:Math.random()*Math.PI*2,s:(.25+Math.random()*.8)*start.cw,size:1.2+Math.random()*2.5,spin:Math.random()*8}));
  let raf=0,done=false,begin=performance.now(),shaken=false;
  function cleanup(){if(done)return;done=true;cancelAnimationFrame(raf);fly.remove();ghost?.remove();rook?.remove();canvas.remove();arenaEl.classList.remove('shake');if(animationStop===cleanup)animationStop=null;resolve();}
  animationStop=cleanup;
  function frame(now){if(token!==epoch){cleanup();return;}const t=Math.min(1,(now-begin)/duration),travel=Math.min(1,t/(isCapture?.75:1)),ease=1-Math.pow(1-travel,3);let dx=(end.x-start.x)*ease,dy=(end.y-start.y)*ease;if(type===N)dy-=Math.sin(travel*Math.PI)*start.cw*.48;
   fly.style.transform=`translate(${dx}px,${dy}px)`;if(rook){rook.style.transform=`translate(${(re.x-rs.x)*ease}px,${(re.y-rs.y)*ease}px)`;}
   ctx.clearRect(0,0,width,height);ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
   const spark=Math.max(0,(t-.38)/.62),fade=1-spark;
   if(isCapture&&t>.13){const power=Math.sin(Math.min(1,(t-.13)/.87)*Math.PI),sx=start.cx,sy=start.cy-start.cw*.2,tx=hit.cx,ty=hit.cy-hit.cw*.22;
    ctx.globalAlpha=power*.85;ctx.strokeStyle=primary;ctx.shadowColor=primary;ctx.shadowBlur=15;ctx.lineWidth=type===R?7:3;
    if(type===R||type===B||type===P){ctx.beginPath();ctx.moveTo(sx,sy);if(type===B){const mx=(sx+tx)/2,my=(sy+ty)/2;ctx.quadraticCurveTo(mx+start.cw*.3,my-start.cw*.2,tx,ty);}else ctx.lineTo(tx,ty);ctx.stroke();ctx.lineWidth=1.3;ctx.strokeStyle='#ffffff';ctx.stroke();}
    else if(type===N){ctx.beginPath();ctx.arc(tx,ty,start.cw*(.24+spark*.35),Math.PI*.85,Math.PI*2.4);ctx.lineWidth=5;ctx.stroke();}
    else{ctx.beginPath();const points=type===Q?6:4;for(let i=0;i<=points*2;i++){const a=i*Math.PI/points+t*2,rr=start.cw*(i%2?.21:.39);const x=tx+Math.cos(a)*rr,y=ty+Math.sin(a)*rr;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
   }
   if(spark>0){if(ghost){ghost.style.opacity=String(Math.max(0,1-spark*2.6));ghost.style.transform=`translateY(${-spark*start.cw*.22}px) scale(${1+spark*.3}) rotate(${spark*10}deg)`;ghost.style.filter=`brightness(${1+spark*4})`;}
    const hx=isCapture?hit.cx:end.cx,hy=isCapture?hit.cy:end.cy;
    if(isCapture&&!shaken&&settings.vfx){shaken=true;arenaEl.classList.add('shake');}
    ctx.globalAlpha=fade;ctx.shadowColor=primary;ctx.shadowBlur=9;ctx.strokeStyle=primary;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(hx,hy,start.cw*(.12+spark*.8),start.cw*(.07+spark*.45),0,0,Math.PI*2);ctx.stroke();
    if(isCapture){ctx.strokeStyle=secondary;ctx.globalAlpha=fade*.6;ctx.beginPath();ctx.ellipse(hx,hy,start.cw*(.1+spark*.55),start.cw*(.1+spark*.55),0,0,Math.PI*2);ctx.stroke();}
    for(const p of parts){const dist=p.s*spark*(isCapture?1.5:.6),x=hx+Math.cos(p.a)*dist,y=hy+Math.sin(p.a)*dist-spark*start.cw*.18;ctx.globalAlpha=fade;ctx.fillStyle=p.size>2?primary:secondary;ctx.save();ctx.translate(x,y);ctx.rotate(p.spin+spark*4);ctx.fillRect(-p.size/2,-p.size/2,p.size*1.7,p.size*1.7);ctx.restore();}
   }
   ctx.restore();if(t<1)raf=requestAnimationFrame(frame);else cleanup();
  }raf=requestAnimationFrame(frame);
 });
}
async function performMove(spec){
 if(ended||animating)return;let m;try{m=game.play(spec);}catch(e){toast('Nước đi không hợp lệ.');renderAll();return;}
 clearSelection();animating=true;const token=epoch;ended=game.terminal();updateLegal();let hidden=[m.to];if(m.flag&CK)hidden.push(m.from+1);if(m.flag&CQ)hidden.push(m.from-1);renderBoard(settings.vfx?hidden:[]);renderHistory();renderStatus();save();
 try{await animateMove(m,token);}catch(e){console.warn('Animation:',e);boardEl.querySelectorAll('.flyer,.capture-ghost,.fx-canvas').forEach(x=>x.remove());}
 if(token!==epoch)return;animating=false;animationStop=null;renderAll();save();if(ended){showResult();}else scheduleAI();
}
function finishGame(result){clearAsync();ended=result;clearSelection();renderAll();save();showResult();}
function undoTurn(){
 if(!game.history.some(m=>m.color===settings.human))return;closeModal();clearAsync();ended=null;clearSelection();let count=0;
 do{if(!game.undo())break;count++;}while(game.history.length&&game.turn!==settings.human);
 ended=game.terminal();renderAll();save();toast(`Đã đi lại ${count} nước, trở về lượt của bạn.`);scheduleAI();
}
function changeLevel(level){if(!LABEL[level]||level===settings.level)return;settings.level=level;
 if(busy){clearAsync();clearSelection();renderAll();scheduleAI(100);}else renderStatus();save();toast('Độ khó: '+LABEL[level]+'. Áp dụng từ lượt AI tiếp theo.');}
function flip(){if(animating)return;orientation=-orientation;renderBoard();save();}
function toggleFX(){settings.vfx=!settings.vfx;renderStatus();save();toast(settings.vfx?'Đã bật hiệu ứng tấn công.':'Đã tắt hiệu ứng tấn công.');}
function drawer(open){$('#sidePanel').classList.toggle('open',open);$('#drawerShade').classList.toggle('open',open);}
function showModal(type,html,onClose=null){
 if(modalType)closeModal(false);previousFocus=document.activeElement;modalType=type;modalClose=onClose;$('#dialog').innerHTML=html;$('#modalOverlay').classList.add('open');$('.app').inert=true;setTimeout(()=>$('#dialog').focus(),0);
}
function closeModal(restoreFocus=true){if(!modalType)return;$('#modalOverlay').classList.remove('open');$('.app').inert=false;const callback=modalClose;modalType='';modalClose=null;if(callback)callback();if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus();previousFocus=null;}
const closeButton=()=>`<button class="icon-btn dialog-close" data-action="closeModal" aria-label="Đóng">${icon('close')}</button>`;
function showNew(){drawer(false);newLevel=settings.level;newSide=settings.human;
 showModal('new',`${closeButton()}<div class="dialog-eyebrow">A NEW BATTLE AWAITS</div><h2 id="dialogTitle">Bước vào chiến trường.</h2><p>Chọn đối thủ và bên đi. Phe của bạn luôn dùng bộ quân xanh dương–hồng.</p><label>Độ khó</label><div class="level-tabs" id="newLevels">${Object.keys(LABEL).map(l=>`<button class="level-tab ${l===newLevel?'active':''}" data-newlevel="${l}">${LABEL[l]}</button>`).join('')}</div><label>Bên của bạn</label><div class="color-options"><button class="color-option ${newSide===1?'active':''}" data-newside="1"><span class="disc"></span>Trắng<small>Bạn đi trước</small></button><button class="color-option black ${newSide===-1?'active':''}" data-newside="-1"><span class="disc"></span>Đen<small>AI đi trước</small></button></div><div class="dialog-actions"><button class="secondary-btn" data-action="closeModal">Quay lại</button><button class="primary-btn" data-action="start">${icon('target')}Bắt đầu</button></div><p class="dialog-note">${game.history.length?'Ván đang lưu sẽ được thay thế khi bạn bắt đầu. Xuất PGN trước để giữ biên bản.':'Không giới hạn thời gian. Không cần kết nối mạng.'}</p>`);
}
function startNew(){closeModal(false);drawer(false);clearAsync();settings.level=newLevel;settings.human=newSide;orientation=newSide;game=new Chess();ended=null;clearSelection();elapsed=0;hintsUsed=0;created=new Date().toISOString();focusSquare=index(newSide===1?'e2':'e7');renderAll();save();boardSize();scheduleAI(350);}
function showPromotion(candidates){const token=epoch,from=candidates[0].from,to=candidates[0].to;
 showModal('promotion',`${closeButton()}<div class="dialog-eyebrow">PAWN ASCENSION</div><h2 id="dialogTitle">Phong cấp quân Tốt</h2><p>Tốt đến ${coord(to)}. Chọn quân muốn phong; không bắt buộc phải chọn Hậu.</p><div class="promo-grid">${[Q,R,B,N].map(t=>`<button class="promo-option" data-promo="${t}" data-from="${from}" data-to="${to}" data-epoch="${token}"><img src="${pieceSrc(settings.human*t)}" alt="">${NAME[t]}</button>`).join('')}</div><p class="dialog-note">Đóng hộp này để hủy lựa chọn, Tốt vẫn ở vị trí cũ.</p>`);
}
function formatElapsed(ms){const n=Math.floor(ms/1000),m=Math.floor(n/60);return m+':'+String(n%60).padStart(2,'0');}
function showResult(){if(!ended)return;drawer(false);const win=ended.winner===settings.human,draw=ended.winner===0;
 showModal('result',`${closeButton()}<div class="result-center"><img class="result-crest" src="${ASSETS[(win||draw?'blue':'purple')+'-king']}" alt=""><div class="dialog-eyebrow">${draw?'HONORS SHARED':win?'VICTORY IS YOURS':'A BATTLE, NOT THE WAR'}</div><h2 id="dialogTitle">${statusTitle()}</h2><p>${reasonText(ended.type)}</p><div class="result-stats"><div><strong>${game.history.length}</strong><small>NƯỚC ĐI</small></div><div><strong>${formatElapsed(elapsed)}</strong><small>THỜI GIAN CHƠI</small></div><div><strong>${hintsUsed}</strong><small>LẦN GỢI Ý</small></div></div><div class="dialog-actions"><button class="secondary-btn" data-action="closeModal">Xem bàn cờ</button><button class="primary-btn" data-action="new">Ván mới ${icon('plus')}</button></div></div>`);
}
function showResign(){if(ended)return;drawer(false);showModal('resign',`${closeButton()}<div class="dialog-eyebrow">TACTICAL RETREAT</div><h2 id="dialogTitle">Đầu hàng ván này?</h2><p>Đối thủ sẽ thắng ván hiện tại. Bạn vẫn có thể xem biên bản, đi lại hoặc bắt đầu một ván mới.</p><div class="dialog-actions"><button class="secondary-btn" data-action="closeModal">Tiếp tục chơi</button><button class="primary-btn" data-action="confirmResign">Đầu hàng</button></div>`);}
function showDraw(){if(ended||busy||animating||game.turn!==settings.human)return;const current=game.claimable(),future=current?[]:game.claimMoves();
 if(!current&&!future.length){toast('Chưa đủ điều kiện: cùng thế cờ 3 lần hoặc 50 nước không đi Tốt / bắt quân.');return;}
 drawer(false);showModal('draw',`${closeButton()}<div class="dialog-eyebrow">DRAW CLAIM</div><h2 id="dialogTitle">Yêu cầu hòa</h2><p>${current?'Vị trí hiện tại đã đủ điều kiện yêu cầu hòa.':'Một nước đi dự định sẽ tạo điều kiện hòa. Chọn nước đó để yêu cầu hòa; nước đi không được thực hiện.'}</p>${current?`<button class="primary-btn" style="width:100%" data-claim="${current}">Xác nhận hòa · ${current==='threefold'?'Lặp 3 lần':'Quy tắc 50 nước'}</button>`:future.slice(0,60).map(m=>`<button class="claim-choice" data-claim="${m.reason}">${NAME[Math.abs(m.piece)]} ${coord(m.from)} → ${coord(m.to)}${m.promo?' = '+NAME[m.promo]:''} · ${m.reason==='threefold'?'Lặp 3 lần':'50 nước'}</button>`).join('')}`);
}
function showRules(){drawer(false);showModal('rules',`${closeButton()}<div class="dialog-eyebrow">FIELD MANUAL</div><h2 id="dialogTitle">Cờ vua. Một diện mạo mới.</h2><p>Chạm quân của bạn, rồi chạm ô sáng để đi. Mục tiêu là chiếu hết Vua đối thủ. Hiệu ứng chiến đấu chỉ là hình ảnh, không có máu, sát thương hay luật phụ.</p><div class="rules-grid">${[[K,'Một ô theo mọi hướng. Không vào ô bị tấn công.'],[Q,'Đi thẳng hoặc chéo, không nhảy qua quân.'],[R,'Đi ngang hoặc dọc, không nhảy qua quân.'],[B,'Đi chéo, luôn ở trên cùng màu ô.'],[N,'Đi chữ L. Có thể nhảy qua quân khác.'],[P,'Đi thẳng, ăn chéo. Nước đầu có thể đi hai ô.']].map(([t,s])=>`<div class="rule-item"><img src="${pieceSrc(settings.human*t)}" alt=""><div><strong>${NAME[t]}</strong>${s}</div></div>`).join('')}</div><div class="rules-extra"><p><b>Luật đặc biệt:</b> nhập thành khi đủ điều kiện; bắt Tốt qua đường chỉ ở lượt ngay sau bước đôi; phong Tốt thành Hậu, Xe, Tượng hoặc Mã.</p><p><b>Hòa:</b> hết nước đi nhưng không bị chiếu; các trường hợp thiếu quân được nhận biết; tự động hòa khi lặp 5 lần hoặc 75 nước không đi Tốt / bắt quân. Nút Hòa cho phép yêu cầu ở mốc lặp 3 lần hoặc 50 nước, cả với nước đi dự định.</p><p><b>Gợi ý:</b> AI tìm kiếm có giới hạn thời gian, không bảo đảm nước tối ưu tuyệt đối. Dễ tìm 1 lớp; Trung bình tối đa 3; Khó tối đa 5, thêm tìm kiếm chuỗi bắt quân. Độ sâu thực tế phụ thuộc thiết bị và thế cờ.</p><p><b>Đi lại:</b> trả về lượt người chơi trước đó. Ván tự lưu trên trình duyệt hiện tại; chuyển file hoặc trình duyệt có thể không thấy cùng bản lưu. PGN lưu biên bản để mang sang phần mềm cờ vua khác.</p></div><div class="rules-keys"><span><b>H</b> Gợi ý</span><span><b>U</b> Đi lại</span><span><b>F</b> Xoay</span><span><b>N</b> Ván mới</span></div><div class="dialog-actions"><button class="primary-btn" data-action="closeModal">Trở lại chiến trường</button></div>`);}
function exportPGN(){const result=!ended?'*':ended.winner===1?'1-0':ended.winner===-1?'0-1':'1/2-1/2';const pgn=game.pgn({White:settings.human===1?'Player — Azure Order':'Violet Legion AI',Black:settings.human===-1?'Player — Azure Order':'Violet Legion AI',Date:created.slice(0,10).replace(/-/g,'.'),Result:result,Mode:'Offline',Level:LABEL[settings.level]});const blob=new Blob(['\ufeff'+pgn],{type:'application/x-chess-pgn;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='chess-beyond-'+new Date().toISOString().slice(0,10)+'.pgn';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất biên bản PGN.');}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Trình duyệt này không hỗ trợ toàn màn hình.');}catch(e){toast('Không thể bật toàn màn hình trên trình duyệt này.');}}
const actions={new:showNew,start:startNew,hint:requestHint,undo:undoTurn,flip,fx:toggleFX,rules:showRules,export:exportPGN,resign:showResign,draw:showDraw,confirmResign:()=>{closeModal(false);finishGame({type:'resign',winner:-settings.human});},closeModal:()=>closeModal(),drawer:()=>drawer(true),closeDrawer:()=>drawer(false),fullscreen};
document.addEventListener('click',e=>{
 const level=e.target.closest('[data-level]');if(level){changeLevel(level.dataset.level);return;}
 const nlevel=e.target.closest('[data-newlevel]');if(nlevel){newLevel=nlevel.dataset.newlevel;$$('#newLevels button').forEach(b=>b.classList.toggle('active',b.dataset.newlevel===newLevel));return;}
 const side=e.target.closest('[data-newside]');if(side){newSide=+side.dataset.newside;$$('[data-newside]').forEach(b=>b.classList.toggle('active',+b.dataset.newside===newSide));return;}
 const promo=e.target.closest('[data-promo]');if(promo){const t=+promo.dataset.epoch,spec={from:+promo.dataset.from,to:+promo.dataset.to,promo:+promo.dataset.promo};closeModal(false);if(t===epoch)performMove(spec);return;}
 const claim=e.target.closest('[data-claim]');if(claim){const type=claim.dataset.claim;closeModal(false);finishGame({type,winner:0});return;}
 const action=e.target.closest('[data-action]');if(action&&!action.disabled)actions[action.dataset.action]?.();
});
$('#modalOverlay').addEventListener('click',e=>{if(e.target===$('#modalOverlay'))closeModal();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(modalType)closeModal();else if($('#sidePanel').classList.contains('open'))drawer(false);else{clearSelection();renderBoard();renderStatus();}return;}
 if(modalType){if(e.key==='Tab'){const focusables=$$('#dialog button:not(:disabled),#dialog [tabindex="0"]');if(!focusables.length){e.preventDefault();return;}const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('#dialog'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===$('#dialog'))){e.preventDefault();first.focus();}}return;}
 if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
 const act={h:requestHint,u:undoTurn,f:flip,n:showNew}[e.key.toLowerCase()];if(act){e.preventDefault();act();}
});
// Local elapsed play time is informational only, never a chess clock.
setInterval(()=>{const now=performance.now();if(!document.hidden&&!ended&&!modalType)elapsed+=Math.min(now-lastTick,1500);lastTick=now;},1000);
document.addEventListener('visibilitychange',()=>{lastTick=performance.now();save();});window.addEventListener('pagehide',save);
new ResizeObserver(boardSize).observe(spaceEl);window.addEventListener('orientationchange',()=>setTimeout(boardSize,120));
restore();for(const img of $$('[data-piece]'))img.src=ASSETS[img.dataset.piece];renderAll();boardSize();save();if(storageNotice)setTimeout(()=>toast(storageNotice),500);if(!ended)scheduleAI(550);
window.ChessBeyond=Object.freeze({version:'1.0.0',getFEN:()=>game.fen(),getPGN:()=>game.pgn()});
// Explicit opt-in harness for automated regression testing; not part of gameplay UI.
if(new URLSearchParams(location.search).has('test'))window.__CHESS_TEST__={Core,AI,get state(){return {fen:game.fen(),human:settings.human,orientation,selected,legal:legal.map(m=>coord(m.from)+coord(m.to)+(m.promo?Core.LETTER[m.promo]:'')),history:game.history,ended,busy,animating,hint};},load:(fen,human=1)=>{closeModal(false);clearAsync();game=new Chess(fen);settings.human=human;orientation=human;ended=game.terminal();clearSelection();renderAll();},play:performMove,moveInstant:spec=>{clearAsync();game.play(spec);ended=game.terminal();clearSelection();renderAll();},setFX:v=>{settings.vfx=v;renderStatus();},setLevel:changeLevel,draw:showDraw,save,clearAsync};
})();
