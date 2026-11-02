const express = require("express"), http = require("http"), { Server } = require("socket.io");
const app = express();
app.use(express.static(__dirname + "/public"));
const srv = http.createServer(app), io = new Server(srv);
const rooms = new Map(), L = "ABCDEFGHJKMNPQRSTUVWXYZ";
const other = k => k === "A" ? "B" : "A";
const plotter = r => r.turn % 2 === 0 ? "A" : "B";
const used = r => [...r.missAll, ...r.hitAll];
const valid = (r, i) => Number.isInteger(i) && i >= 0 && i < r.size * r.size;
const adj = (r, i, j) => { const n = r.size; return i !== j && Math.abs((i / n | 0) - (j / n | 0)) <= 1 && Math.abs(i % n - j % n) <= 1; };
const banned = (r, i) => r.mode === "continuous" && r.prev === i && r.size * r.size - used(r).length > 1;
const clean = (s, d) => String(s || "").trim().slice(0, 14) || d;
function distance(r, a, b) { return Math.abs((a / r.size | 0) - (b / r.size | 0)) + Math.abs(a % r.size - b % r.size); }
function view(r, seat) {
  const p = plotter(r), isGuesser = seat && seat !== p;
  return { size:r.size, mode:r.mode, phase:r.phase, turn:r.turn, A:r.A&&{name:r.A.name}, B:r.B&&{name:r.B.name}, scores:r.scores,
    target:((r.phase === "guess" && seat === p) || r.phase === "reveal") ? r.target : null,
    missAll:r.missAll, hitAll:r.hitAll, dbl:r.dbl, rm:r.rm, prev:seat === p ? r.prev : null, note:r.note,
    timer:r.timer, deadline:r.deadline, hint:isGuesser && r.phase === "guess" ? r.hint : "" };
}
function push(r) {
  r.t = Date.now();
  for (const s of ["A", "B"]) if (r[s] && r[s].sock) io.to(r[s].sock).emit("state", {code:r.code,seat:s,s:view(r,s)});
}
function clearClock(r) { if(r.clock) clearTimeout(r.clock); r.clock=null; r.deadline=null; }
function armClock(r) {
  clearClock(r);
  if (!r.timer || !["plot","guess"].includes(r.phase)) return;
  r.deadline=Date.now()+r.timer*1000;
  r.clock=setTimeout(()=>{
    if(r.phase==="plot") {
      const choices=Array.from({length:r.size*r.size},(_,i)=>i).filter(i=>!used(r).includes(i)&&!banned(r,i));
      if(choices.length) { r.target=choices[Math.random()*choices.length|0]; r.phase="guess"; r.rm=0; r.lastDistance=null; r.hint=""; r.note="Time ran out; a square was picked automatically."; armClock(r); push(r); }
    } else if(r.phase==="guess") {
      const p=plotter(r), choices=Array.from({length:r.size*r.size},(_,i)=>i).filter(i=>!used(r).includes(i));
      if(choices.length) makeGuess(r,other(p),choices[Math.random()*choices.length|0],true);
    }
  },r.timer*1000);
}
function advance(r) {
  clearClock(r);
  if(used(r).length>=r.size*r.size) r.phase="over";
  else {r.phase="plot";r.turn++;r.target=null;r.rm=0;r.hint="";r.lastDistance=null;}
}
function makeGuess(r,s,i,automatic=false) {
  const p=plotter(r); if(r.phase!=="guess"||s===p||!valid(r,i)||used(r).includes(i))return;
  clearClock(r);
  const hn=r[p].name,gn=r[s].name;
  if(i===r.target) {
    r.hitAll.push(i);r.prev=null;r.hint="";
    if(r.mode==="swap") {r.scores[s]+=20;r.note=`${gn} caught ${hn}’s square! Catch bonus: +20.`;advance(r);}
    else {r.phase="reveal";r.note="";}
  } else {
    const d=adj(r,i,r.target), dist=distance(r,i,r.target), was=r.lastDistance;
    r.scores[p]+=d?20:10;r.missAll.push(i);if(d)r.dbl.push(i);r.rm++;r.prev=r.target;
    r.note=automatic?"Time ran out; an automatic guess was made. ":"";
    r.note+=(d?"So close! Adjacent miss, +20 for ":"Miss, +10 for ")+hn+".";
    if(r.rm>=3)r.hint=was===null?"Hint: your latest miss is "+(dist<=2?"close to":"far from")+" the hidden square.":dist<was?"Hotter: that miss was closer than the last one.":dist>was?"Colder: that miss was farther than the last one.":"Same distance as your last miss.";
    r.lastDistance=dist;
    if(r.mode==="continuous"){r.phase="plot";r.target=null;}
    else if(r.mode==="swap")advance(r);
  }
  if(r.phase==="plot"||r.phase==="guess")armClock(r);
  push(r);
}
io.on("connection",sock=>{
  const seat=(r,s)=>{r[s].sock=sock.id;sock.data={code:r.code,seat:s};};
  const act=fn=>d=>{const r=rooms.get(sock.data&&sock.data.code);if(r)fn(r,sock.data.seat,d);};
  sock.on("create",d=>{
    if(rooms.size>=500)return sock.emit("err","Server is busy, try again soon.");
    let c;do{c=Array.from({length:4},()=>L[Math.random()*L.length|0]).join("");}while(rooms.has(c));
    const size=Math.min(15,Math.max(3,+d.size||5)),mode=["single","continuous","swap"].includes(d.mode)?d.mode:"single";
    const timer=[0,30,60,90].includes(+d.timer)?+d.timer:0;
    const r={code:c,size,mode,timer,phase:"lobby",turn:0,A:{pid:d.pid,name:clean(d.name,"Player 1")},B:null,scores:{A:0,B:0},target:null,missAll:[],hitAll:[],dbl:[],rm:0,prev:null,note:"",hint:"",lastDistance:null,t:Date.now()};
    rooms.set(c,r);seat(r,"A");push(r);
  });
  sock.on("join",d=>{
    const r=rooms.get(String(d.code||"").toUpperCase());if(!r)return sock.emit("err","No room with that code.");let s;
    if(r.A.pid===d.pid)s="A";else if(r.B&&r.B.pid===d.pid)s="B";else if(!r.B){r.B={pid:d.pid,name:clean(d.name,"Player 2")};r.phase="plot";s="B";}else return sock.emit("err","That room is full.");
    seat(r,s);armClock(r);push(r);
  });
  sock.on("plot",act((r,s,i)=>{if(r.phase!=="plot"||s!==plotter(r)||!valid(r,i)||used(r).includes(i)||banned(r,i))return;clearClock(r);r.target=i;r.phase="guess";r.note="";r.hint="";r.rm=0;r.lastDistance=null;armClock(r);push(r);}));
  sock.on("guess",act((r,s,i)=>makeGuess(r,s,i)));
  sock.on("next",act(r=>{if(r.phase!=="reveal")return;r.prev=null;r.note="";advance(r);armClock(r);push(r);}));
  sock.on("again",act(r=>{if(r.phase!=="over")return;Object.assign(r,{phase:"plot",turn:0,scores:{A:0,B:0},target:null,missAll:[],hitAll:[],dbl:[],rm:0,prev:null,note:"",hint:"",lastDistance:null});armClock(r);push(r);}));
});
setInterval(()=>{for(const [c,r] of rooms)if(Date.now()-r.t>2*3600e3){clearClock(r);rooms.delete(c);}},10*60e3);
srv.listen(process.env.PORT||3000,()=>console.log("Listening"));
