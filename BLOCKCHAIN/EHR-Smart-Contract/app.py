import html as H
import json
import re
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as legacy
import streamlit.components.v2 as components
from web3 import Web3

try:
    from cryptography.fernet import Fernet
except ImportError:
    Fernet = None

# =========================================================
# KONFIGURASI
# =========================================================
RPC_URL = "http://127.0.0.1:8545"
BASE = Path(__file__).parent
STORE = BASE / "offchain_store"          # simulasi penyimpanan off-chain
STORE.mkdir(exist_ok=True)
STATUS = ["ADDED", "DIAGNOSED", "TREATED", "DISCHARGED"]
ZERO32 = b"\x00" * 32

st.set_page_config(page_title="Rekam Medis Pasien", page_icon="🩺", layout="wide")

# =========================================================
# TAMPILAN (CSS)
# =========================================================
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700&family=Orbitron:wght@500;700;900&display=swap');
@property --num{syntax:'<integer>';initial-value:0;inherits:false}
@property --ang{syntax:'<angle>';initial-value:0deg;inherits:false}
:root{--bg:#050B14;--glass:rgba(12,30,48,.62);--edge:rgba(125,211,252,.18);--txt:#E6F1F5;--mut:#9DB4C0;--cy:#22D3EE;--em:#34D399;--gd:#F5C46B;--co:#FB7185;}
html,body,[class*="css"],.stApp{font-family:'Exo 2',sans-serif;color:var(--txt);}
.stApp{background:var(--bg);}
.stApp::before{content:"";position:fixed;inset:-20%;z-index:0;pointer-events:none;
 background:radial-gradient(40% 35% at 18% 22%,rgba(34,211,238,.20),transparent 70%),radial-gradient(35% 30% at 85% 15%,rgba(52,211,153,.16),transparent 70%),radial-gradient(40% 35% at 70% 90%,rgba(245,196,107,.10),transparent 70%);
 animation:aurora 26s ease-in-out infinite alternate;}
.stApp::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.55;
 background-image:linear-gradient(rgba(125,211,252,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.05) 1px,transparent 1px);background-size:56px 56px;
 -webkit-mask-image:radial-gradient(ellipse at 50% 30%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse at 50% 30%,#000 20%,transparent 75%);}
[data-testid="stMain"],[data-testid="stSidebar"]{position:relative;z-index:1;}
@keyframes aurora{from{transform:translate3d(-2%,-1%,0) scale(1)}to{transform:translate3d(3%,2%,0) scale(1.08)}}
h1,h2,h3,h4,h5{font-family:'Orbitron',sans-serif!important;letter-spacing:.01em;color:var(--txt);font-weight:700;}
h4{font-size:1.05rem!important;} h5{font-size:.95rem!important;color:var(--cy);}
#MainMenu,footer{visibility:hidden;} header[data-testid="stHeader"]{background:transparent;}
.block-container{padding-top:1rem;max-width:1280px;}
:focus-visible{outline:2px solid var(--cy)!important;outline-offset:2px;}
section[data-testid="stSidebar"]{background:rgba(5,14,24,.92);border-right:1px solid var(--edge);backdrop-filter:blur(14px);}
/* navbar */
.nav{display:flex;align-items:center;gap:14px;padding:.7rem 1.1rem;border:1px solid var(--edge);border-radius:16px;background:var(--glass);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);margin-bottom:.8rem;box-shadow:0 10px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);}
.nav svg{width:38px;height:38px;filter:drop-shadow(0 0 8px rgba(34,211,238,.6));}
.nav b{font-family:'Orbitron',sans-serif;font-size:1.05rem;letter-spacing:.08em;background:linear-gradient(90deg,var(--cy),var(--em));-webkit-background-clip:text;background-clip:text;color:transparent;}
.nav .sp{flex:1}
.pill{display:inline-flex;align-items:center;gap:8px;padding:.3rem .8rem;border:1px solid var(--edge);border-radius:999px;font-size:.8rem;color:var(--mut);background:rgba(255,255,255,.03);}
.live{width:8px;height:8px;border-radius:50%;background:var(--em);box-shadow:0 0 0 0 rgba(52,211,153,.7);animation:ping 1.8s infinite;}
.live.off{background:var(--co);animation:none}
@keyframes ping{70%{box-shadow:0 0 0 9px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
/* tabs */
.stTabs [data-baseweb="tab-list"]{gap:.4rem;padding:.35rem;border:1px solid var(--edge);border-radius:14px;background:var(--glass);backdrop-filter:blur(12px);width:fit-content;max-width:100%;}
.stTabs [data-baseweb="tab"]{color:var(--mut);font-weight:600;padding:.55rem 1.1rem;border-radius:10px;transition:all .2s ease;cursor:pointer;}
.stTabs [data-baseweb="tab"]:hover{color:var(--txt);background:rgba(34,211,238,.08);}
.stTabs [aria-selected="true"]{color:#03141b!important;background:linear-gradient(135deg,var(--cy),var(--em));}
.stTabs [data-baseweb="tab-highlight"],.stTabs [data-baseweb="tab-border"]{display:none;}
/* forms: panel kaca */
[data-testid="stForm"]{border:1px solid var(--edge)!important;border-radius:18px!important;background:var(--glass);backdrop-filter:blur(14px);padding:1.2rem 1.3rem!important;box-shadow:0 14px 50px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);transition:border-color .25s,transform .25s;}
[data-testid="stForm"]:hover{border-color:rgba(34,211,238,.45)!important;transform:translateY(-2px);}
div[data-baseweb="input"],div[data-baseweb="select"]>div,textarea{background:rgba(5,16,28,.8)!important;border-color:var(--edge)!important;border-radius:10px!important;transition:border-color .2s,box-shadow .2s;}
div[data-baseweb="input"]:focus-within,div[data-baseweb="select"]>div:focus-within,textarea:focus{border-color:var(--cy)!important;box-shadow:0 0 0 3px rgba(34,211,238,.18);}
label,[data-testid="stWidgetLabel"] p{color:var(--mut)!important;font-weight:500;}
.stButton>button,.stFormSubmitButton>button{position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--edge);background:rgba(255,255,255,.04);color:var(--txt);font-weight:600;cursor:pointer;min-height:44px;transition:transform .18s ease,box-shadow .2s,border-color .2s;}
.stButton>button:hover,.stFormSubmitButton>button:hover{border-color:var(--cy);color:var(--cy);transform:translateY(-1px);}
.stButton>button[kind="primary"],.stFormSubmitButton>button[kind="primary"]{background:linear-gradient(135deg,var(--cy),var(--em));color:#03141b;border:none;box-shadow:0 8px 28px rgba(34,211,238,.28);}
.stButton>button[kind="primary"]:hover,.stFormSubmitButton>button[kind="primary"]:hover{color:#03141b;box-shadow:0 10px 36px rgba(34,211,238,.5);}
.stButton>button[kind="primary"]::after,.stFormSubmitButton>button[kind="primary"]::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:shine 4.5s ease-in-out infinite;}
@keyframes shine{0%,60%{left:-60%}100%{left:130%}}
/* statistik */
.stat{display:grid;grid-template-columns:repeat(5,1fr);gap:0;border:1px solid var(--edge);border-radius:18px;background:var(--glass);backdrop-filter:blur(14px);margin:1rem 0 .9rem;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.35);}
.stat div{padding:1.1rem 1.3rem;border-right:1px solid var(--edge);position:relative;}
.stat div:last-child{border-right:none}
.stat div::before{content:"";position:absolute;left:0;top:0;height:2px;width:100%;background:linear-gradient(90deg,var(--cy),transparent);opacity:.6}
.cnt{display:block;font-family:'Orbitron',sans-serif;font-size:2rem;font-weight:700;line-height:1.15;color:var(--txt);animation:count 1.6s cubic-bezier(.2,.7,.2,1) forwards;counter-reset:num var(--num);}
.cnt::after{content:counter(num);}
@keyframes count{from{--num:0}to{--num:var(--v)}}
.stat span.l{color:var(--mut);font-size:.85rem}
@media(max-width:800px){.stat{grid-template-columns:repeat(2,1fr)}}
/* alur validasi (urutan nyata PoA) */
.flow{display:flex;align-items:center;gap:0;margin:0 0 1.4rem;overflow-x:auto;padding:.2rem 0 .6rem;}
.flow .n{flex:none;padding:.55rem .95rem;border:1px solid var(--edge);border-radius:12px;background:var(--glass);font-size:.82rem;color:var(--txt);white-space:nowrap}
.flow .n i{font-style:normal;color:var(--cy);font-weight:700;margin-right:.5rem;font-family:'Orbitron',sans-serif}
.flow .a{flex:1;min-width:26px;height:2px;background:linear-gradient(90deg,transparent,var(--cy),transparent);background-size:200% 100%;animation:flow 2.2s linear infinite;}
@keyframes flow{from{background-position:200% 0}to{background-position:-200% 0}}
/* NFT 3D */
.nftwrap{perspective:1100px;padding:.6rem 0;}
.nft{position:relative;width:100%;max-width:330px;margin:auto;border-radius:22px;padding:1.2rem;background:linear-gradient(160deg,rgba(18,48,72,.95),rgba(6,18,30,.95));transform-style:preserve-3d;animation:tilt 9s ease-in-out infinite;box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 60px rgba(34,211,238,.18);overflow:hidden;}
.nft::before{content:"";position:absolute;inset:0;border-radius:22px;padding:2px;background:conic-gradient(from var(--ang),var(--cy),var(--em),var(--gd),var(--cy));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:spin 6s linear infinite;}
.nft::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.14) 48%,transparent 66%);background-size:250% 100%;animation:holo 5s ease-in-out infinite;pointer-events:none;}
@keyframes spin{to{--ang:360deg}} @keyframes holo{0%{background-position:150% 0}100%{background-position:-100% 0}}
@keyframes tilt{0%,100%{transform:rotateY(-12deg) rotateX(4deg)}50%{transform:rotateY(12deg) rotateX(-4deg)}}
.nft-top{display:flex;align-items:center;gap:.6rem;font-family:'Orbitron',sans-serif;font-size:.8rem;letter-spacing:.1em}
.nft-top svg{width:30px;height:30px}.nft-top em{margin-left:auto;font-style:normal}
.holo{height:150px;margin:1rem 0;border-radius:14px;display:grid;place-items:center;background:radial-gradient(circle at 50% 50%,rgba(34,211,238,.25),rgba(5,16,28,.2) 70%),repeating-linear-gradient(0deg,rgba(125,211,252,.07) 0 1px,transparent 1px 8px);border:1px solid var(--edge);transform:translateZ(30px);}
.holo svg{width:90px;height:90px;filter:drop-shadow(0 0 16px rgba(34,211,238,.8));animation:float 4s ease-in-out infinite;}
@keyframes float{50%{transform:translateY(-8px) rotate(6deg)}}
.nft-id{font-family:'Orbitron',sans-serif;font-size:1.9rem;font-weight:900;background:linear-gradient(90deg,var(--cy),var(--gd));-webkit-background-clip:text;background-clip:text;color:transparent;transform:translateZ(40px)}
.nft p{margin:.2rem 0;color:var(--mut);font-size:.9rem}.nft small{color:var(--em);font-size:.72rem;overflow-wrap:anywhere}
.badge{display:inline-block;padding:.18rem .75rem;border-radius:999px;font-size:.75rem;font-weight:700;border:1px solid;background:rgba(0,0,0,.25)}
.s0{color:#93C5FD;border-color:#93C5FD}.s1{color:var(--gd);border-color:var(--gd)}.s2{color:var(--em);border-color:var(--em)}.s3{color:#A5B4FC;border-color:#A5B4FC}
.kv{margin:0;border:1px solid var(--edge);border-radius:18px;padding:1rem 1.3rem;background:var(--glass);backdrop-filter:blur(14px);}
.kv dt{color:var(--mut);font-size:.78rem;margin-top:.7rem}.kv dt:first-child{margin-top:0}
.kv dd{margin:.1rem 0 0;color:var(--txt);font-size:.88rem;overflow-wrap:anywhere;font-family:ui-monospace,Consolas,monospace}
.step{display:flex;gap:.8rem;align-items:center;margin:.4rem 0;color:var(--mut);}
.dot{width:12px;height:12px;border-radius:50%;background:var(--em);box-shadow:0 0 12px var(--em);flex:none;}
.me{border:1px solid var(--edge);border-radius:12px;padding:.65rem 1rem;background:rgba(5,16,28,.8);font-size:.85rem;overflow-wrap:anywhere;font-family:ui-monospace,Consolas,monospace;color:var(--cy)}
[data-testid="stDataFrame"]{border:1px solid var(--edge);border-radius:14px;overflow:hidden}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.cnt{--num:var(--v)}}
</style>
""", unsafe_allow_html=True)

# =========================================================
# HERO 3D (three.js): untaian blok + heliks DNA
# =========================================================
HERO = """
<html><head><link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
<style>
html,body{margin:0;height:100%;overflow:hidden;background:radial-gradient(900px 520px at 72% 45%,#0b3550,#050B14 72%);font-family:'Exo 2',sans-serif;color:#E6F1F5}
canvas{position:absolute;inset:0}
.t{position:absolute;left:48px;top:50%;transform:translateY(-54%);max-width:44%;pointer-events:none}
.t>*{opacity:0;animation:up .9s cubic-bezier(.2,.7,.2,1) forwards}
.brand{display:flex;align-items:center;gap:14px;margin-bottom:22px;animation-delay:.1s}
.brand svg{width:64px;height:64px;filter:drop-shadow(0 0 14px #22d3ee99)}
.brand .hx{stroke-dasharray:190;stroke-dashoffset:190;animation:draw 1.6s .2s ease-out forwards}
.brand span{font:700 15px Orbitron,sans-serif;letter-spacing:.28em;color:#22D3EE}
h1{font:900 clamp(30px,4.6vw,62px)/1.06 Orbitron,sans-serif;margin:0 0 18px;letter-spacing:-.01em;text-shadow:0 4px 40px #000c;animation-delay:.3s;
 background:linear-gradient(100deg,#fff 20%,#9ff3e4 60%,#F5C46B);-webkit-background-clip:text;background-clip:text;color:transparent}
p{margin:0;font-size:clamp(14px,1.45vw,18px);color:#b4cad4;line-height:1.6;max-width:430px;animation-delay:.55s}
.c{position:absolute;left:48px;bottom:58px;display:flex;gap:10px;flex-wrap:wrap;opacity:0;animation:up .9s .8s forwards}
.c i{font-style:normal;font-size:12px;padding:7px 14px;border:1px solid #1f6a7c;border-radius:99px;color:#9ff3e4;background:#06141bcc;backdrop-filter:blur(8px)}
.c i:nth-child(2){color:#F5C46B;border-color:#7a5a1c}
.ecg{position:absolute;left:0;right:0;bottom:0;height:46px;width:100%;opacity:.8}
.ecg path{fill:none;stroke:#34D399;stroke-width:2;stroke-dasharray:420 1100;stroke-dashoffset:1520;animation:beat 3.4s linear infinite;filter:drop-shadow(0 0 6px #34D399)}
.ecg .base{stroke:#16414a;stroke-dasharray:none;animation:none;filter:none;stroke-width:1}
@keyframes beat{to{stroke-dashoffset:0}}@keyframes draw{to{stroke-dashoffset:0}}
@keyframes up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@media(max-width:760px){.t{max-width:90%;top:34%}.c{bottom:52px;left:20px}.t{left:20px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;opacity:1!important}.brand .hx{stroke-dashoffset:0}}
</style></head><body>
<div class="t"><div class="brand"><svg viewBox="0 0 64 64"><defs><linearGradient id="lgh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#34D399"/></linearGradient></defs>
<path class="hx" d="M32 4 56 18v28L32 60 8 46V18z" fill="rgba(34,211,238,.1)" stroke="url(#lgh)" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 20h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="url(#lgh)"/>
<g fill="#F5C46B"><circle cx="32" cy="4" r="2.6"/><circle cx="56" cy="18" r="2.2"/><circle cx="56" cy="46" r="2.2"/><circle cx="32" cy="60" r="2.6"/><circle cx="8" cy="46" r="2.2"/><circle cx="8" cy="18" r="2.2"/></g></svg><span>MEDICHAIN EHR</span></div>
<h1>Rekam medis yang dimiliki pasien</h1><p>Setiap rekam medis menjadi satu NFT yang divalidasi authority dan dijaga blockchain. Data sensitif tetap terenkripsi di luar rantai.</p></div>
<div class="c"><i>Proof of Authority</i><i>NFT ERC-721</i><i>Enkripsi off-chain</i></div>
<svg class="ecg" viewBox="0 0 1100 46" preserveAspectRatio="none"><path class="base" d="M0 28H1100"/><path d="M0 28H180l12-4 12 4h60l10-22 14 40 10-18h40l12-6 12 6H520l12-4 12 4h60l10-22 14 40 10-18h40l12-6 12 6H1100"/></svg>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const N=__N__, still=matchMedia('(prefers-reduced-motion: reduce)').matches;
const W=()=>innerWidth,Hh=()=>innerHeight,off=()=>W()>900?3.5:0;
const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.setSize(W(),Hh());document.body.appendChild(r.domElement);
const s=new THREE.Scene(),cam=new THREE.PerspectiveCamera(46,W()/Hh(),.1,100);cam.position.set(0,1.2,14);
s.add(new THREE.AmbientLight(0x88ddff,.5));
const p1=new THREE.PointLight(0x22D3EE,2.6,60);p1.position.set(6,6,8);s.add(p1);
const p2=new THREE.PointLight(0xF5C46B,2,60);p2.position.set(-7,-3,6);s.add(p2);
const world=new THREE.Group();s.add(world);world.position.x=off();
function tex(c){const k=document.createElement('canvas');k.width=k.height=128;const x=k.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,c+'ff');g.addColorStop(.35,c+'44');g.addColorStop(1,c+'00');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(k)}
const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:tex('#22d3ee'),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.75}));glow.scale.set(10,10,1);world.add(glow);
const gold=new THREE.MeshStandardMaterial({color:0xF5C46B,emissive:0xb8801f,emissiveIntensity:.9,metalness:.6,roughness:.25});
const cy=new THREE.MeshStandardMaterial({color:0x22D3EE,emissive:0x0b7d92,emissiveIntensity:.95,roughness:.3});
const em=new THREE.MeshStandardMaterial({color:0x34D399,emissive:0x0b7d54,emissiveIntensity:.9,roughness:.3});
const cross=new THREE.Group();cross.add(new THREE.Mesh(new THREE.BoxGeometry(.55,1.8,.55),gold),new THREE.Mesh(new THREE.BoxGeometry(1.8,.55,.55),gold));world.add(cross);
const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(2.3,1),new THREE.MeshBasicMaterial({color:0x22D3EE,wireframe:true,transparent:true,opacity:.2}));world.add(shell);
const helix=new THREE.Group(),sg=new THREE.SphereGeometry(.12,14,14),lm=new THREE.LineBasicMaterial({color:0x9ff3e4,transparent:true,opacity:.28});
for(let i=0;i<72;i++){const y=(i/72-.5)*7.4,a=i*.4,x=Math.cos(a)*1.55,z=Math.sin(a)*1.55;
 const A=new THREE.Mesh(sg,cy);A.position.set(x,y,z);const B=new THREE.Mesh(sg,em);B.position.set(-x,y,-z);helix.add(A,B);
 if(i%2==0)helix.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([A.position,B.position]),lm));}
world.add(helix);
const rings=[];[[3.4,.4,0],[3.9,-.9,.5]].forEach((q,i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(q[0],.014,8,160),new THREE.MeshBasicMaterial({color:i?0xF5C46B:0x22D3EE,transparent:true,opacity:.5}));
 m.rotation.set(q[1]+1.2,q[2],0);const sat=new THREE.Mesh(new THREE.SphereGeometry(.1,12,12),i?gold:cy);m.add(sat);world.add(m);rings.push({m,sat,R:q[0],sp:i?-.011:.014,a:i*2})});
const ring=new THREE.Group();ring.rotation.set(.4,0,-.16);world.add(ring);
const bg=new THREE.BoxGeometry(.95,.95,.95),eg=new THREE.EdgesGeometry(bg),cg=new THREE.IcosahedronGeometry(.2,0),R=5,pts=[],blocks=[];
for(let i=0;i<N;i++){const last=i==N-1,a=i/N*Math.PI*1.8,g=new THREE.Group();
 g.add(new THREE.Mesh(bg,new THREE.MeshPhysicalMaterial({color:0x0e2a3a,transparent:true,opacity:.6,roughness:.1,metalness:.3,emissive:last?0x6b4e12:0x0a4050,emissiveIntensity:.75})));
 g.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:last?0xF5C46B:0x22D3EE})));g.add(new THREE.Mesh(cg,last?gold:cy));
 g.position.set(Math.cos(a)*R,Math.sin(a*2)*.4,Math.sin(a)*R);ring.add(g);blocks.push(g);pts.push(g.position);}
