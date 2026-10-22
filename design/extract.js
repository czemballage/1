// Walks the rendered mockup and writes one compact scene JSON per .screen plus a shared SVG asset table.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.goto('file:///home/user/1/design/doodleflip-ui.html');
const out=await p.evaluate(()=>{
  const assets={};let nA=0;
  const R=v=>Math.round(v*10)/10;
  const col=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    const al=a.length>3?a[3]:1;if(al===0)return null;return [R(a[0]/255*1000)/1000,R(a[1]/255*1000)/1000,R(a[2]/255*1000)/1000,al].map(v=>Math.round(v*1000)/1000)};
  const splitTop=s=>{const o=[];let d=0,c='';for(const ch of s){if(ch==='(')d++;if(ch===')')d--;if(ch===','&&d===0){o.push(c.trim());c=''}else c+=ch}if(c.trim())o.push(c.trim());return o};
  function grads(bi){
    if(!bi||bi==='none')return[];
    const res=[];
    for(const g of splitTop(bi)){
      const m=g.match(/^(linear|radial|conic)-gradient\((.*)\)$/);if(!m)continue;
      const parts=splitTop(m[2]);let ang=180,kind=m[1];
      if(kind==='linear'){const f=parts[0];
        if(/deg/.test(f)){ang=parseFloat(f);parts.shift()}else if(/^to /.test(f)){ang={'to top':0,'to right':90,'to bottom':180,'to left':270}[f]??180;parts.shift()}}
      else if(!/^rgb/.test(parts[0]))parts.shift();
      const stops=parts.map((s,i)=>{const c=col(s);const pm=s.match(/\)\s*([\d.]+)%/);return{c,p:pm?parseFloat(pm[1])/100:null}}).filter(s=>s.c);
      stops.forEach((s,i)=>{if(s.p==null)s.p=stops.length>1?i/(stops.length-1):0});
      res.push({k:kind[0],a:ang,s:stops.map(s=>[...s.c,R(s.p*1000)/1000])});
    }
    return res;
  }
  function shadows(bs){
    if(!bs||bs==='none')return[];
    return splitTop(bs).map(s=>{const c=col(s);const inset=/inset/.test(s);const nums=s.replace(/rgba?\([^)]*\)/,'').replace('inset','').trim().split(/\s+/).map(parseFloat);
      return {i:inset?1:0,x:nums[0]||0,y:nums[1]||0,b:nums[2]||0,s:nums[3]||0,c}}).filter(e=>e.c);
  }
  function radius(cs,w,h){const f=v=>v.endsWith('%')?parseFloat(v)/100*Math.min(w,h):parseFloat(v)||0;
    const r=[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].map(f).map(v=>Math.min(v,Math.min(w,h)/2));
    return r.every(v=>v===r[0])?(r[0]?R(r[0]):0):r.map(R)}
  const hex=c=>{if(!c||c[0]==='#')return c;const m=c.match(/\d+(\.\d+)?/g).map(Number);return '#'+m.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()};
  function asset(svg,color){
    const vb=svg.getAttribute('viewBox');let k=svg.dataset.a;
    if(k&&k[0]==='i'){const q=k.split('|');k=`i|${q[1]}|${hex(q[2]==='currentColor'?color:q[2])}|${q[3]}`}
    else if(!k){const pth=svg.querySelector('path');
      k=vb==='0 0 88 40'?`k|${pth.getAttribute('stroke')}|${pth.getAttribute('stroke-width')}|${pth.getAttribute('stroke-opacity')||1}|${pth.getAttribute('stroke-dasharray')||''}`:vb==='0 0 18 12'?'st0':vb==='0 0 26 12'?'st1':vb==='0 0 880 38'?'w':'?'+vb}
    const v=vb.split(/\s+/).map(Number);
    if(!(k in assets))assets[k]={w:v[2],h:v[3],free:k==='h'||k==='w'?1:0};
    return k;
  }
  const AR=/[؀-ۿ]/;
  function textNode(tn,cs,ox,oy){
    const txt=tn.textContent.replace(/\s+/g,' ').trim();if(!txt)return null;
    const rg=document.createRange();rg.selectNodeContents(tn);const rs=[...rg.getClientRects()];if(!rs.length)return null;
    const bb=rg.getBoundingClientRect();
    const c=col(cs.color);const lines=new Set(rs.map(r=>Math.round(r.top))).size;
    const dir=cs.direction;let al=cs.textAlign;al=al==='center'?'C':(al==='right'||(al==='start'&&dir==='rtl')||(al==='end'&&dir==='ltr'))?'R':'L';
    return {t:'t',s:txt,x:R(bb.left-ox-2),y:R(bb.top-oy),w:R(bb.width+4),h:R(bb.height),f:parseFloat(cs.fontSize),wt:+cs.fontWeight,c,al:lines>1?al:(dir==='rtl'?'R':'L'),ar:AR.test(txt)?1:0,ml:lines>1?1:0,
      lh:cs.lineHeight==='normal'?0:parseFloat(cs.lineHeight)};
  }
  function walk(el,ox,oy,isRoot){
    const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return[];
    const r=el.getBoundingClientRect();
    if(el.tagName.toLowerCase()==='svg'){
      if(r.width<0.5||r.height<0.5)return[];
      return [{t:'s',a:asset(el,cs.color),x:R(r.left-ox),y:R(r.top-oy),w:R(r.width),h:R(r.height),o:+cs.opacity<1?+cs.opacity:undefined}];
    }
    const bg=col(cs.backgroundColor),gs=grads(cs.backgroundImage),sh=shadows(cs.boxShadow);
    const clip=cs.overflow==='hidden';const op=+cs.opacity;
    const visual=isRoot||bg||gs.length||sh.length||clip||op<1||cs.borderTopWidth!=='0px'||el.dataset.name;
    const kids=[];const nx=visual?r.left:ox,ny=visual?r.top:oy;
    for(const ch of el.childNodes){
      if(ch.nodeType===3){const t=textNode(ch,cs,nx,ny);if(t)kids.push(t)}
      else if(ch.nodeType===1)kids.push(...walk(ch,nx,ny,false));
    }
    if(!visual)return kids;
    const n={t:'f',n:el.dataset.name||(typeof el.className==='string'&&el.className.split(' ')[0])||el.tagName.toLowerCase(),x:R(r.left-ox),y:R(r.top-oy),w:R(r.width),h:R(r.height)};
    const fills=[];if(bg)fills.push({k:'s',c:bg});fills.push(...gs.reverse());if(fills.length)n.b=fills;
    const rad=radius(cs,r.width,r.height);if(rad)n.r=rad;
    if(sh.length)n.e=sh;if(clip)n.c=1;if(op<1)n.o=op;
    if(cs.borderTopWidth!=='0px'){n.st={c:col(cs.borderTopColor),w:parseFloat(cs.borderTopWidth)}}
    if(kids.length)n.k=kids;
    return [n];
  }
  const screens=[...document.querySelectorAll('.screen')].map(s=>walk(s,s.getBoundingClientRect().left,s.getBoundingClientRect().top,true)[0]);
  return {assets:Object.entries(assets).map(([k,v])=>[k,v.w,v.h,v.free]),screens};
});
fs.writeFileSync('/home/user/1/design/scenes/assets.json',JSON.stringify(out.assets));
out.screens.forEach((s,i)=>fs.writeFileSync(`/home/user/1/design/scenes/screen${i+1}.json`,JSON.stringify(s)));
console.log('assets',out.assets.length,JSON.stringify(out.assets).length);
out.screens.forEach((s,i)=>console.log(i+1,s.n,JSON.stringify(s).length));
await b.close()})();
