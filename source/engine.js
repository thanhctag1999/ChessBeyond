/* Chess Beyond — standalone orthodox-chess rules engine.
 * 0x88 board; no remote libraries. Internal make/unmake is for search only.
 * User moves must go through play(), which validates legality and keeps history.
 */
function createChessCore() {
  'use strict';
  const P=1,N=2,B=3,R=4,Q=5,K=6;
  const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const LETTER=' pnbrqk', KNIGHT=[-33,-31,-18,-14,14,18,31,33], DIAG=[-17,-15,15,17], ORTH=[-16,-1,1,16], KING=[-17,-16,-15,-1,1,15,16,17];
  const EP=1,CK=2,CQ=4,DB=8;
  const opposite=c=>-c;
  const coord=s=>String.fromCharCode(97+(s&7))+(8-(s>>4));
  const index=s=> typeof s==='number'?s: /^[a-h][1-8]$/.test(s)?((8-Number(s[1]))<<4)+(s.charCodeAt(0)-97):-1;
  const color=p=>p>0?1:p<0?-1:0;
  class Chess {
    constructor(fen=START) { this.load(fen); }
    load(fen) {
      if(typeof fen!=='string') throw Error('FEN không hợp lệ.');
      const f=fen.trim().split(/\s+/); if(f.length!==6) throw Error('FEN cần đủ 6 trường.');
      this.board=new Int8Array(128); this.kings={'1':-1,'-1':-1};
      const rows=f[0].split('/'); if(rows.length!==8) throw Error('FEN cần 8 hàng.');
      rows.forEach((row,r)=>{let x=0; for(const ch of row){if(/[1-8]/.test(ch)){x+=+ch;}else{const t=LETTER.indexOf(ch.toLowerCase());if(t<1||x>7)throw Error('Quân cờ trong FEN không hợp lệ.');const c=ch===ch.toUpperCase()?1:-1; const s=r*16+x++;this.board[s]=c*t;if(t===K){if(this.kings[c]!==-1)throw Error('Mỗi bên chỉ có một Vua.');this.kings[c]=s;}if(t===P&&(r===0||r===7))throw Error('Tốt chưa phong cấp ở hàng cuối.');}} if(x!==8)throw Error('Hàng FEN không đủ 8 ô.');});
      if(this.kings[1]<0||this.kings[-1]<0)throw Error('Thiếu Vua.');
      if(!/^[wb]$/.test(f[1])||!/^(-|K?Q?k?q?)$/.test(f[2]))throw Error('Lượt đi hoặc quyền nhập thành không hợp lệ.');
      this.turn=f[1]==='w'?1:-1;this.castle=0;
      for(const [ch,bit] of [['K',1],['Q',2],['k',4],['q',8]])if(f[2].includes(ch))this.castle|=bit;
      this.ep=f[3]==='-'?-1:index(f[3]);
      if(f[3]!=='-'&&(this.ep<0||((this.ep>>4)!==(this.turn===1?2:5))||this.board[this.ep]))throw Error('Ô bắt Tốt qua đường không hợp lệ.');
      if(!/^\d+$/.test(f[4])||!/^\d+$/.test(f[5])||Number(f[5])<1)throw Error('Bộ đếm FEN không hợp lệ.');
      this.half=+f[4];this.full=+f[5];this.stack=[];this.history=[];this.keys=[];this.repetition=new Map();
      this.initial=fen;const key=this.key();this.keys.push(key);this.repetition.set(key,1);return this;
    }
    fen() {
      let rows=[];for(let r=0;r<8;r++){let text='',empty=0;for(let f=0;f<8;f++){const p=this.board[r*16+f];if(!p){empty++;continue;}if(empty){text+=empty;empty=0;}const ch=LETTER[Math.abs(p)];text+=p>0?ch.toUpperCase():ch;}if(empty)text+=empty;rows.push(text);}
      let rights='';for(const [ch,bit] of [['K',1],['Q',2],['k',4],['q',8]])if(this.castle&bit)rights+=ch;
      return `${rows.join('/')} ${this.turn===1?'w':'b'} ${rights||'-'} ${this.ep<0?'-':coord(this.ep)} ${this.half} ${this.full}`;
    }
    key() {
      // En-passant is part of repetition identity only if a legal EP capture exists.
      const f=this.fen().split(' ');if(this.ep>=0&&!this.hasLegalEP())f[3]='-';return f.slice(0,4).join(' ');
    }
    hasLegalEP() {
      if(this.ep<0)return false;const c=this.turn,cap=this.ep+c*16;
      if(this.board[cap]!==-c*P)return false;
      for(const delta of [-1,1]){const from=cap+delta;if(from&0x88||this.board[from]!==c*P)continue;
        this.make({from,to:this.ep,piece:c*P,capture:-c*P,promo:0,flag:EP});const safe=!this.attacked(this.kings[c],-c);this.unmake();if(safe)return true;}
      return false;
    }
    attacked(square,by) {
      const back=square+by*16;for(const s of [back-1,back+1])if(!(s&0x88)&&this.board[s]===by*P)return true;
      for(const d of KNIGHT){const s=square+d;if(!(s&0x88)&&this.board[s]===by*N)return true;}
      for(const d of KING){const s=square+d;if(!(s&0x88)&&this.board[s]===by*K)return true;}
      for(const dirs of [DIAG,ORTH])for(const d of dirs){let s=square+d;while(!(s&0x88)){const p=this.board[s];if(p){if(color(p)===by&&(Math.abs(p)===Q||Math.abs(p)===(dirs===DIAG?B:R)))return true;break;}s+=d;}}
      return false;
    }
    inCheck(c=this.turn) {return this.attacked(this.kings[c],-c);}
    moves(only=-1,capturesOnly=false) {
      only=index(only);const c=this.turn, out=[];const board=this.board;
      const add=(from,to,flag=0,promo=0)=>{const capture=flag&EP?-c*P:board[to];if(Math.abs(capture)===K)return;
        if(capturesOnly&&!capture&&!promo)return;out.push({from,to,piece:board[from],capture,promo,flag});};
      for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=board[s];if(color(p)!==c||(only>=0&&s!==only))continue;const t=Math.abs(p);
        if(t===P){const forward=-16*c,to=s+forward; if(!(to&0x88)&&!board[to]){
            if((to>>4)===(c===1?0:7)){for(const promo of [Q,R,B,N])add(s,to,0,promo);}else{add(s,to);const two=to+forward;if((s>>4)===(c===1?6:1)&&!board[two])add(s,two,DB);}}
          for(const d of [forward-1,forward+1]){const to=s+d;if(to&0x88)continue;
            if(board[to]&&color(board[to])===-c){if((to>>4)===(c===1?0:7)){for(const promo of [Q,R,B,N])add(s,to,0,promo);}else add(s,to);}
            else if(to===this.ep&&!board[to]&&board[to+c*16]===-c*P)add(s,to,EP);}
        }else{const dirs=t===N?KNIGHT:t===B?DIAG:t===R?ORTH:KING;for(const d of dirs){let to=s+d;while(!(to&0x88)){if(color(board[to])===c)break;add(s,to);if(board[to]||t===N||t===K)break;to+=d;}}
          if(t===K&&!capturesOnly){const home=c===1?116:4,ks=c===1?1:4,qs=c===1?2:8;
            if(s===home&&!this.attacked(s,-c)){
              if(this.castle&ks&&board[s+3]===c*R&&!board[s+1]&&!board[s+2]&&!this.attacked(s+1,-c)&&!this.attacked(s+2,-c))add(s,s+2,CK);
              if(this.castle&qs&&board[s-4]===c*R&&!board[s-1]&&!board[s-2]&&!board[s-3]&&!this.attacked(s-1,-c)&&!this.attacked(s-2,-c))add(s,s-2,CQ);}}}
      }
      const legal=[];for(const m of out){this.make(m);const valid=!this.attacked(this.kings[c],-c);this.unmake();if(valid)legal.push(m);}return legal;
    }
    make(m) {
      const c=this.turn,capSquare=m.flag&EP?m.to+c*16:m.to;
      this.stack.push({m,capSquare,captured:this.board[capSquare],castle:this.castle,ep:this.ep,half:this.half,full:this.full,king:this.kings[c],turn:c});
      this.board[m.from]=0;if(m.flag&EP)this.board[capSquare]=0;this.board[m.to]=m.promo?c*m.promo:m.piece;
      if(Math.abs(m.piece)===K){this.kings[c]=m.to;this.castle&=c===1?~3:~12;}
      if(m.flag&CK){this.board[m.from+3]=0;this.board[m.from+1]=c*R;}
      if(m.flag&CQ){this.board[m.from-4]=0;this.board[m.from-1]=c*R;}
      for(const [sq,bit] of [[119,1],[112,2],[7,4],[0,8]])if(m.from===sq||m.to===sq)this.castle&=~bit;
      this.ep=m.flag&DB?(m.from+m.to)>>1:-1;this.half=Math.abs(m.piece)===P||m.capture?0:this.half+1;if(c===-1)this.full++;this.turn=-c;
    }
    unmake() {
      const u=this.stack.pop();if(!u)return null;const {m}=u,c=u.turn;this.turn=c;this.castle=u.castle;this.ep=u.ep;this.half=u.half;this.full=u.full;this.kings[c]=u.king;
      this.board[m.from]=m.piece;this.board[m.to]=0;this.board[u.capSquare]=u.captured;
      if(m.flag&CK){this.board[m.from+1]=0;this.board[m.from+3]=c*R;}
      if(m.flag&CQ){this.board[m.from-1]=0;this.board[m.from-4]=c*R;}return m;
    }
    notation(m,legal) {
      if(m.flag&CK)return 'O-O';if(m.flag&CQ)return 'O-O-O';let s='',t=Math.abs(m.piece);
      if(t!==P){s=LETTER[t].toUpperCase();const others=legal.filter(x=>x.from!==m.from&&x.to===m.to&&x.piece===m.piece);
        if(others.length){const sameFile=others.some(x=>(x.from&7)===(m.from&7));const sameRank=others.some(x=>(x.from>>4)===(m.from>>4));s+=!sameFile?coord(m.from)[0]:!sameRank?coord(m.from)[1]:coord(m.from);}}
      else if(m.capture)s=coord(m.from)[0];if(m.capture)s+='x';s+=coord(m.to);if(m.promo)s+='='+LETTER[m.promo].toUpperCase();return s;
    }
    play(spec) {
      const legal=this.moves();let m;
      if(typeof spec==='string'){const match=/^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(spec);if(!match)throw Error('Nước đi cần dạng e2e4.');spec={from:match[1],to:match[2],promo:match[3]?LETTER.indexOf(match[3]):0};}
      let promo=spec.promo||spec.promotion||0;if(typeof promo==='string')promo=LETTER.indexOf(promo.toLowerCase());
      m=legal.find(m=>m.from===index(spec.from)&&m.to===index(spec.to)&&(m.promo===promo||(!promo&&m.promo===Q)));
      if(!m)throw Error('Nước đi không hợp lệ.');
      let san=this.notation(m,legal);const before=this.fen();this.make(m);
      if(this.inCheck())san+=this.moves().length?'+':'#';const key=this.key();this.keys.push(key);this.repetition.set(key,(this.repetition.get(key)||0)+1);
      const result={...m,san,before,after:this.fen(),color:color(m.piece)};this.history.push(result);return result;
    }
    undo() {
      if(!this.history.length)return null;const key=this.keys.pop(),n=this.repetition.get(key)||1;if(n<=1)this.repetition.delete(key);else this.repetition.set(key,n-1);
      this.unmake();return this.history.pop();
    }
    insufficient() {
      let minor=[];for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const t=Math.abs(this.board[s]);if(!t||t===K)continue;if(t===P||t===R||t===Q)return false;minor.push({t,s});}
      if(minor.length<=1)return true;
      return minor.every(x=>x.t===B)&&minor.every(x=>(((x.s>>4)+(x.s&7))&1)===(((minor[0].s>>4)+(minor[0].s&7))&1));
    }
    terminal() {
      if(!this.moves().length)return this.inCheck()?{type:'mate',winner:-this.turn}:{type:'stalemate',winner:0};
      if(this.insufficient())return {type:'material',winner:0};
      if((this.repetition.get(this.keys[this.keys.length-1])||0)>=5)return {type:'fivefold',winner:0};
      if(this.half>=150)return {type:'seventyfive',winner:0};return null;
    }
    claimable() {if((this.repetition.get(this.keys[this.keys.length-1])||0)>=3)return 'threefold';if(this.half>=100)return 'fifty';return null;}
    claimMoves() {
      const out=[];for(const m of this.moves()){this.make(m);const repeat=(this.repetition.get(this.key())||0)+1;const why=repeat>=3?'threefold':this.half>=100?'fifty':null;this.unmake();if(why)out.push({...m,reason:why});}return out;
    }
    pgn(headers={}) {
      const h={Event:'Chess Beyond — Neon Arena',Site:'Offline',White:'White',Black:'Black',Result:'*',...headers};if(this.initial!==START){h.SetUp='1';h.FEN=this.initial;}
      let text=Object.entries(h).map(([k,v])=>'['+k+' "'+String(v).replace(/["\\\r\n]/g,'')+'"]');
      const list=[];let n=+this.initial.split(' ')[5],side=this.initial.split(' ')[1]==='w'?1:-1;
      for(const [i,m] of this.history.entries()){if(side===1)list.push(n+'.');else if(i===0)list.push(n+'...');list.push(m.san);if(side===-1)n++;side=-side;}list.push(h.Result);return text.join('\n')+'\n\n'+list.join(' ');
    }
    perft(depth) {if(depth===0)return 1;const moves=this.moves();if(depth===1)return moves.length;let nodes=0;for(const m of moves){this.make(m);nodes+=this.perft(depth-1);this.unmake();}return nodes;}
  }
  return {Chess,START,P,N,B,R,Q,K,EP,CK,CQ,DB,coord,index,color,opposite,LETTER};
}
if(typeof module!=='undefined'&&module.exports)module.exports=createChessCore();