const pulses=[];for(let i=0;i<N-1;i++){ring.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[i],pts[i+1]]),new THREE.LineBasicMaterial({color:0xF5C46B,transparent:true,opacity:.55})));
 const p=new THREE.Mesh(new THREE.SphereGeometry(.07,10,10),gold);ring.add(p);pulses.push({p,i,t:Math.random()})}
const crosses=[],pm=new THREE.MeshBasicMaterial({color:0x34D399,transparent:true,opacity:.35}),bx=new THREE.BoxGeometry(.06,.22,.06),by=new THREE.BoxGeometry(.22,.06,.06);
for(let i=0;i<18;i++){const c=new THREE.Group();c.add(new THREE.Mesh(bx,pm),new THREE.Mesh(by,pm));c.position.set((Math.random()-.5)*26,(Math.random()-.5)*12,-4+Math.random()*6);c.userData.v=.004+Math.random()*.008;s.add(c);crosses.push(c)}
const pa=[];for(let i=0;i<700;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(9+Math.random()*11);pa.push(v.x,v.y,v.z)}
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(pa,3));
const stars=new THREE.Points(pg,new THREE.PointsMaterial({color:0x9ff3e4,size:.05,transparent:true,opacity:.6}));s.add(stars);
let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/W()-.5;my=e.clientY/Hh()-.5});
addEventListener('resize',()=>{r.setSize(W(),Hh());cam.aspect=W()/Hh();cam.updateProjectionMatrix();world.position.x=off()});
let t=0,k=still?1:0;const ease=x=>1-Math.pow(1-x,3);
function loop(){t+=.01;if(k<1)k=Math.min(1,k+.012);const e=ease(k);world.scale.setScalar(.3+.7*e);
 if(!still){helix.rotation.y+=.006;shell.rotation.y-=.004;shell.rotation.x+=.002;cross.rotation.y+=.012;ring.rotation.y-=.0028;stars.rotation.y+=.0004;
  blocks.forEach(b=>{b.rotation.x+=.006;b.rotation.y+=.009});
  rings.forEach(o=>{o.a+=o.sp*3;o.sat.position.set(Math.cos(o.a)*o.R,Math.sin(o.a)*o.R,0)});
  pulses.forEach(o=>{o.t=(o.t+.008)%1;o.p.position.lerpVectors(pts[o.i],pts[o.i+1],o.t)});
  crosses.forEach(c=>{c.position.y+=c.userData.v;c.rotation.y+=.01;if(c.position.y>7)c.position.y=-7});
  glow.scale.setScalar(10+Math.sin(t*2)*.5);world.position.y=Math.sin(t)*.12;}
 cam.position.x+=(mx*2.4-cam.position.x)*.04;cam.position.y+=(1.2-my*1.8-cam.position.y)*.04;cam.lookAt(world.position.x*.5,0,0);r.render(s,cam);requestAnimationFrame(loop)}loop();
