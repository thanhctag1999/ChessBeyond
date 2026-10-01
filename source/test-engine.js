'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Chess,START,coord,index,P,N,B,R,Q,K,EP,CK,CQ}=require('./engine.js');
const AI=require('./ai.js');
const tests=[];function test(name,fn){const t=performance.now();try{fn();tests.push({name,pass:true,ms:Math.round(performance.now()-t)});console.log('PASS',name);}catch(e){tests.push({name,pass:false,error:e.message});console.error('FAIL',name,e.message);}}
const uci=m=>coord(m.from)+coord(m.to)+(m.promo?' pnbrqk'[m.promo]:'');
function has(c,m){return c.moves().some(x=>uci(x)===m);}
const fixtures=[
 ['Start',START,[20,400,8902,197281,4865609]],
 ['Kiwipete','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862,4085603]],
 ['Rook + pawn ending','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238,674624]],
 ['Promotion / castling checks','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467,422333]],
 ['Tactical promotion position','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379,2103487]],
 ['Middlegame checks','r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',[46,2079,89890,3894594]]
];
for(const [name,fen,counts] of fixtures)for(let i=0;i<counts.length;i++)test(`perft ${name}, depth ${i+1}`,()=>{const c=new Chess(fen);assert.equal(c.perft(i+1),counts[i]);assert.equal(c.fen(),fen);assert.equal(c.stack.length,0);});
// This additional depth-5 fixture and count are used in Stockfish's public perft.sh.
test('Stockfish extra fixture, depth 5, 11,609,488 nodes',()=>{const c=new Chess('r7/4p3/5p1q/3P4/4pQ2/4pP2/6pp/R3K1kr w Q - 1 3');assert.equal(c.perft(5),11609488);});
test('Start position has 32 pieces / 16 per side',()=>{const c=new Chess();assert.equal(Array.from(c.board).filter(p=>p>0).length,16);assert.equal(Array.from(c.board).filter(p=>p<0).length,16);});
test('Illegal move rejected, state unchanged',()=>{const c=new Chess();assert.throws(()=>c.play('e2e5'));assert.equal(c.fen(),START);assert.equal(c.history.length,0);});
test('Both white castlings and undo',()=>{const fen='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',c=new Chess(fen);assert(has(c,'e1g1'));assert(has(c,'e1c1'));assert.equal(c.play('e1g1').san,'O-O');assert.equal(c.board[index('f1')],R);assert.equal(c.board[index('h1')],0);c.undo();assert.equal(c.fen(),fen);assert.equal(c.play('e1c1').san,'O-O-O');assert.equal(c.board[index('d1')],R);});
test('Black queenside castling',()=>{const c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');c.play('e8c8');assert.equal(c.board[index('d8')],-R);assert.equal(c.board[index('c8')],-K);});
test('Cannot castle through check',()=>{const c=new Chess('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');assert(!has(c,'e1g1'));assert(has(c,'e1c1'));});
test('Cannot castle while in check',()=>{const c=new Chess('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1');assert(!has(c,'e1g1'));assert(!has(c,'e1c1'));});
test('Cannot castle with a missing rook despite malformed rights',()=>{const c=new Chess('4k3/8/8/8/8/8/8/4K3 w KQ - 0 1');assert(!has(c,'e1g1'));assert(!has(c,'e1c1'));});
test('Rook move permanently revokes its castling right',()=>{const c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');for(const m of ['h1h2','a8a7','h2h1','a7a8'])c.play(m);assert(!has(c,'e1g1'));assert(has(c,'e1c1'));});
test('Legal en passant, captured pawn removed, undo exact',()=>{const fen='k7/8/8/3pP3/8/8/8/4K3 w - d6 0 2',c=new Chess(fen);assert(has(c,'e5d6'));assert.equal(c.play('e5d6').san,'exd6');assert.equal(c.board[index('d5')],0);assert.equal(c.board[index('d6')],P);c.undo();assert.equal(c.fen(),fen);});
test('En passant exposing own king is illegal',()=>{const c=new Chess('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');assert(!has(c,'e5d6'));assert(c.key().endsWith('-'));});
test('En passant expires after any intervening move',()=>{const c=new Chess('k7/8/8/3pP3/8/8/8/4K3 w - d6 0 2');c.play('e1f1');assert.equal(c.ep,-1);c.play('a8b8');assert(!has(c,'e5d6'));});
test('Pinned rook cannot expose king',()=>{const c=new Chess('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');assert(!has(c,'e2d2'));assert(has(c,'e2e8'));});
test('Double check permits only king moves',()=>{const c=new Chess('k3r3/8/8/8/1b6/8/8/3RK3 w - - 0 1');assert(c.inCheck());assert(c.moves().every(m=>Math.abs(m.piece)===K));});
test('Four promotion choices and knight underpromotion',()=>{const c=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.equal(c.moves(index('a7')).filter(m=>m.to===index('a8')).length,4);assert.equal(c.play('a7a8n').san,'a8=N');assert.equal(c.board[index('a8')],N);assert.equal(c.terminal().type,'material');});
test('SAN disambiguation',()=>{const c=new Chess('7k/8/8/8/8/8/8/1N1N3K w - - 0 1');assert.equal(c.play('b1c3').san,'Nbc3');});
test('Fools mate, checkmate, result side',()=>{const c=new Chess();for(const m of ['f2f3','e7e5','g2g4'])c.play(m);assert.equal(c.play('d8h4').san,'Qh4#');assert.deepEqual(c.terminal(),{type:'mate',winner:-1});});
test('Stalemate is a draw, not checkmate',()=>{const c=new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');assert(!c.inCheck());assert.equal(c.terminal().type,'stalemate');});
test('3-fold is claimable, not auto; 5-fold automatic',()=>{const c=new Chess();for(let i=0;i<2;i++)for(const m of ['g1f3','g8f6','f3g1','f6g8'])c.play(m);assert.equal(c.claimable(),'threefold');assert.equal(c.terminal(),null);for(let i=0;i<2;i++)for(const m of ['g1f3','g8f6','f3g1','f6g8'])c.play(m);assert.equal(c.terminal().type,'fivefold');c.undo();assert.notEqual(c.terminal()?.type,'fivefold');});
test('Prospective third repetition claim',()=>{const c=new Chess();for(const m of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1'])c.play(m);assert.equal(c.claimable(),null);assert(c.claimMoves().some(m=>uci(m)==='f6g8'&&m.reason==='threefold'));});
test('50-move claim and prospective claim',()=>{const c=new Chess('7k/8/8/8/8/8/8/KR6 w - - 99 1');assert.equal(c.claimable(),null);assert(c.claimMoves().length>0);c.play('b1b2');assert.equal(c.claimable(),'fifty');assert.equal(c.terminal(),null);});
test('75 moves automatic, mate has priority',()=>{assert.equal(new Chess('7k/8/8/8/8/8/8/KR6 w - - 150 1').terminal().type,'seventyfive');assert.equal(new Chess('7k/6Q1/5K2/8/8/8/8/8 b - - 150 1').terminal().type,'mate');});
test('Common insufficient material and not KNN vs K',()=>{assert(new Chess('7k/8/8/8/8/8/8/K7 w - - 0 1').insufficient());assert(new Chess('7k/8/8/8/8/8/8/KB6 w - - 0 1').insufficient());assert(!new Chess('7k/8/8/8/8/8/8/KNN5 w - - 0 1').insufficient());});
test('Save/replay preserves repetition state and history',()=>{const c=new Chess();for(const m of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'])c.play(m);const d=new Chess(c.initial);for(const m of JSON.parse(JSON.stringify(c.history)))d.play(m);assert.equal(d.fen(),c.fen());assert.equal(d.claimable(),c.claimable());assert.deepEqual(d.history.map(m=>m.san),c.history.map(m=>m.san));});
test('Random legal walks fully undo',()=>{for(let run=0;run<12;run++){const c=new Chess(),fens=[START];for(let i=0;i<120;i++){const moves=c.moves();if(!moves.length)break;c.play(moves[Math.floor(Math.random()*moves.length)]);assert(!c.inCheck(-c.turn));fens.push(c.fen());}while(c.history.length){fens.pop();c.undo();assert.equal(c.fen(),fens.at(-1));}assert.equal(c.fen(),START);}});
test('PGN SAN contains castling, headers, result',()=>{const c=new Chess();for(const m of ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1'])c.play(m);const pgn=c.pgn({Result:'*'});assert(pgn.includes('5. O-O'));assert(pgn.includes('[Result "*"]'));});
for(const level of ['easy','normal','hard'])test('AI '+level+' finds mate in one without mutating state',()=>{const c=new Chess();for(const m of ['f2f3','e7e5','g2g4'])c.play(m);const before=c.fen(),r=AI.choose(c,level);assert.equal(c.fen(),before);assert.equal(r.move.from+r.move.to,'d8h4');assert(r.score>99000);});
test('AI bounded normal/hard return legal moves with distinct depth policies',()=>{const c=new Chess();c.play('e2e4');for(const level of ['normal','hard']){const fen=c.fen(),r=AI.choose(c,level);assert.equal(c.fen(),fen);assert(has(c,r.move.from+r.move.to+(r.move.promo?' pnbrqk'[r.move.promo]:'')));assert(r.depth>=2);assert(r.depth<=AI.LEVELS[level].depth);assert(r.time<AI.LEVELS[level].time+700);}});
const passed=tests.filter(t=>t.pass).length;console.log(`\n${passed}/${tests.length} passed`);fs.writeFileSync(__dirname+'/engine-test-results.json',JSON.stringify({date:new Date().toISOString(),passed,total:tests.length,tests},null,2));if(passed!==tests.length)process.exitCode=1;
