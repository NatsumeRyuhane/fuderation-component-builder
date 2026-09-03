import{p as b}from"./purify.es-2FREwzWT.js";import{e as S}from"./fontAwesomeLoader-SwgzsESP.js";const q=64,L=["a","abbr","audio","b","blockquote","br","button","caption","cite","code","col","colgroup","dd","del","details","div","dl","dt","em","figcaption","figure","h1","h2","h3","h4","h5","h6","hr","i","img","input","ins","kbd","label","li","mark","ol","option","p","pre","progress","q","s","samp","section","select","small","source","span","strong","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","tr","u","ul","var","video","svg","circle","ellipse","g","line","path","polygon","polyline","rect","text"],z=new Set(L),F=new Set(["br","col","hr","img","input","source"]),N=["alt","aria-hidden","aria-label","aria-live","autocomplete","autoplay","checked","class","color","colspan","controls","crossorigin","d","datetime","decoding","dir","disabled","download","fill","focusable","for","height","hidden","href","id","lang","loading","loop","max","maxlength","media","min","minlength","multiple","muted","name","open","pattern","placeholder","playsinline","poster","preload","readonly","rel","required","role","rowspan","rows","scope","selected","sizes","span","src","step","stroke","stroke-linecap","stroke-linejoin","stroke-width","style","tabindex","target","title","type","value","viewBox","width","xmlns","cx","cy","r","rx","ry","x","x1","x2","y","y1","y2","points","preserveAspectRatio"],W=new Set(N.map(n=>n.toLowerCase())),D=new Set(["autoplay","checked","controls","disabled","hidden","loop","multiple","muted","open","playsinline","readonly","required","selected"]),V=/<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)\b([^>]*)>/g,T=/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,U=/<\s*(script|style|iframe|object|embed|template|noscript|math)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi,B={ALLOWED_TAGS:L,ALLOWED_ATTR:N,ALLOW_ARIA_ATTR:!0,ALLOW_DATA_ATTR:!0,ALLOW_UNKNOWN_PROTOCOLS:!1,ALLOWED_URI_REGEXP:/^(?:(?:https?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,FORBID_TAGS:["form","iframe","object","embed","script","style","template","math"],FORBID_ATTR:["action","formaction","srcdoc"],KEEP_CONTENT:!0},v=/<\$\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})\s*\$>/g,G=/<([A-Za-z0-9_\-\u4e00-\u9fa5]{1,64})>([\s\S]*?)<\/\1>/g,R=/\/\*[\s\S]*?\*\//g,j=/([^{}]+)\{([^{}]*)\}/g,Z=/(javascript:|expression\s*\(|@import|url\s*\(\s*['"]?\s*javascript:)/i,Q=/(^|[\s,{>+~])(?:html|body|:root)(?=[\s.#:[>+~,{]|$)/i,X=/@(?:media|supports|keyframes|font-face|layer|container|property)\b/i,K=/^[A-Za-z_][A-Za-z0-9_]*\s*\([\s\S]*\)$/,J=/^([A-Za-z_][A-Za-z0-9_]*)\s*\([\s\S]*\)$/,Y=new Set(["fillInput","saveToLocal","readFromLocal","getWorldInfo","copyText","toast","appendMsg","changeMsg","tempAppendMsg","tempChangeMsg","getMsgContent","getUserAvatar","getCurrentUserAvatar","getCharAvatar","getCurrentCharAvatar","openUrl","setText","setValue","show","hide","addClass","removeClass","setStyle","progress","wait","requireInputEquals"]),ee=/(?:^|[\s;(])(const|let|var|function|if|for|while|return)\b|=>|document\.|window\.|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|new\s+Date\s*\(/i,te=256,h=new Map,ne=8,oe=20;function re(n=[]){const e=Array.isArray(n)?n:String(n||"").split(/[,，;；\n]+/),o=[],t=new Set;for(const r of e){const a=String(r||"").replace(/\s+/g," ").trim().replace(/^#+/,"").replace(/[\x00-\x1f<>|"']/g,"").trim().slice(0,oe);if(!a)continue;const s=a.toLocaleLowerCase();if(!t.has(s)&&(t.add(s),o.push(a),o.length>=ne))break}return o}function se(){if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")return crypto.randomUUID();const n=Math.random().toString(16).slice(2).padEnd(12,"0").slice(0,12),e=Date.now().toString(16).padStart(12,"0").slice(-12);return`${e.slice(0,8)}-${e.slice(8,12)}-4${n.slice(0,3)}-a${n.slice(3,6)}-${n.slice(0,12)}`}function ie(n={}){const e=String(n?.component_id||"").trim().toLowerCase();return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(e)?e:""}function ae(n={}){return!!(n?.market_locked||n?.market_item_id)}function ke(n=[]){return Array.isArray(n)?n.filter(e=>!ae(e)):[]}function ce(n,e){const o=String(n||"");if(o)for(h.delete(o),h.set(o,String(e||""));h.size>te;){const t=h.keys().next().value;if(!t)break;h.delete(t)}}function $e(n){const e=String(n||"");if(!e||!h.has(e))return"";const o=h.get(e)||"";return h.delete(e),h.set(e,o),o}function le(n=""){const e=String(n||"");let o=5381;for(let t=0;t<e.length;t++)o=(o<<5)+o^e.charCodeAt(t);return(o>>>0).toString(36)}function ue(n=""){const e={},o=String(n||"");let t;for(;(t=G.exec(o))!==null;){const r=(t[1]||"").trim(),a=(t[2]||"").trim();r&&(e[r]=a)}return e}function x(n,e){let o=0;for(let t=e-1;t>=0&&n[t]==="\\";t-=1)o+=1;return o%2===1}function O(n=""){const e=[],o=String(n||"");let t=0,r="",a=0,s=0;for(;t<o.length;){if(r){const i=o.indexOf(`
`,t),u=i<0?o.length:i;if(o.slice(t,u).match(new RegExp(`^\\s*${r}{${a},}\\s*$`))){const m=i<0?o.length:i+1;e[e.length-1][1]=m,e[e.length-1][2]=!1,r="",a=0,t=m}else t=i<0?o.length:i+1;continue}if(s>0){const i="`".repeat(s),u=o.indexOf(i,t);if(u<0){e[e.length-1][1]=o.length;break}const l=u+s;e[e.length-1][1]=l,e[e.length-1][2]=!1,s=0,t=l;continue}if(t===0||o[t-1]===`
`){const i=o.slice(t).match(/^\s*(`{3,}|~{3,})/);if(i){const u=t,l=i[1];r=l[0],a=l.length;const d=o.indexOf(`
`,t),m=d<0?o.length:d+1;e.push([u,m,!0]),t=m;continue}}if(o[t]==="`"){let i=1;for(;o[t+i]==="`";)i+=1;s=i,e.push([t,t+i,!0]),t+=i;continue}t+=1}return r&&e.length&&(e[e.length-1][1]=o.length),e}function de(n,e){return e.some(([o,t])=>n>=o&&n<t)}function me(n=""){const e=String(n||"");return e?!!O(e).at(-1)?.[2]:!1}function Pe(n="",e=[],o={}){const t=String(n||"");if(o.enabled===!1)return[{type:"markdown",text:t}];const r=$(e),a=new Map(r.map(l=>[l.name.toLowerCase(),l])),s=[];let c=0,i=0,u;for(v.lastIndex=0;(u=v.exec(t))!==null;){const l=u.index;if(x(t,l))continue;const d=String(u[1]||"").trim(),m=a.get(d.toLowerCase());if(!m||me(t.slice(c,l)))continue;const y=/<\/?\$\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})\s*\$>/g;y.lastIndex=v.lastIndex;let f,_=1,p=null;for(;(f=y.exec(t))!==null;){const H=f.index;if(!(x(t,H)||String(f[1]||"").toLowerCase()!==d.toLowerCase()))if(f[0].startsWith("</")){if(_-=1,_===0){p=f;break}}else _+=1}if(!p){o.streaming&&(l>c&&s.push({type:"markdown",text:t.slice(c,l)}),s.push({type:"component-loading",name:d,text:t.slice(l+u[0].length)}),c=t.length);break}const g={start:l,end:p.index+p[0].length,bodyStart:l+u[0].length,bodyEnd:p.index};if(g.start<c)continue;l>c&&s.push({type:"markdown",text:t.slice(c,l)});const P=t.slice(g.bodyStart,g.bodyEnd);s.push({type:"component",name:d,component:m,args:ue(P),occurrence:i,renderScope:o.renderScope||""}),i+=1,c=g.end,v.lastIndex=c}return c<t.length&&s.push({type:"markdown",text:t.slice(c)}),s.length?s:[{type:"markdown",text:t}]}function He(n=""){const e=String(n||"");if(!e.includes("<$")&&!e.includes("</$"))return e;const o=O(e),t=/<\/?\$\s*[A-Za-z0-9_\-\u4e00-\u9fa5]{1,32}\s*\$>/g;return e.replace(t,(r,a)=>de(a,o)?r:r.replace(/\$/g,"\\$"))}function M(n,e){let o=0;for(let t=e-1;t>=0&&n[t]==="\\";t--)o+=1;return o}function C(n="",e={},o=!1){const t=String(n),r=[];for(let i=0;i<t.length;i++)t[i]==="$"&&r.push(i);let a="",s=0,c=0;for(;c<r.length-1;){const i=r[c],u=r[c+1],l=M(t,i)%2===1,d=M(t,u),m=d%2===1,y=u-d,f=t.slice(i+1,y);if(!(t[i+1]!=="{"&&f.length>=1&&f.length<=q&&!f.includes(`
`))){c+=1;continue}if(l||m){const p=l?i-1:i;let g=t.slice(i,u+1);m&&(g=`${g.slice(0,-2)}$`),a+=t.slice(s,p)+g}else{const p=f in e?e[f]??"":"";a+=t.slice(s,i),a+=o?S(p):String(p),a+="\\".repeat(d)}s=u+1,c+=2}return a+t.slice(s)}function pe(n=""){return String(n).replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi,(e,o,t)=>{const r=Number.parseInt(o||t,o?16:10);return Number.isFinite(r)&&r>=0&&r<=1114111?String.fromCodePoint(r):e}).replace(/&colon;?/gi,":").replace(/&tab;?/gi,"	").replace(/&newline;?/gi,`
`)}function fe(n="",e="",o=""){const t=pe(n).trim();if(!t)return!1;const r=t.replace(/[\u0000-\u0020\u007f]+/g,""),a=r.match(/^([a-z][a-z0-9+.-]*):/i);if(!a)return!0;const s=a[1].toLowerCase(),c=String(e||"").toLowerCase(),i=String(o||"").toLowerCase();return i==="href"?["http","https","mailto","tel"].includes(s):["src","poster"].includes(i)?["http","https","blob"].includes(s)?!0:s!=="data"?!1:i==="poster"||c==="img"?/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);/i.test(r):["video","audio","source"].includes(c)?/^data:(?:video|audio)\/[a-z0-9.+-]+;/i.test(r):!1:!1}function I(n,e,o=""){const t=String(e||"").toLowerCase();return t.startsWith("on")||["action","formaction","srcdoc"].includes(t)||!W.has(t)&&!t.startsWith("aria-")&&!t.startsWith("data-")||["href","src","poster"].includes(t)&&!fe(o,n,t)?null:t==="style"?k(o)||null:t==="target"&&!["_blank","_self"].includes(String(o).toLowerCase())?null:String(o)}function ge(n=""){if(typeof document>"u")return String(n||"");const e=document.createElement("template");return e.innerHTML=String(n||""),e.content.querySelectorAll("*").forEach(o=>{const t=o.tagName.toLowerCase();Array.from(o.attributes).forEach(r=>{const a=I(t,r.name,r.value);a===null?o.removeAttribute(r.name):a!==r.value&&o.setAttribute(r.name,a)}),t==="a"&&o.getAttribute("target")==="_blank"&&o.setAttribute("rel","noopener noreferrer")}),e.innerHTML}function he(n=""){return String(n||"").replace(/<!--[\s\S]*?-->/g,"").replace(U,"").replace(V,(o,t,r,a)=>{const s=String(r||"").toLowerCase();if(!z.has(s))return"";if(t)return F.has(s)?"":`</${s}>`;const c=[];T.lastIndex=0;let i;for(;(i=T.exec(a||""))!==null;){const l=String(i[1]||"").toLowerCase(),d=i[2]!==void 0||i[3]!==void 0||i[4]!==void 0,m=i[2]??i[3]??i[4]??"";if(!d&&D.has(l)){c.push(l);continue}const y=I(s,l,m);y!==null&&c.push(`${l}="${S(y)}"`)}const u=c.length?` ${c.join(" ")}`:"";return`<${s}${u}>`})}function ye(n=""){const e=String(n||"");return b&&typeof b.sanitize=="function"?ge(b.sanitize(e,B)):he(e)}function Se(n=""){const e=String(n||"").replace(/\/\*[\s\S]*?\*\//g,"").split(/[\r\n;]+/).map(o=>o.trim()).filter(o=>o&&!o.startsWith("//")).slice(0,32);return e.length?e.every(o=>{if(!K.test(o))return!1;const t=o.match(J);if(!t)return!1;const r=t[1];if(Y.has(r))return!0;if(typeof window<"u"){const a=window.storyComponentFns;if(a&&typeof a[r]=="function")return!0}return!1}):!0}function we(n=""){const e=String(n||"").trim();return e?ee.test(e):!1}function _e(n={}){const e=String(n?.html||""),o=String(n?.css||"");return!e&&!o?!1:!!(/<\s*(html|head|body)\b/i.test(e)||o.length>1e3||X.test(o)||Q.test(o))}function Ce(n=""){const e=String(n||"").trim();return e?/^--[A-Za-z0-9_-]{1,64}$/.test(e)||/^[A-Za-z][A-Za-z-]{0,63}$/.test(e):!1}function ve(n=""){const e=String(n||"").trim();return!(!e||e.length>256||Z.test(e))}function k(n=""){const o=String(n||"").replace(R,"").split(";"),t=[];for(const r of o){const a=r.indexOf(":");if(a<=0)continue;const s=r.slice(0,a).trim(),c=r.slice(a+1).trim();Ce(s)&&ve(c)&&t.push(`${s}:${c}`)}return t.join(";")}function be(n=""){const e=[],o=String(n||"").replace(R,"").slice(0,1e3);let t;for(;(t=j.exec(o))!==null;){const r=String(t[1]||"").trim(),a=k(t[2]||"");if(!r||!a)continue;const s=r.split(",").map(c=>c.trim()).filter(Boolean).filter(c=>!c.startsWith("@"));for(const c of s)e.push({selector:c,style:a})}return e}function Ae(n="",e=""){const o=String(n||"").trim().replace(/;+\s*$/,""),t=String(e||"").trim().replace(/;+\s*$/,"");return o?t?`${o};${t}`:o:t}function Ee(n="",e=""){const o=String(e||"");if(!o)return{html:String(n||""),wrapperStyle:""};if(typeof document>"u")return{html:String(n||""),wrapperStyle:""};const t=be(o);if(!t.length)return{html:String(n||""),wrapperStyle:""};const r=document.createElement("template");r.innerHTML=String(n||"");for(const a of t){let s=[];try{s=r.content.querySelectorAll(a.selector)}catch{continue}s.forEach(c=>{const i=c.getAttribute("style")||"",u=Ae(i,a.style);u&&c.setAttribute("style",u)})}return{html:r.innerHTML,wrapperStyle:""}}function w(n=""){return`"${String(n||"").replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\r/g,"\\r").replace(/\n/g,"\\n")}"`}function Te(n="",e=""){const o=String(n||"").trim();return o==="fill_input"?`fillInput(${w(e)})`:o==="copy_text"?`copyText(${w(e)})`:o==="toast"?`toast(${w(e)})`:o==="append_msg"?`appendMsg(${w(e)})`:o==="change_msg"?`changeMsg(${w(e)})`:o==="temp_append_msg"?`tempAppendMsg(${w(e)})`:o==="temp_change_msg"?`tempChangeMsg(${w(e)})`:o==="get_msg_content"?"getMsgContent()":""}function E(n=""){return/\\r\\n|\\n|\\r/.test(String(n||""))}function A(n=""){const e=String(n||"");return!e||/[\r\n]/.test(e)||!E(e)?e:e.replace(/\\r\\n/g,`\r
`).replace(/\\n/g,`
`).replace(/\\r/g,"\r")}function xe(n=""){const e=String(n||"");if(!e||/[\r\n]/.test(e)||!E(e))return e;let o="",t=0,r="",a=!1;for(;t<e.length;){const s=e[t],c=t+1<e.length?e[t+1]:"",i=t+2<e.length?e[t+2]:"",u=t+3<e.length?e[t+3]:"";if(r){if(o+=s,a){a=!1,t+=1;continue}if(s==="\\"){a=!0,t+=1;continue}s===r&&(r=""),t+=1;continue}if(s==='"'||s==="'"||s==="`"){r=s,o+=s,t+=1;continue}if(s==="\\"&&c==="r"&&i==="\\"&&u==="n"){o+=`\r
`,t+=4;continue}if(s==="\\"&&c==="n"){o+=`
`,t+=2;continue}if(s==="\\"&&c==="r"){o+="\r",t+=2;continue}o+=s,t+=1}return o}function Me(n={}){if(!n||typeof n!="object")return n;const e=String(n.source||"");return{...n,html:A(n.html||""),css:A(n.css||""),script:xe(n.script||""),ai_prompt:A(n.ai_prompt||""),source:/[\r\n]/.test(e)||!E(e)?e:""}}function qe(n=[]){return Array.isArray(n)?n.map(e=>Me(e)):[]}function $(n=[]){return Array.isArray(n)?n.filter(e=>e&&typeof e=="object").map(e=>{const o=String(e.script||""),t=Te(e.click_action,e.click_value||"");return{component_id:ie(e)||se(),market_item_id:Number.isInteger(Number(e.market_item_id))&&Number(e.market_item_id)>0?Number(e.market_item_id):null,market_revision:Number.isInteger(Number(e.market_revision))&&Number(e.market_revision)>0?Number(e.market_revision):null,market_locked:!!(e.market_locked&&e.market_item_id),name:String(e.name||"").trim().slice(0,32),alias:String(e.alias||"").trim().slice(0,64),tags:re(e.tags),html:String(e.html||""),css:String(e.css||""),script:o||t,source:String(e.source||""),ai_prompt:String(e.ai_prompt||"").slice(0,1e3),description:String(e.description||"").slice(0,120)}}).filter(e=>e.name&&e.html):[]}function ze(n=[]){const e=$(n).filter(t=>t.ai_prompt?.trim());return e.length?["[组件使用说明]","当需要调用组件时，使用以下格式：","<$组件名$>","  <参数名>参数值</参数名>","  </$组件名$>",...e.map(t=>{const r=t.name;return`- 组件 ${r}：使用 "<$${r}$>...</$${r}$>" 包裹，内部可用 <参数>值</参数> 传值。${t.ai_prompt.trim()}`})].join(`
`):""}function Le(n,e={},o="",t={}){const r=C(n.html,e,!0),a=C(n.css||"",e,!1),s=C(n.script||"",e,!1),c=String(t?.userAvatar||""),i=String(t?.charAvatar||"");return`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: http: https:; media-src data: blob: http: https:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none';">
  <style>
    html {
      margin: 0;
      padding: 0;
      min-height: 0 !important;
      height: auto !important;
    }
    body {
      margin: 0;
      padding: 0;
      min-height: 0 !important;
      height: auto !important;
      overflow: hidden !important;
    }
    #story-component-root {
      transform-origin: top left;
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    #story-component-root *, #story-component-root *::before, #story-component-root *::after {
      box-sizing: inherit;
    }
  </style>
  <style>${a}</style>
</head>
<body>
<div id="story-component-root">
${r}
</div>
<script>
// DSL bridge: forward built-in actions to parent via postMessage
window.fillInput = function(text) {
  parent.postMessage({ type: 'story-component-action', action: 'fillInput', value: String(text || '') }, '*')
}
window.copyText = function(text) {
  parent.postMessage({ type: 'story-component-action', action: 'copyText', value: String(text || '') }, '*')
}
window.toast = function(text, level) {
  parent.postMessage({
    type: 'story-component-action',
    action: 'toast',
    value: String(text || ''),
    level: String(level || 'info')
  }, '*')
}
window.appendMsg = function(text) {
  parent.postMessage({ type: 'story-component-action', action: 'appendMsg', value: String(text || '') }, '*')
}
window.changeMsg = function(text) {
  parent.postMessage({ type: 'story-component-action', action: 'changeMsg', value: String(text || '') }, '*')
}
window.tempAppendMsg = function(text) {
  parent.postMessage({ type: 'story-component-action', action: 'tempAppendMsg', value: String(text || '') }, '*')
}
window.tempChangeMsg = function(text) {
  parent.postMessage({ type: 'story-component-action', action: 'tempChangeMsg', value: String(text || '') }, '*')
}
window.__storyComponentMsgContent = ''
window.__storyComponentUserAvatar = ${JSON.stringify(c)}
window.__storyComponentCharAvatar = ${JSON.stringify(i)}
window.__storyComponentActionSeq = 0
window.__storyComponentActionPending = {}
window.__storyComponentRequest = function(action, payload = {}, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const requestId = 'sc_req_' + String(++window.__storyComponentActionSeq)
    let timer = 0
    const cleanup = () => {
      if (timer) clearTimeout(timer)
      delete window.__storyComponentActionPending[requestId]
    }
    window.__storyComponentActionPending[requestId] = (value) => {
      cleanup()
      resolve(value)
    }
    timer = setTimeout(() => {
      if (!window.__storyComponentActionPending[requestId]) return
      cleanup()
      resolve('')
    }, Math.max(300, Math.min(Number(timeoutMs) || 3000, 10000)))
    parent.postMessage({
      type: 'story-component-action',
      action: String(action || ''),
      requestId,
      ...payload
    }, '*')
  })
}
window.saveToLocal = function(variable, value) {
  return window.__storyComponentRequest('saveToLocal', {
    variable: String(variable || ''),
    value: String(value ?? '')
  }).then((ret) => String(ret || ''))
}
window.readFromLocal = function(variable) {
  return window.__storyComponentRequest('readFromLocal', {
    variable: String(variable || '')
  }).then((ret) => String(ret || ''))
}
window.getWorldInfo = function(trigger) {
  return window.__storyComponentRequest('getWorldInfo', {
    trigger: String(trigger ?? '')
  }).then((ret) => Array.isArray(ret) ? ret : [])
}
window.getMsgContent = function() {
  parent.postMessage({ type: 'story-component-action', action: 'getMsgContent' }, '*')
  return String(window.__storyComponentMsgContent || '')
}
window.getUserAvatar = function() {
  parent.postMessage({ type: 'story-component-action', action: 'getUserAvatar' }, '*')
  return String(window.__storyComponentUserAvatar || '')
}
window.getCurrentUserAvatar = window.getUserAvatar
window.getCharAvatar = function() {
  parent.postMessage({ type: 'story-component-action', action: 'getCharAvatar' }, '*')
  return String(window.__storyComponentCharAvatar || '')
}
window.getCurrentCharAvatar = window.getCharAvatar
window.__storyComponentQueryOne = function(selector) {
  const text = String(selector || '').trim()
  if (!text) return null
  if (text === '@host') return document.getElementById('story-component-root')
  if (text.length > 200) return null
  try {
    return document.querySelector(text)
  } catch {
    return null
  }
}
window.__storyComponentSafeMediaValue = function(value) {
  const text = String(value || '').trim()
  return !/(javascript:|data:text\\/html|data:application\\/javascript)/i.test(text)
}
window.__storyComponentSetElementValue = function(el, value) {
  if (!el) return
  const text = String(value ?? '')
  if (
    el instanceof HTMLImageElement ||
    el instanceof HTMLVideoElement ||
    el instanceof HTMLAudioElement ||
    el instanceof HTMLSourceElement
  ) {
    if (window.__storyComponentSafeMediaValue(text)) el.setAttribute('src', text)
    return
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.value = text
    return
  }
  el.textContent = text
}
window.__storyComponentGetElementValue = function(el, trim = true) {
  if (!el) return ''
  let value = ''
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    value = el.value || ''
  } else {
    value = el.textContent || ''
  }
  return trim ? String(value).trim() : String(value)
}
window.__storyComponentSafeStyleProp = function(prop) {
  return /^--[A-Za-z0-9_-]{1,64}$/.test(prop) || /^[A-Za-z][A-Za-z-]{0,63}$/.test(prop)
}
window.__storyComponentSafeStyleValue = function(value) {
  return !/(javascript:|expression\\s*\\(|@import|url\\s*\\(\\s*['"]?\\s*javascript:)/i.test(String(value || ''))
}
window.setText = function(selector, text) {
  const el = window.__storyComponentQueryOne(selector)
  if (el) el.textContent = String(text ?? '')
}
window.setValue = function(selector, value) {
  window.__storyComponentSetElementValue(window.__storyComponentQueryOne(selector), value)
}
window.show = function(selector, displayValue) {
  const el = window.__storyComponentQueryOne(selector)
  if (el) el.style.display = String(displayValue || 'block')
}
window.hide = function(selector) {
  const el = window.__storyComponentQueryOne(selector)
  if (el) el.style.display = 'none'
}
window.addClass = function(selector, className) {
  const el = window.__storyComponentQueryOne(selector)
  const cls = String(className || '').trim()
  if (el && cls) el.classList.add(cls)
}
window.removeClass = function(selector, className) {
  const el = window.__storyComponentQueryOne(selector)
  const cls = String(className || '').trim()
  if (el && cls) el.classList.remove(cls)
}
window.setStyle = function(selector, prop, value) {
  const el = window.__storyComponentQueryOne(selector)
  const name = String(prop || '').trim()
  if (!el || !name) return
  if (name.toLowerCase() === 'src') {
    window.__storyComponentSetElementValue(el, value)
    return
  }
  if (window.__storyComponentSafeStyleProp(name) && window.__storyComponentSafeStyleValue(value)) {
    el.style.setProperty(name, String(value || ''))
  }
}
window.progress = function(barSelector, textSelector, durationMs) {
  const barEl = window.__storyComponentQueryOne(barSelector)
  const textEl = window.__storyComponentQueryOne(textSelector)
  if (!barEl && !textEl) return Promise.resolve()
  const duration = Math.max(200, Math.min(Number(durationMs) || 1400, 10000))
  const start = performance.now()
  return new Promise((resolve) => {
    const tick = (now) => {
      const percent = Math.min(100, Math.round(((now - start) / duration) * 100))
      if (barEl) barEl.style.width = percent + '%'
      if (textEl) textEl.textContent = percent + '%'
      if (percent >= 100) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    if (barEl) barEl.style.width = '0%'
    if (textEl) textEl.textContent = '0%'
    requestAnimationFrame(tick)
  })
}
window.wait = function(ms) {
  const delay = Math.max(0, Math.min(Number(ms) || 0, 10000))
  return new Promise((resolve) => setTimeout(resolve, delay))
}
window.requireInputEquals = function(selector, expected, message, trimValue) {
  const el = window.__storyComponentQueryOne(selector)
  const trim = trimValue === undefined ? true : String(trimValue).toLowerCase() !== 'false'
  const actual = window.__storyComponentGetElementValue(el, trim)
  if (actual !== String(expected ?? '')) {
    window.toast(String(message || '验证失败'))
    return false
  }
  return true
}
window.addEventListener('message', function(event) {
  const data = event && event.data
  if (!data || data.type !== 'story-component-action-result') return
  const requestId = String(data.requestId || '')
  if (requestId) {
    const resolver = window.__storyComponentActionPending[requestId]
    if (resolver) resolver(data.value ?? '')
  }
  if (data.action === 'getMsgContent') {
    window.__storyComponentMsgContent = String(data.value || '')
  } else if (data.action === 'getUserAvatar') {
    window.__storyComponentUserAvatar = String(data.value || '')
  } else if (data.action === 'getCharAvatar') {
    window.__storyComponentCharAvatar = String(data.value || '')
  }
})
<\/script>
<script>
${s}
<\/script>
<script>
(() => {
  const frameId = ${JSON.stringify(String(o||""))}
  const ACTIVE_POLL_INTERVAL = 350
  const ACTIVE_POLL_MAX_TICKS = 12
  let lastHeight = 0
  let rafToken = 0
  let activePollTimer = null
  let pollRestartTimer = 0

  const getScaleFromTransform = (transformText) => {
    const m = String(transformText || '').match(/scale\\(([\\.\\d]+)\\)/)
    if (!m) return 1
    const v = parseFloat(m[1])
    return Number.isFinite(v) && v > 0 ? v : 1
  }

  const autoScaleRoot = () => {
    const root = document.getElementById('story-component-root')
    if (!root || !root.firstElementChild) return
    // 先重置缩放以测量真实尺寸
    root.style.transform = ''
    root.style.width = '100%'
    const child = root.firstElementChild
    const childW = child.scrollWidth || child.offsetWidth || 0
    const viewW = document.documentElement.clientWidth || window.innerWidth || 0
    if (childW > 0 && viewW > 0 && childW > viewW) {
      const scale = viewW / childW
      root.style.transform = 'scale(' + scale + ')'
      root.style.width = childW + 'px'
    }
  }

  const measureRootHeight = (root) => {
    if (!root) return 0

    const scale = getScaleFromTransform(root.style.transform)
    const heights = []
    const pushHeight = (value, alreadyScaled = false) => {
      const numeric = Number(value || 0)
      if (!Number.isFinite(numeric) || numeric <= 0) return
      heights.push(alreadyScaled ? numeric : numeric * scale)
    }

    const rootRect = root.getBoundingClientRect ? root.getBoundingClientRect() : null
    const body = document.body

    const measureNodeRange = (node) => {
      if (!node?.getBoundingClientRect) return
      try {
        const range = document.createRange()
        range.selectNodeContents(node)
        const rect = range.getBoundingClientRect()
        pushHeight(rect?.height, true)
        if (rootRect) {
          pushHeight((rect?.bottom || 0) - rootRect.top, true)
        }
      } catch {}
    }

    measureNodeRange(root.firstElementChild)
    measureNodeRange(body?.firstElementChild)

    if (rootRect && root.querySelectorAll) {
      let maxBottom = Number(rootRect.bottom || 0)
      try {
        root.querySelectorAll('*').forEach((node) => {
          const rect = node?.getBoundingClientRect?.()
          const bottom = Number(rect?.bottom || 0)
          if (Number.isFinite(bottom) && bottom > maxBottom) {
            maxBottom = bottom
          }
        })
      } catch {}
      pushHeight(maxBottom - rootRect.top, true)
    }

    return heights.length ? Math.ceil(Math.max(...heights) + 2) : 0
  }

  const sendHeight = (force = false) => {
    autoScaleRoot()
    const root = document.getElementById('story-component-root')
    const h = measureRootHeight(root)
    if (!Number.isFinite(h) || h <= 0) return
    if (!force && Math.abs(h - lastHeight) <= 1) return
    lastHeight = h
    parent.postMessage({
      type: 'story-component-resize',
      id: frameId,
      height: h
    }, '*')
  }

  const queueSendHeight = (force = false) => {
    if (rafToken) return
    rafToken = requestAnimationFrame(() => {
      rafToken = 0
      sendHeight(force)
    })
  }

  const startActivePolling = (forceRestart = false) => {
    if (activePollTimer) {
      if (!forceRestart) return
      clearInterval(activePollTimer)
      activePollTimer = null
    }
    let ticks = 0
    activePollTimer = setInterval(() => {
      ticks += 1
      queueSendHeight()
      if (ticks >= ACTIVE_POLL_MAX_TICKS) {
        clearInterval(activePollTimer)
        activePollTimer = null
      }
    }, ACTIVE_POLL_INTERVAL)
  }

  const scheduleActivePollingRestart = () => {
    if (pollRestartTimer) return
    pollRestartTimer = setTimeout(() => {
      pollRestartTimer = 0
      startActivePolling(true)
    }, 180)
  }

  // Initial paint + delayed reflow rounds (fonts/images/layout settle)
  queueSendHeight()
  setTimeout(queueSendHeight, 80)
  setTimeout(queueSendHeight, 300)
  setTimeout(queueSendHeight, 800)
  startActivePolling(false)

  const observedRoot = document.getElementById('story-component-root') || document.body || document.documentElement

  if (typeof ResizeObserver !== 'undefined' && observedRoot) {
    const ro = new ResizeObserver(() => queueSendHeight())
    ro.observe(observedRoot)
    if (observedRoot.firstElementChild) {
      ro.observe(observedRoot.firstElementChild)
    }
  }

  if (typeof MutationObserver !== 'undefined' && observedRoot) {
    const mo = new MutationObserver(() => {
      queueSendHeight()
      startActivePolling(false)
      scheduleActivePollingRestart()
    })
    mo.observe(observedRoot, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      characterData: true,
      subtree: true
    })
  }

  window.addEventListener('load', queueSendHeight)
  window.addEventListener('resize', queueSendHeight)
  if (observedRoot) {
    observedRoot.addEventListener('transitionend', queueSendHeight, true)
    observedRoot.addEventListener('animationend', queueSendHeight, true)
  } else {
    document.addEventListener('transitionend', queueSendHeight, true)
    document.addEventListener('animationend', queueSendHeight, true)
  }
  window.addEventListener('message', (event) => {
    const data = event?.data
    if (!data || data.type !== 'story-component-resize-request') return
    if (String(data.id || '') !== frameId) return
    queueSendHeight(true)
  })
})()
<\/script>
</body>
</html>`}function Ne(n,e={},o={},t={}){const r=C(n.script||"",e,!1).trim(),a=!!r&&Se(r);if(!!r&&(we(r)||!a)||!r&&_e(n)){const f=String(t?.renderScope||""),_=JSON.stringify({renderScope:f,name:n?.name||"",html:n?.html||"",css:n?.css||"",script:n?.script||"",args:e,occurrence:Number.isFinite(t?.occurrence)?t.occurrence:0}),p=`sc_${le(_)}`,g=Le(n,e,p,o);return ce(p,g),`<div class="story-inline-component story-inline-component-iframe" data-story-component-frame="1" data-story-frame-id="${S(p)}"></div>`}const c=C(n.html,e,!0),i=ye(c),u=C(n.css||"",e,!1),{html:l,wrapperStyle:d}=Ee(i,u),m=String(l||"").replace(/>\s+</g,"><").trim();return`<div class="story-inline-component${r?" is-clickable":""}" data-story-component="1" data-component-name="${S(n.name)}" data-component-script="${S(r)}" role="${r?"button":"presentation"}" tabindex="${r?"0":"-1"}" style="${S(d)}">${m}</div>`}function Fe(n={},e={}){return n.type==="component-loading"?`<span class="story-inline-component-loading" data-story-component-loading="1" data-component-name="${S(n.name||"")}">${S(n.text||"")}</span>`:n.type!=="component"||!n.component?"":Ne(n.component,n.args||{},{userAvatar:e.userAvatar||"",charAvatar:e.charAvatar||"",renderScope:e.renderScope||""},{occurrence:Number.isFinite(n.occurrence)?n.occurrence:0,renderScope:e.renderScope||n.renderScope||""})}export{Fe as a,He as b,se as c,Me as d,$ as e,ke as f,ie as g,$e as h,ae as i,ze as j,re as n,Pe as p,qe as r};