</script></body></html>
"""


# =========================================================
# KOMPONEN METAMASK (dari app.py dosen, dirapikan)
# =========================================================
WALLET_HTML = """<div><button id="cw" type="button">Connect Wallet</button><p id="ws">Wallet belum terhubung.</p></div>"""
WALLET_CSS = """
button{padding:.65rem 1.1rem;border:none;border-radius:10px;background:linear-gradient(135deg,#22D3EE,#34D399);color:#03141b;font-weight:700;cursor:pointer;font-family:inherit}
p{color:#9DB4C0;overflow-wrap:anywhere;font-size:.88rem;font-family:inherit}
"""
WALLET_JS = """
export default function(component){
  const {parentElement,setStateValue}=component;
  const btn=parentElement.querySelector("#cw"),st=parentElement.querySelector("#ws");
  let on=true;
  async function push(accts){
    const chainId=await window.ethereum.request({method:"eth_chainId"});
    if(!on)return;
    const ok=!!(accts&&accts.length);
    setStateValue("wallet",{address:ok?accts[0]:"",chainId:chainId,connected:ok});
    st.textContent=ok?"Wallet terhubung: "+accts[0]:"Wallet belum terhubung.";
  }
  const read=()=>window.ethereum.request({method:"eth_accounts"}).then(push).catch(()=>{});
  async function connect(){
    if(!window.ethereum){st.textContent="MetaMask tidak ditemukan. Pasang ekstensi MetaMask.";return;}
    try{st.textContent="Menunggu persetujuan di MetaMask...";
      await window.ethereum.request({method:"eth_requestAccounts"});await read();}
    catch(e){st.textContent="Koneksi gagal: "+(e.message||"kesalahan tidak diketahui");}
  }
  btn.addEventListener("click",connect);
  if(window.ethereum){window.ethereum.on("accountsChanged",push);window.ethereum.on("chainChanged",read);read();}
  return()=>{on=false;btn.removeEventListener("click",connect);
    if(window.ethereum&&window.ethereum.removeListener){
      window.ethereum.removeListener("accountsChanged",push);window.ethereum.removeListener("chainChanged",read);}};
}
"""
wallet_component = components.component(
    name="ehr_metamask_wallet", html=WALLET_HTML, css=WALLET_CSS, js=WALLET_JS
)

# =========================================================
# HELPER
# =========================================================
ERR = {
    "NotOwner": "Hanya owner kontrak yang boleh melakukan ini.",
    "NotAuthority": "Validasi konsensus gagal: akun ini bukan authority.",
    "InvalidInput": "Input tidak valid. Periksa semua isian (NIK harus 16 karakter).",
    "InvalidAddress": "Alamat wallet tidak valid.",
    "WalletAlreadyUsed": "Wallet ini sudah dipakai oleh peran lain (satu wallet satu peran).",
    "PatientAlreadyRegistered": "Pasien sudah terdaftar.",
    "EntityAlreadyRegistered": "Dokter/RS sudah terdaftar.",
    "PatientNotFound": "Pasien tidak ditemukan.",
    "DoctorNotFound": "Dokter tidak ditemukan atau belum terverifikasi.",
    "EntityNotFound": "ID dokter/RS tidak valid.",
    "RecordNotFound": "Rekam medis tidak ditemukan.",
    "AccessDenied": "Akses ditolak: akun ini tidak punya hak akses ke data pasien.",
    "NotPatient": "Hanya pasien pemilik data yang boleh mengubah akses.",
    "InvalidTarget": "Target tidak valid (harus dokter atau rumah sakit).",
    "AccessAlreadyActive": "Akses sudah aktif.",
    "NoActiveAccess": "Tidak ada akses aktif untuk dicabut.",
    "InvalidStatusTransition": "Transisi status tidak valid. Urutannya harus maju satu langkah.",
    "NoHistory": "Belum ada riwayat rekam medis.",
    "ERC721InsufficientApproval": "Transfer ditolak: akun ini bukan pemilik NFT.",
    "ERC721NonexistentToken": "Token ID belum ada.",
}


def logo(i):
    return (f'<svg viewBox="0 0 64 64" role="img" aria-label="Logo Rekam Medis Pasien"><defs><linearGradient id="{i}" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#34D399"/></linearGradient></defs>'
            f'<path d="M32 4 56 18v28L32 60 8 46V18z" fill="rgba(34,211,238,.1)" stroke="url(#{i})" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<path d="M28 20h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="url(#{i})"/>'
            '<g fill="#F5C46B"><circle cx="32" cy="4" r="2.6"/><circle cx="56" cy="18" r="2.2"/><circle cx="56" cy="46" r="2.2"/>'
            '<circle cx="32" cy="60" r="2.6"/><circle cx="8" cy="46" r="2.2"/><circle cx="8" cy="18" r="2.2"/></g></svg>')


def hx(b):
    s = b.hex() if isinstance(b, (bytes, bytearray)) else str(b)
    return s if s.startswith("0x") else "0x" + s


def b32(s):
    return bytes.fromhex(s[2:] if s.startswith("0x") else s)


def short(v):
    if isinstance(v, (bytes, bytearray)):
        return hx(v)[:10] + "…"
    if isinstance(v, str) and v.startswith("0x") and len(v) > 14:
        return v[:6] + "…" + v[-4:]
    return str(v)


def when(ts):
    return datetime.fromtimestamp(ts).strftime("%d %b %Y, %H:%M:%S") if ts else "-"


def load_abi():
    for p in [BASE / "EHR_abi.json", BASE / "artifacts/contracts/EHR.sol/EHR.json", BASE / "artifacts/EHR.json"]:
        if p.exists():
            d = json.loads(p.read_text())
            return d["abi"] if isinstance(d, dict) else d
    return None


def cipher():
    key = STORE / ".key"
    if not key.exists():
        key.write_bytes(Fernet.generate_key())
    return Fernet(key.read_bytes())


# =========================================================
# KONEKSI BLOCKCHAIN
# =========================================================
w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 8}))
rpc_ok = w3.is_connected()
abi = load_abi()

with st.sidebar:
    st.markdown("### Pengaturan")
    addr_in = st.text_input("Alamat kontrak EHR", key="addr", placeholder="0x… dari hasil deploy")
    st.caption(f"RPC: {RPC_URL}")
    st.markdown(f"Hardhat RPC: **{'terhubung' if rpc_ok else 'mati'}**")
    st.markdown(f"ABI kontrak: **{'siap' if abi else 'tidak ditemukan'}**")
    st.caption("Setiap node Hardhat di-restart, kontrak harus di-deploy ulang dan alamat baru dimasukkan di sini.")

C = None
if rpc_ok and abi and Web3.is_address(addr_in or ""):
    addr = Web3.to_checksum_address(addr_in)
    if w3.eth.get_code(addr) not in (b"", b"\x00"):
        C = w3.eth.contract(address=addr, abi=abi)

SELECTORS = {}
for item in abi or []:
    if item.get("type") == "error":
        sig = item["name"] + "(" + ",".join(i["type"] for i in item["inputs"]) + ")"
        SELECTORS[Web3.keccak(text=sig)[:4].hex().removeprefix("0x")] = item["name"]


def explain(e):
    s = str(e)
    m = re.search(r"custom error '(\w+)", s)
    name = m.group(1) if m else None
    if not name:
        m = re.search(r"0x([0-9a-fA-F]{8})", s)
        name = SELECTORS.get(m.group(1).lower()) if m else None
    return ERR.get(name, f"Transaksi ditolak: {s[:220]}")


def ledger():
    rows = []
    if C is None:
        return rows
    for ev in ["AuthorityAdded", "PatientRegistered", "EntityRegistered", "RecordCreated",
               "RecordStatusUpdated", "AccessGranted", "AccessRevoked", "Transfer"]:
        try:
            for l in getattr(C.events, ev).get_logs(from_block=0):
                det = ", ".join(f"{k}={short(v)}" for k, v in l["args"].items() if k != "timestamp")
                rows.append({"Blok": l["blockNumber"], "Event": ev, "Detail": det,
                             "Tx": short(l["transactionHash"])})
        except Exception:
            pass
    return sorted(rows, key=lambda r: -r["Blok"])


rows = ledger()
count = lambda ev: sum(1 for r in rows if r["Event"] == ev)
n_rec = count("RecordCreated")

# =========================================================
# HERO + STATISTIK
# =========================================================
st.markdown(
    f'<div class="nav">{logo("lgn")}<b>MEDICHAIN EHR</b><span class="sp"></span>'
    f'<span class="pill"><span class="live{"" if rpc_ok else " off"}"></span>Hardhat {"online" if rpc_ok else "offline"}</span>'
    '<span class="pill">Proof of Authority</span></div>', unsafe_allow_html=True)
hero_doc = HERO.replace("__N__", str(min(max(n_rec, 8), 14)))
if hasattr(st, "iframe"):          # Streamlit baru
    st.iframe(hero_doc, height=560)
else:                              # Streamlit lama
    legacy.html(hero_doc, height=560)

if "flash" in st.session_state:
    msg, tx = st.session_state.pop("flash")
    st.success(msg)
    if tx:
        st.code(tx)

if not rpc_ok:
    st.error("Hardhat RPC tidak dapat diakses. Jalankan 'npx hardhat node' di terminal lain.")
    st.stop()
if abi is None:
    st.error("File EHR_abi.json tidak ditemukan. Letakkan di folder yang sama dengan app.py.")
    st.stop()

cells = [(w3.eth.block_number, "Blok terbaru"), (count("PatientRegistered"), "Pasien terdaftar"),
         (count("EntityRegistered"), "Dokter dan RS"), (n_rec, "Rekam medis (NFT)"), (w3.eth.chain_id, "Chain ID")]
st.markdown('<div class="stat">' + "".join(
    f'<div><b class="cnt" style="--v:{v}" aria-label="{v}"></b><span class="l">{l}</span></div>' for v, l in cells) + '</div>'
    '<div class="flow"><span class="n"><i>1</i>Input</span><span class="a"></span><span class="n"><i>2</i>Validasi kontrak</span><span class="a"></span>'
    '<span class="n"><i>3</i>Authority menandatangani</span><span class="a"></span><span class="n"><i>4</i>Blok ditambahkan</span><span class="a"></span>'
    '<span class="n"><i>5</i>NFT dicetak</span></div>', unsafe_allow_html=True)

if C is None:
    st.info(
        "Masukkan alamat kontrak EHR di sidebar. Belum punya? Jalankan di terminal kedua:\n\n"
        "`npx hardhat run scripts/deploy.js --network localhost`\n\n"
        "Pastikan deploy.js memakai nama kontrak `EHR`. Salin 'Alamat kontrak' dari hasilnya."
    )
    st.stop()

# =========================================================
# DOMPET + PERAN AKTIF
# =========================================================
accts = w3.eth.accounts
_roles = {}


def role_of(a):
    if a in _roles:
        return _roles[a]
    if C.functions.isAuthority(a).call():
        r = "Authority"
    elif C.functions.patientIdOf(a).call() != ZERO32:
        r = "Pasien"
    else:
        eid = C.functions.entityIdOf(a).call()
        if eid != ZERO32:
            ent = C.functions.getEntity(eid).call()
            r = f"{'Dokter' if ent[2] == 1 else 'RS'} {ent[3]}"
        else:
            r = "Belum terdaftar"
    _roles[a] = r
    return r


def lab(a):
    return f"{role_of(a)} · {short(a)}"


def pid_of(a):
    return C.functions.patientIdOf(a).call()


def eid_of(a):
    return C.functions.entityIdOf(a).call()


st.markdown("#### Dompet dan peran")
cw, ca = st.columns([1, 1])
with cw:
    wr = wallet_component(key="ehr_mm", default={"wallet": {"address": "", "chainId": "", "connected": False}},
                          on_wallet_change=lambda: None)
    wl = wr.wallet
    mm = None
    if wl and wl.get("connected") and wl.get("address"):
        mm = Web3.to_checksum_address(wl["address"])
        try:
            cid = int(wl["chainId"], 16)
        except (ValueError, TypeError):
            cid = None
        if cid != w3.eth.chain_id:
            st.warning("Jaringan MetaMask berbeda dengan Hardhat. Pilih jaringan Hardhat Local.")
        elif mm in accts:
            bal = w3.from_wei(w3.eth.get_balance(mm), "ether")
            st.caption(f"Saldo MetaMask: {float(bal):,.4f} ETH · peran: {role_of(mm)}")
        else:
            st.caption("Wallet ini bukan akun bawaan Hardhat, jadi belum bisa dipakai menandatangani di demo ini.")

if mm and mm in accts and st.session_state.get("last_mm") != mm:
    st.session_state["actor"] = mm
    st.session_state["last_mm"] = mm
with ca:
    actor = st.selectbox("Bertindak sebagai", accts, format_func=lab, key="actor",
                         help="Akun ini yang menekan tombol (msg.sender). Salah peran akan ditolak kontrak.")
    st.markdown(f'<div class="me">{H.escape(actor)}</div>', unsafe_allow_html=True)


def pick(label, key, only=None):
    return st.selectbox(label, accts, format_func=lab, key=key)


def send(fn, label, extra=None):
    try:
        with st.spinner("Authority memvalidasi dan menandatangani blok…"):
            h = fn.transact({"from": actor})
            rc = w3.eth.wait_for_transaction_receipt(h, timeout=30)
        if rc.status != 1:
            raise RuntimeError("Transaksi gagal")
        note = extra(rc) if extra else ""
        st.session_state["flash"] = (f"{label} berhasil di blok {rc.blockNumber}. {note}", hx(h))
        st.rerun()
    except st.errors.StreamlitAPIException:
        raise
    except Exception as e:
        if type(e).__name__ in ("RerunException", "StopException"):
            raise
        st.error(explain(e))
    return None


# =========================================================
# TAB
# =========================================================
t1, t2, t3, t4, t5 = st.tabs(["Registrasi", "Rekam medis", "Hak akses", "Baca dan verifikasi", "Ledger"])

# ---------- A. Registrasi ----------
with t1:
    st.caption("Hanya authority yang boleh mendaftarkan pasien, dokter, dan rumah sakit.")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### Pasien baru")
        with st.form("f_pasien"):
            w = pick("Wallet pasien", "rp_w")
            nama = st.text_input("Nama lengkap", "Siti Aminah")
            nik = st.text_input("NIK (16 digit)", "3209012345670001", max_chars=16)
            tgl = st.text_input("Tanggal lahir", "2001-05-17")
            alamat = st.text_input("Alamat", "Jl. Pemuda No. 12 Cirebon")
            gol = st.selectbox("Golongan darah", ["A", "B", "AB", "O"], index=3)
            tel = st.text_input("No. telepon", "081234567890")
            go = st.form_submit_button("Daftarkan pasien", type="primary")
        if go:
            if len(nik) != 16 or not nik.isdigit():
                st.error("NIK harus tepat 16 digit angka.")
            else:
                send(C.functions.registerPatient(w, (nama, nik, tgl, alamat, gol, tel)), "Pasien terdaftar",
                     lambda rc: f"ID pasien: {hx(pid_of(w))}")
    with c2:
        st.markdown("#### Dokter atau rumah sakit")
        with st.form("f_entity"):
            w = pick("Wallet dokter / RS", "re_w")
            role = st.radio("Peran", ["Dokter", "Rumah Sakit"], horizontal=True)
            en = st.text_input("Nama", "dr. Hamdan, M.Kom")
            izin = st.text_input("Nomor izin", "STR-3209-0001")
            det = st.text_input("Spesialisasi (dokter) atau alamat (RS)", "Spesialis Penyakit Dalam")
            go = st.form_submit_button("Daftarkan", type="primary")
        if go:
            send(C.functions.registerEntity(w, en, izin, det, 1 if role == "Dokter" else 2), f"{role} terdaftar",
                 lambda rc: f"ID: {hx(eid_of(w))}")

# ---------- B. Rekam medis ----------
with t2:
    st.caption("Data medis dienkripsi dan disimpan off-chain. Blockchain hanya menyimpan hash-nya, lalu NFT dicetak ke wallet pasien.")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### Buat rekam medis")
        if Fernet is None:
            st.error("Pasang library enkripsi dulu: python -m pip install cryptography")
        with st.form("f_rec"):
            pw = pick("Pasien", "cr_p")
            dw = pick("Dokter", "cr_d")
            dx = st.text_area("Diagnosis", "Hipertensi stadium 1", height=70)
            lb = st.text_area("Hasil lab", "Tekanan darah 150/95 mmHg", height=70)
            rx = st.text_area("Resep obat", "Amlodipine 5 mg, 1x sehari", height=70)
            meta = st.text_input("Metadata publik (non-sensitif)", "Rawat Jalan - Poli Umum")
            go = st.form_submit_button("Simpan dan cetak NFT", type="primary", disabled=Fernet is None)
        if go:
            pid, did = pid_of(pw), eid_of(dw)
            if pid == ZERO32:
                st.error("Wallet pasien belum terdaftar sebagai pasien.")
            elif did == ZERO32:
                st.error("Wallet dokter belum terdaftar.")
            else:
                enc = cipher().encrypt(json.dumps({"diagnosis": dx, "hasil_lab": lb, "resep_obat": rx}).encode())
                dh = Web3.keccak(enc)
                f = STORE / (hx(dh)[2:] + ".enc")
                f.write_bytes(enc)
                rc = send(C.functions.createRecord(pid, did, dh, "local://" + f.name, meta), "Rekam medis dibuat",
                          lambda rc: "Token ID: " + str(C.events.RecordCreated().process_receipt(rc)[0]["args"]["recordId"]))
                if rc is None and f.exists():
                    f.unlink()
    with c2:
        st.markdown("#### Perbarui status")
        with st.form("f_status"):
            rid = st.number_input("Token ID rekam medis", min_value=1, value=1, step=1, key="us_id")
            dw = pick("Dokter", "us_d")
            ns = st.selectbox("Status baru", [1, 2, 3], format_func=lambda i: STATUS[i])
            go = st.form_submit_button("Perbarui status", type="primary")
        if go:
            did = eid_of(dw)
            if did == ZERO32:
                st.error("Wallet dokter belum terdaftar.")
            else:
                send(C.functions.updateRecordStatus(int(rid), did, ns), f"Status menjadi {STATUS[ns]}")
        st.markdown("#### Transfer NFT")
        with st.form("f_tf"):
            tid = st.number_input("Token ID", min_value=1, value=1, step=1, key="tf_id")
            to = pick("Penerima", "tf_to")
            go = st.form_submit_button("Transfer NFT")
        if go:
            send(C.functions.transferFrom(actor, to, int(tid)), f"NFT #{int(tid)} dipindah")
        st.caption("Transfer hanya memindahkan kepemilikan token. Hak akses data tetap melekat pada ID pasien.")

# ---------- C. Hak akses ----------
with t3:
    st.caption("Pasien yang mengendalikan siapa yang boleh membaca datanya. Pilih akun pasien di 'Bertindak sebagai'.")
    c1, c2 = st.columns(2)
    pw = c1.selectbox("Pasien", accts, format_func=lab, key="ac_p")
    tw = c2.selectbox("Dokter / RS", accts, format_func=lab, key="ac_t")
    pid, tid_ = pid_of(pw), eid_of(tw)
    if pid == ZERO32 or tid_ == ZERO32:
        st.warning("Pilih wallet pasien dan wallet dokter/RS yang sudah terdaftar.")
    else:
        active = C.functions.hasAccess(tid_, pid).call()
        st.markdown(
            f'<div class="step"><span class="dot" style="background:{"#2DD4A7" if active else "#FF7A6B"};'
            f'box-shadow:0 0 12px {"#2DD4A7" if active else "#FF7A6B"}"></span>'
            f'Akses saat ini: <b>{"AKTIF" if active else "tidak aktif"}</b></div>', unsafe_allow_html=True)
        b1, b2, _ = st.columns([1, 1, 3])
        if b1.button("Beri akses", type="primary"):
            send(C.functions.grantAccess(pid, tid_), "Akses diberikan")
        if b2.button("Cabut akses"):
            send(C.functions.revokeAccess(pid, tid_), "Akses dicabut")

# ---------- D. Baca dan verifikasi ----------
with t4:
    st.caption("Pembacaan memakai akun yang sedang aktif. Hanya pasien pemilik data atau dokter/RS berizin yang boleh membaca.")
    rid = st.number_input("Token ID rekam medis", min_value=1, value=1, step=1, key="rd_id")
    if st.button("Baca rekam medis", type="primary"):
        try:
            rec = C.functions.getRecord(int(rid)).call({"from": actor})
            owner = C.functions.getRecordOwner(int(rid)).call()
            hist = C.functions.getStatusHistory(int(rid)).call({"from": actor})
            cl, cr = st.columns([1, 1.25])
            cl.markdown(
                f'<div class="nftwrap"><div class="nft"><div class="nft-top">{logo("lgc")}<span>EHR NFT</span>'
                f'<em class="badge s{rec[6]}">{STATUS[rec[6]]}</em></div>'
                f'<div class="holo"><svg viewBox="0 0 64 64"><path d="M28 12h8v16h16v8H36v16h-8V36H12v-8h16z" fill="#22D3EE"/></svg></div>'
                f'<div class="nft-id">#{rec[0]}</div><p>{H.escape(rec[3])}</p><small>{hx(rec[4])}</small></div></div>', unsafe_allow_html=True)
            cr.markdown(
                f'<dl class="kv"><dt>Pemilik NFT</dt><dd>{owner}</dd><dt>ID pasien</dt><dd>{hx(rec[1])}</dd>'
                f'<dt>ID dokter</dt><dd>{hx(rec[2])}</dd><dt>Referensi off-chain</dt><dd>{H.escape(rec[5])}</dd>'
                f'<dt>Dibuat</dt><dd>{when(rec[7])}</dd><dt>Diperbarui</dt><dd>{when(rec[8])}</dd></dl>', unsafe_allow_html=True)
            st.markdown("##### Perjalanan status")
            steps = [f'<div class="step"><span class="dot"></span>ADDED · {when(rec[7])}</div>']
            steps += [f'<div class="step"><span class="dot"></span>{STATUS[h[1]]} · {when(h[3])}</div>' for h in hist]
            st.markdown("".join(steps), unsafe_allow_html=True)
            st.markdown("##### Data medis off-chain")
            f = STORE / rec[5].replace("local://", "")
            if not f.exists():
                st.info("File terenkripsi tidak ada di folder offchain_store pada komputer ini.")
            else:
                raw = f.read_bytes()
                ok = C.functions.verifyRecordIntegrity(int(rid), Web3.keccak(raw)).call({"from": actor})
                if ok and Fernet:
                    st.success("Integritas terverifikasi: hash file cocok dengan hash di blockchain.")
                    d = json.loads(cipher().decrypt(raw))
                    st.write("**Diagnosis:**", d["diagnosis"])
                    st.write("**Hasil lab:**", d["hasil_lab"])
                    st.write("**Resep obat:**", d["resep_obat"])
                else:
                    st.error("Integritas data gagal: hash file tidak cocok dengan blockchain.")
        except Exception as e:
            st.error(explain(e))
    st.divider()
    st.markdown("#### Riwayat pasien")
    hp = st.selectbox("Pasien", accts, format_func=lab, key="hp")
    if st.button("Tampilkan riwayat"):
        pid = pid_of(hp)
        if pid == ZERO32:
            st.warning("Wallet ini bukan pasien terdaftar.")
        else:
            try:
                h = C.functions.getPatientHistory(pid).call({"from": actor})
                st.dataframe(pd.DataFrame([{"Token": r[0], "Metadata": r[3], "Status": STATUS[r[6]],
                                            "Dibuat": when(r[7]), "Diperbarui": when(r[8])} for r in h]),
                             use_container_width=True, hide_index=True)
            except Exception as e:
                st.error(explain(e))

# ---------- E. Ledger ----------
with t5:
    st.caption("Jejak audit dari seluruh event kontrak, terbaru di atas.")
    if rows:
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    else:
        st.info("Belum ada transaksi. Mulai dari tab Registrasi.")
