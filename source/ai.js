/* Bounded iterative-deepening / alpha-beta AI. Runs in a Blob Web Worker.
 * Three strengths are search policies, NOT asserted Elo ratings.
 */
function createChessAI(Core) {
  'use strict';
  const {Chess,P,N,B,R,Q,K,CK,CQ,color,coord,LETTER}=Core;
  const VALUE=[0,100,320,335,500,950,0], MATE=100000, INF=200000;
  const LEVELS={easy:{depth:1,time:240,qdepth:0,noise:105},normal:{depth:3,time:850,qdepth:3,noise:0},hard:{depth:5,time:2100,qdepth:5,noise:0},hint:{depth:5,time:1500,qdepth:5,noise:0}};
  const id=m=>m.from+':'+m.to+':'+m.promo;
  function evaluate(g) {
    let total=0,phase=0;const pawns={1:Array.from({length:8},()=>[]),'-1':Array.from({length:8},()=>[])},bishops={1:0,'-1':0};
    for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=g.board[s],t=Math.abs(p),c=color(p);if(!p)continue;if(t===P)pawns[c][s&7].push(s>>4);else if(t!==K)phase+=VALUE[t];if(t===B)bishops[c]++;}
    const end=Math.max(0,Math.min(1,(4200-phase)/4200));
    for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=g.board[s];if(!p)continue;const c=color(p),t=Math.abs(p),f=s&7,r=s>>4,advance=c===1?6-r:r-1,center=7-(Math.abs(f-3.5)+Math.abs(r-3.5));let v=VALUE[t];
      if(t===P){v+=advance*8+advance*advance*2+Math.max(0,3.5-Math.abs(f-3.5))*5;if(pawns[c][f].length>1)v-=13;if(!(pawns[c][f-1]?.length||pawns[c][f+1]?.length))v-=13;
        let passed=true;for(let x=Math.max(0,f-1);x<=Math.min(7,f+1);x++)if(pawns[-c][x].some(y=>c===1?y<r:y>r))passed=false;
        if(passed)v+=12+advance*advance*(2+end*3);if(g.board[s-c*16])v-=8;
      }else if(t===N){v+=center*12;if(r===0||r===7||f===0||f===7)v-=17;}
      else if(t===B){v+=center*6+(advance>0?7:0);}
      else if(t===R){if(!pawns[c][f].length)v+=pawns[-c][f].length?13:26;if((c===1&&r===1)||(c===-1&&r===6))v+=22;}
      else if(t===Q){v+=center*3;if(g.history.length<10&&((c===1&&r<6)||(c===-1&&r>1)))v-=10;}
      else if(t===K){v+=end*center*13;if(end<.65){const back=c===1?7:0;if(r===back&&(f===6||f===2))v+=35;if(r!==back)v-=22;for(const dx of [-1,0,1]){const shield=s-c*16+dx;if(!(shield&0x88)&&g.board[shield]===c*P)v+=12;}}}
      total+=c*v;
    }
    if(bishops[1]>=2)total+=25;if(bishops[-1]>=2)total-=25;return total*g.turn;
  }
  function choose(g,level='normal',overrides={}) {
    const cfg={...(LEVELS[level]||LEVELS.normal),...overrides};const started=performance.now(),deadline=started+cfg.time;let nodes=0,completed=0;
    const TIMEOUT={},tt=new Map(),killers={},path=new Map(g.repetition);const original=g.fen();
    const timeout=()=>{nodes++;if((nodes&63)===0&&performance.now()>deadline)throw TIMEOUT;};
    const enter=m=>{g.make(m);const key=g.key();path.set(key,(path.get(key)||0)+1);return key;};
    const leave=key=>{const n=path.get(key)||1;if(n===1)path.delete(key);else path.set(key,n-1);g.unmake();};
    const order=(moves,best,ply)=>moves.sort((a,b)=>priority(b,best,ply)-priority(a,best,ply));
    function priority(m,best,ply){let p=id(m)===best?10000000:0;if(m.capture)p+=100000+10*VALUE[Math.abs(m.capture)]-VALUE[Math.abs(m.piece)];if(m.promo)p+=80000+VALUE[m.promo];if(killers[ply]?.includes(id(m)))p+=50000;if(m.flag&(CK|CQ))p+=100;return p;}
    function quiet(alpha,beta,depth,ply) {
      timeout();const checked=g.inCheck();let moves=checked?g.moves():g.moves(-1,true);
      if(checked&&!moves.length)return -MATE+ply;
      // A quiet stalemate must not be evaluated as an ordinary material advantage.
      if(!checked&&!moves.length&&!g.moves().length)return 0;
      if((path.get(g.key())||0)>=3||g.half>=100||g.insufficient())return 0;
      if(ply>18)return evaluate(g);
      const stand=evaluate(g);if(!checked){if(stand>=beta)return stand;if(stand>alpha)alpha=stand;if(depth<=0)return stand;}
      if(checked&&depth<-2)return evaluate(g);
      order(moves,null,ply);
      for(const m of moves){let key=enter(m),score;try{score=-quiet(-beta,-alpha,depth-1,ply+1);}finally{leave(key);}if(score>=beta)return score;if(score>alpha)alpha=score;}
      return alpha;
    }
    function negamax(depth,alpha,beta,ply) {
      timeout();if(depth<=0)return quiet(alpha,beta,cfg.qdepth,ply);
      const key=g.key(),rep=path.get(key)||0,checked=g.inCheck();const moves=g.moves();
      if(!moves.length)return checked?-MATE+ply:0;
      if(rep>=3||g.half>=100||g.insufficient())return 0;
      const ttkey=key+'|'+g.half+'|'+rep,entry=tt.get(ttkey),originalAlpha=alpha;
      // Do not reuse mate-distance scores at a different ply or repetition-bound nodes.
      if(entry&&entry.depth>=depth&&rep<2){if(entry.flag==='exact')return entry.score;if(entry.flag==='lower')alpha=Math.max(alpha,entry.score);else beta=Math.min(beta,entry.score);if(alpha>=beta)return entry.score;}
      order(moves,entry?.best,ply);let best=-INF,bestId=null;
      for(const m of moves){let pk=enter(m),score;try{score=-negamax(depth-1,-beta,-alpha,ply+1);}finally{leave(pk);}if(score>best){best=score;bestId=id(m);}if(score>alpha)alpha=score;if(alpha>=beta){if(!m.capture){killers[ply]=[id(m),...(killers[ply]||[])].slice(0,2);}break;}}
      if(rep<2&&Math.abs(best)<MATE-200){if(tt.size>45000)tt.clear();tt.set(ttkey,{depth,score:best,best:bestId,flag:best<=originalAlpha?'upper':best>=beta?'lower':'exact'});}return best;
    }
    const roots=g.moves();if(!roots.length)return {move:null,score:g.inCheck()?-MATE:0,depth:0,nodes:0,time:0};
    let bestMove=roots[0],bestScore=-INF,ranking=[];
    for(let depth=1;depth<=cfg.depth;depth++){
      order(roots,id(bestMove),0);let scoreBest=-INF,candidate=bestMove,alpha=-INF,current=[];let finished=true;
      try{for(const m of roots){if(performance.now()>deadline&&current.length)throw TIMEOUT;let key=enter(m),score;try{score=-negamax(depth-1,-INF,cfg.noise?INF:-alpha,1);}finally{leave(key);}
        current.push({m,score});if(score>scoreBest){scoreBest=score;candidate=m;}if(score>alpha)alpha=score;}}
      catch(e){if(e!==TIMEOUT)throw e;finished=false;}
      if(finished){completed=depth;bestMove=candidate;bestScore=scoreBest;ranking=current;}else{if(!completed&&current.length){current.sort((a,b)=>b.score-a.score);bestMove=current[0].m;bestScore=current[0].score;ranking=current;}break;}
      if(Math.abs(bestScore)>MATE-100||performance.now()>deadline)break;
    }
    // Beginner mode deliberately varies moves. Never deliberately pass up mate in one.
    if(cfg.noise&&ranking.length&&bestScore<MATE-100){const valid=ranking.filter(x=>x.score>bestScore-cfg.noise*2);for(const x of valid)x.jitter=x.score+Math.random()*cfg.noise;valid.sort((a,b)=>b.jitter-a.jitter);bestMove=valid[0].m;bestScore=valid[0].score;}
    if(g.fen()!==original)throw Error('Search state failed to restore.');
    return {move:{from:coord(bestMove.from),to:coord(bestMove.to),promo:bestMove.promo},score:bestScore,depth:completed,nodes,time:Math.round(performance.now()-started)};
  }
  return {choose,evaluate,LEVELS};
}
if(typeof module!=='undefined'&&module.exports)module.exports=createChessAI(require('./engine.js'));
