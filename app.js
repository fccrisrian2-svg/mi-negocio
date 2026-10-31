/* ===== Mi Negocio: app.js ===== */
const $=s=>document.querySelector(s);
let db={products:[],sales:[],last:'',cfg:{}},cart=[],tab='sell',range='d',method='Efectivo';
const money=n=>'$'+(+n||0).toLocaleString('es-AR',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const num=id=>parseFloat($('#'+id).value)||0;

/* ---- Guardado en el teléfono (IndexedDB) ---- */
const openDB=()=>new Promise((ok,ko)=>{const r=indexedDB.open('negocio',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=ko});
async function load(){const d=await openDB();return new Promise(ok=>{const q=d.transaction('kv').objectStore('kv').get('db');q.onsuccess=()=>{if(q.result)db=q.result;db.expenses=db.expenses||[];db.cash=db.cash||{};db.closes=db.closes||[];db.cfg=db.cfg||{};ok()};q.onerror=ok})}
async function save(){const d=await openDB();d.transaction('kv','readwrite').objectStore('kv').put(db,'db')}

/* ---- Ayudas de pantalla ---- */
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;setTimeout(()=>e.hidden=true,2500)}
function modal(h){const m=$('#modal');m.innerHTML='<div class="sheet">'+h+'</div>';m.hidden=false}
function closeModal(){$('#modal').hidden=true}
const expSoon=()=>{if(!db.cfg.expOn)return[];const lim=new Date(Date.now()-new Date().getTimezoneOffset()*6e4+(db.cfg.expDays||7)*864e5).toISOString().slice(0,10);return db.products.filter(p=>p.exp&&p.stock>0&&p.exp<=lim).sort((a,b)=>a.exp.localeCompare(b.exp))};
function banner(){const b=$('#banner'),bk=db.last!==today(),ex=expSoon().length;if(!bk&&!ex){b.hidden=true;return}
b.hidden=false;b.innerHTML=(bk?'<span>Falta el backup de hoy</span><button id="bk">Hacer backup</button>':'')+(ex?`<span>⚠️ ${ex} producto(s) por vencer</span><button id="vx">Ver</button>`:'');
if(bk)$('#bk').onclick=backup;if(ex)$('#vx').onclick=()=>go('more')}

/* ---- Navegación ---- */
const TABS=[['sell','🛒','Vender'],['prod','📦','Productos'],['caja','💵','Caja'],['bal','📊','Balance'],['more','⚙️','Más']];
function go(t){tab=t;$('#nav').innerHTML=TABS.map(([k,i,n])=>`<button class="${k==t?'on':''}" data-t="${k}"><span>${i}</span>${n}</button>`).join('');
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.t));
({sell:viewSell,prod:viewProd,caja:viewCaja,bal:viewBal,more:viewMore})[t]();banner()}

/* ---- VENDER ---- */
function viewSell(){
$('#app').innerHTML=`<div class="row"><input id="q" placeholder="Buscar producto…" autocomplete="off"><button id="scan" class="ic">📷</button></div>
<div id="sug"></div><div class="row"><button id="manual" class="ghost">+ Producto sin código</button></div><div id="cart"></div>`;
$('#q').oninput=sug;$('#scan').onclick=()=>scan(addByCode);$('#manual').onclick=manualItem;drawCart()}
function sug(){const t=$('#q').value.trim().toLowerCase();if(!t){$('#sug').innerHTML='';return}
const l=db.products.filter(p=>p.name.toLowerCase().includes(t)||p.code===t)
.sort((a,b)=>b.name.toLowerCase().startsWith(t)-a.name.toLowerCase().startsWith(t)).slice(0,8);
$('#sug').innerHTML=l.map(p=>`<button class="sg" data-id="${p.id}"><b>${esc(p.name)}</b><span>${money(p.price)} · stock ${p.stock}</span></button>`).join('')||'<p class="mut">No hay coincidencias</p>';
document.querySelectorAll('.sg').forEach(b=>b.onclick=()=>{add(db.products.find(p=>p.id==b.dataset.id));$('#q').value='';sug();$('#q').focus()})}
function add(p){const c=cart.find(x=>x.pid===p.id);c?c.qty++:cart.push({pid:p.id,name:p.name,price:p.price,cost:p.cost,cat:p.cat||'',qty:1});drawCart()}
function addByCode(code){const p=db.products.find(x=>x.code===code);
if(p){add(p);toast('Agregado: '+p.name)}else if(confirm('Código '+code+' no registrado. ¿Crear producto?'))prodForm(null,code)}
function manualItem(){modal(`<h3>Producto sin código</h3><label>Nombre<input id="m_n"></label>
<div class="two"><label>Precio<input id="m_p" type="number" inputmode="decimal"></label><label>Costo (opcional)<input id="m_c" type="number" inputmode="decimal"></label></div>
<div class="row"><button id="m_ok">Agregar</button><button class="ghost" onclick="closeModal()">Cancelar</button></div>`);
$('#m_ok').onclick=()=>{if(!num('m_p'))return toast('Poné el precio');cart.push({pid:null,name:$('#m_n').value||'Varios',price:num('m_p'),cost:num('m_c'),qty:1});closeModal();drawCart()}}
const total=()=>cart.reduce((s,i)=>s+i.price*i.qty,0);
function drawCart(){const c=$('#cart');if(!c)return;
if(!cart.length){c.innerHTML='<p class="mut">La venta está vacía. Buscá o escaneá un producto.</p>';return}
c.innerHTML=cart.map((i,n)=>`<div class="card item"><div><b>${esc(i.name)}</b><br><span class="mut">${money(i.price)} c/u</span></div>
<div class="qty"><button data-m="${n}">−</button><b>${i.qty}</b><button data-p="${n}">+</button></div></div>`).join('')+
`<div class="total">Total ${money(total())}</div><div class="row"><button id="pay">Cobrar</button><button id="clr" class="ghost">Vaciar</button></div>`;
document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const i=cart[b.dataset.m];if(--i.qty<=0)cart.splice(b.dataset.m,1);drawCart()});
document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{cart[b.dataset.p].qty++;drawCart()});
$('#clr').onclick=()=>{cart=[];drawCart()};$('#pay').onclick=checkout}
function checkout(){method='Efectivo';let tot=total();
modal(`<h3 id="tt">Cobrar ${money(tot)}</h3>
<div class="row"><select id="adjt"><option value="d">Descuento %</option><option value="r">Recargo %</option></select><input id="adjv" type="number" inputmode="decimal" placeholder="0"></div>
<div class="meth">${['Efectivo','Transferencia','Tarjeta','Fiado'].map(m=>`<button data-me="${m}" class="${m==method?'on':''}">${m}</button>`).join('')}</div>
<div id="cli" hidden><label>Nombre del cliente<input id="cn"></label><label>Entrega ahora (opcional)<input id="ent" type="number" inputmode="decimal"></label></div>
<div id="tr" hidden>${db.cfg.alias?`<p>Alias: <b>${esc(db.cfg.alias)}</b></p>`:''}${db.cfg.qr?`<img src="${db.cfg.qr}" style="width:100%;max-width:260px;display:block;margin:0 auto 10px;border-radius:10px">`:''}${!db.cfg.alias&&!db.cfg.qr?'<p class="mut">Cargá tu alias o QR en Más</p>':''}</div>
<div id="cash"><label>Paga con<input id="rec" type="number" inputmode="decimal"></label><p class="big" id="chg"></p></div>
<div class="row"><button id="ok">Confirmar venta</button><button class="ghost" onclick="closeModal()">Volver</button></div>`);
const calc=()=>{const v=num('rec')-tot;$('#chg').textContent=num('rec')?(v>=0?'Vuelto '+money(v):'Faltan '+money(-v)):''};
const upd=()=>{const a=Math.round(total()*num('adjv')*($('#adjt').value=='r'?1:-1))/100;tot=Math.round((total()+a)*100)/100;$('#tt').textContent='Cobrar '+money(tot);calc()};
$('#adjt').onchange=upd;$('#adjv').oninput=upd;$('#rec').oninput=calc;
document.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{method=b.dataset.me;document.querySelectorAll('[data-me]').forEach(x=>x.classList.toggle('on',x==b));$('#cash').hidden=method!='Efectivo';$('#cli').hidden=method!='Fiado';$('#tr').hidden=method!='Transferencia'});
$('#ok').onclick=async()=>{const fi=method=='Fiado',cn=fi?$('#cn').value.trim():'';if(fi&&!cn)return toast('Poné el nombre del cliente');
const ent=fi?Math.min(num('ent'),tot):0;
const s={id:uid(),ts:Date.now(),items:cart.map(i=>({...i})),sub:total(),adj:Math.round((tot-total())*100)/100,total:tot,method,client:cn,paid:!fi||ent>=tot,pays:ent>0?[{ts:Date.now(),amount:ent}]:[]};db.sales.push(s);
cart.forEach(i=>{const p=db.products.find(x=>x.id===i.pid);if(p)p.stock-=i.qty});
cart=[];await save();go('sell');const low=db.products.filter(p=>p.stock<=p.min);
modal(`<h3>Venta registrada ✓</h3><p class="mut">${money(s.total)} · ${s.method}${cn?' · '+esc(cn):''}</p>${low.length?'<p class="bad">Stock bajo: '+low.slice(0,3).map(p=>esc(p.name)).join(', ')+'</p>':''}
<div class="row"><button id="tk">Enviar ticket por WhatsApp</button></div><div class="row"><button class="ghost" onclick="closeModal()">Listo</button></div>`);
$('#tk').onclick=()=>sendTicket(s)}}
const pend=x=>x.total-(x.pays||[]).reduce((a,p)=>a+p.amount,0);
function cobrarFiado(id){const x=db.sales.find(y=>y.id==id),pd=pend(x);
modal(`<h3>Cobrar a ${esc(x.client)}</h3><p>Debe ${money(pd)}</p><label>Monto que paga<input id="cf" type="number" inputmode="decimal" value="${pd}"></label><div class="row"><button id="cf_ok">Registrar cobro</button><button class="ghost" onclick="closeModal()">Cancelar</button></div>`);
$('#cf_ok').onclick=async()=>{const m=Math.min(num('cf'),pd);if(m<=0)return toast('Poné un monto');x.pays=x.pays||[];x.pays.push({ts:Date.now(),amount:m});if(m>=pd-0.005)x.paid=true;await save();closeModal();toast('Cobro registrado ✓');viewMore()}}
function sendTicket(s){const t=['*'+(db.shop||'Mi Negocio')+'*',new Date(s.ts).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}),'',...s.items.map(i=>i.qty+' x '+i.name+'  '+money(i.price*i.qty)),'',...(s.adj?[(s.adj<0?'Descuento: ':'Recargo: ')+money(Math.abs(s.adj))]:[]),'*TOTAL '+money(s.total)+'*','Pago: '+s.method+(s.client?' ('+s.client+')':''),'¡Gracias por tu compra!'].join('\n');
window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank')}

/* ---- PRODUCTOS ---- */
function viewProd(){const cats=[...new Set(db.products.map(p=>p.cat).filter(Boolean))].sort();
$('#app').innerHTML=`<div class="row"><input id="pq" placeholder="Buscar en productos…"><button id="new" class="ic">＋</button></div>${cats.length?`<div class="row"><select id="pcat"><option value="">Todas las categorías</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>`:''}<div id="plist"></div>`;
$('#pq').oninput=drawProd;$('#new').onclick=()=>prodForm();if($('#pcat'))$('#pcat').onchange=drawProd;drawProd()}
function drawProd(){const t=$('#pq').value.toLowerCase(),c=$('#pcat')?$('#pcat').value:'';
const l=db.products.filter(p=>p.name.toLowerCase().includes(t)&&(!c||p.cat==c)).sort((a,b)=>a.name.localeCompare(b.name));
$('#plist').innerHTML=l.map(p=>`<button class="item ${p.stock<=p.min?'low':''}" data-e="${p.id}"><span><b>${esc(p.name)}</b><br><small>${p.cat?esc(p.cat)+' · ':''}Stock ${p.stock}${p.stock<=p.min?' · ¡reponer!':''}${db.cfg.expOn&&p.exp?' · vence '+p.exp:''}</small></span><span>${money(p.price)}</span></button>`).join('')||'<p class="mut">No hay productos. Tocá ＋</p>';
document.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>prodForm(b.dataset.e))}
function prodForm(id,code){const p=db.products.find(x=>x.id==id)||{code:code||'',name:'',cat:'',exp:'',cost:'',price:'',stock:'',min:3};
modal(`<h3>${id?'Editar':'Nuevo'} producto</h3><label>Nombre<input id="f_n" value="${esc(p.name)}"></label>
<label>Código de barras (opcional)</label><div class="row"><input id="f_c" value="${esc(p.code)}" inputmode="numeric"><button id="f_s" class="ic">📷</button></div>
<label>Categoría (opcional)<input id="f_cat" list="cats" value="${esc(p.cat||'')}"><datalist id="cats">${[...new Set(db.products.map(x=>x.cat).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
<div class="two"><label>Costo<input id="f_co" type="number" inputmode="decimal" value="${p.cost}"></label><label>Precio de venta<input id="f_p" type="number" inputmode="decimal" value="${p.price}"></label></div>
<div class="two"><label>Stock<input id="f_st" type="number" inputmode="decimal" value="${p.stock}"></label><label>Avisar si queda ≤<input id="f_m" type="number" value="${p.min}"></label></div>
${db.cfg.expOn?'<label>Vence (opcional)<input id="f_ex" type="date" value="'+(p.exp||'')+'"></label>':''}
${id?'<label>Agregar mercadería (se suma al stock)<input id="f_add" type="number" inputmode="decimal" placeholder="Ej: 12"></label>':''}
<div class="row"><button id="f_ok">Guardar</button><button class="ghost" onclick="closeModal()">Cancelar</button></div>${id?'<button id="f_d" class="danger" style="width:100%">Borrar producto</button>':''}`);
$('#f_s').onclick=()=>scan(c=>$('#f_c').value=c);
$('#f_ok').onclick=async()=>{const n=$('#f_n').value.trim(),c=$('#f_c').value.trim();
if(!n||!num('f_p'))return toast('Falta nombre o precio');
if(c&&db.products.some(x=>x.code===c&&x.id!=id))return toast('Ese código ya existe');
const o={id:id||uid(),name:n,code:c,cat:$('#f_cat').value.trim(),exp:db.cfg.expOn?$('#f_ex').value:(p.exp||''),cost:num('f_co'),price:num('f_p'),stock:num('f_st')+(id?num('f_add'):0),min:num('f_m')};
id?Object.assign(p,o):db.products.push(o);await save();closeModal();go(tab);if(!id&&code)addByCode(c)};
if(id)$('#f_d').onclick=async()=>{if(confirm('¿Borrar este producto?')){db.products=db.products.filter(x=>x.id!=id);await save();closeModal();go('prod')}}}

/* ---- BALANCE ---- */
function from(r){const d=new Date();d.setHours(0,0,0,0);if(r=='w')d.setDate(d.getDate()-(d.getDay()+6)%7);if(r=='m')d.setDate(1);return +d}
const ln=(k,v)=>`<div class="row" style="margin:6px 0 0"><span style="flex:1">${k}</span><b>${v}</b></div>`;
const rTabs=()=>`<div class="tabs">${[['d','Hoy'],['w','Semana'],['m','Mes'],['h','Historial']].map(([k,n])=>`<button data-r="${k}" class="${k==range?'on':''}">${n}</button>`).join('')}</div>`;
function viewBal(){if(range=='h')return viewHist();const f=from(range),S=db.sales.filter(x=>x.ts>=f),E=db.expenses.filter(e=>e.ts>=f);
const rev=S.reduce((a,x)=>a+x.total,0),cost=S.reduce((a,x)=>a+x.items.reduce((b,i)=>b+i.cost*i.qty,0),0),gas=E.reduce((a,e)=>a+e.amount,0),net=rev-cost-gas;
const top={},by={},cats={};S.forEach(x=>{by[x.method]=(by[x.method]||0)+x.total;x.items.forEach(i=>{top[i.name]=(top[i.name]||0)+i.qty;const k=i.cat||'Sin categoría';cats[k]=(cats[k]||0)+i.price*i.qty})});
const tl=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);
const ln=(k,v)=>`<div class="row" style="margin:6px 0 0"><span style="flex:1">${k}</span><b>${v}</b></div>`;
$('#app').innerHTML=`${rTabs()}
<div class="stats"><div class="card">Ventas<div class="big">${money(rev)}</div></div><div class="card">Costo mercadería<div class="big">${money(cost)}</div></div>
<div class="card">Gastos<div class="big">${money(gas)}</div></div><div class="card">Ganancia neta<div class="big ${net>=0?'good':'bad'}">${money(net)}</div></div>
<div class="card">Ventas hechas<div class="big">${S.length}</div></div><div class="card">Ticket promedio<div class="big">${money(S.length?rev/S.length:0)}</div></div></div>
<div class="row"><button id="gx" class="ghost">+ Cargar gasto (alquiler, luz…)</button></div>
<div class="card"><b>Por medio de pago</b>${Object.entries(by).map(([k,v])=>ln(k,money(v))).join('')||'<p class="mut">Sin ventas</p>'}</div>
${Object.keys(cats).some(k=>k!='Sin categoría')?`<div class="card"><b>Ventas por categoría</b>${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>ln(esc(k),money(v))).join('')}</div>`:''}
<div class="card"><b>Más vendidos</b>${tl.map(([k,v])=>ln(esc(k),v)).join('')||'<p class="mut">Sin ventas</p>'}</div>
${E.length?`<div class="card"><b>Gastos</b>${E.map(e=>`<div class="row" style="margin:6px 0 0;align-items:center"><span style="flex:1">${esc(e.desc)}</span><b>${money(e.amount)}</b><button class="danger" style="flex:0 0 auto;padding:6px 10px" data-g="${e.id}">✕</button></div>`).join('')}</div>`:''}
<h3>Últimas ventas</h3>${S.slice(-15).reverse().map(x=>`<div class="card item"><span>${new Date(x.ts).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}<br><small class="mut">${x.items.length} ítem(s) · ${x.method}${x.client?' · '+esc(x.client):''}</small></span><span><b>${money(x.total)}</b> <button data-tk="${x.id}">🧾</button> <button class="danger" data-v="${x.id}">Anular</button></span></div>`).join('')}`;
document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{range=b.dataset.r;viewBal()});
document.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>sendTicket(db.sales.find(x=>x.id==b.dataset.tk)));
document.querySelectorAll('[data-g]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Borrar este gasto?'))return;db.expenses=db.expenses.filter(e=>e.id!=b.dataset.g);await save();viewBal()});
$('#gx').onclick=()=>{modal(`<h3>Cargar gasto</h3><label>Detalle<input id="g_d" placeholder="Ej: Luz"></label><label>Monto<input id="g_m" type="number" inputmode="decimal"></label>
<div class="row"><button id="g_ok">Guardar</button><button class="ghost" onclick="closeModal()">Cancelar</button></div>`);
$('#g_ok').onclick=async()=>{if(!num('g_m'))return toast('Poné el monto');db.expenses.push({id:uid(),ts:Date.now(),desc:$('#g_d').value.trim()||'Gasto',amount:num('g_m')});await save();closeModal();viewBal()}};
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Anular y devolver el stock?'))return;
const x=db.sales.find(y=>y.id==b.dataset.v);x.items.forEach(i=>{const p=db.products.find(y=>y.id===i.pid);if(p)p.stock+=i.qty});
db.sales=db.sales.filter(y=>y!==x);await save();viewBal()})}

/* ---- CAJA (cierre del día) ---- */
const cst=(S,E)=>({rev:S.reduce((a,x)=>a+x.total,0),cost:S.reduce((a,x)=>a+x.items.reduce((b,i)=>b+i.cost*i.qty,0),0),gas:E.reduce((a,e)=>a+e.amount,0)});
function viewCaja(){const d=today(),f=from('d'),S=db.sales.filter(x=>x.ts>=f),E=db.expenses.filter(e=>e.ts>=f);
const by=m=>S.filter(x=>x.method==m).reduce((a,x)=>a+x.total,0),c=cst(S,E),ini=db.cash[d]||0,fc=db.sales.reduce((a,x)=>a+(x.pays||[]).filter(q=>q.ts>=f).reduce((b,q)=>b+q.amount,0),0),esp=ini+by('Efectivo')+fc-c.gas,cl=db.closes.find(x=>x.date==d);
$('#app').innerHTML=`<h3>Caja de hoy</h3><div class="card"><label>Efectivo con el que abrís la caja<input id="ini" type="number" inputmode="decimal" value="${ini||''}" ${cl?'disabled':''}></label>
${ln('Ventas en efectivo',money(by('Efectivo')))}${ln('Transferencia',money(by('Transferencia')))}${ln('Tarjeta',money(by('Tarjeta')))}${ln('Fiado vendido (no entra a la caja)',money(by('Fiado')))}${ln('Cobros de fiado de hoy (+)',money(fc))}${ln('Gastos del día (−)',money(c.gas))}
<hr style="border:0;border-top:1px solid var(--line)">${ln('Efectivo que debería haber',money(esp))}${ln('Ganancia neta del día',money(c.rev-c.cost-c.gas))}</div>
${cl?`<div class="card"><b>Caja cerrada ✓</b>${ln('Contado',money(cl.counted))}${ln('Diferencia','<span class="'+(cl.diff<0?'bad':'good')+'">'+money(cl.diff)+'</span>')}<div class="row" style="margin-top:10px"><button id="reab" class="ghost">Reabrir caja</button></div></div>`:
`<div class="card"><label>Efectivo contado ahora<input id="cnt" type="number" inputmode="decimal"></label><p class="big" id="dif"></p><div class="row"><button id="cerrar">Cerrar caja</button></div></div>`}
<h3>Cierres anteriores</h3>${db.closes.slice().reverse().slice(0,10).map(x=>`<div class="card item"><span><b>${x.date}</b><br><small class="mut">Esperado ${money(x.expected)} · Contado ${money(x.counted)}</small></span><b class="${x.diff<0?'bad':'good'}">${money(x.diff)}</b></div>`).join('')||'<p class="mut">Todavía no cerraste ninguna caja</p>'}`;
if(cl){$('#reab').onclick=async()=>{db.closes=db.closes.filter(x=>x.date!=d);await save();viewCaja()};return}
$('#ini').onchange=async()=>{db.cash[d]=num('ini');await save();viewCaja()};
$('#cnt').oninput=()=>{const v=num('cnt')-esp;$('#dif').innerHTML='<span class="'+(v<0?'bad':'good')+'">'+(v==0?'Caja justa ✓':(v>0?'Sobran ':'Faltan ')+money(Math.abs(v)))+'</span>'};
$('#cerrar').onclick=async()=>{if(!$('#cnt').value)return toast('Poné cuánto efectivo contaste');
db.closes.push({date:d,ts:Date.now(),initial:ini,cash:by('Efectivo'),transfer:by('Transferencia'),card:by('Tarjeta'),fiado:by('Fiado'),gastos:c.gas,expected:esp,counted:num('cnt'),diff:num('cnt')-esp,net:c.rev-c.cost-c.gas,sales:S.length});
await save();toast('Caja cerrada ✓');viewCaja()}}

/* ---- HISTORIAL (días, semanas, meses) ---- */
let hmode='d';
function viewHist(){const t=new Date();t.setHours(0,0,0,0);const P=[];
if(hmode=='d')for(let i=0;i<14;i++){const a=new Date(t);a.setDate(t.getDate()-i);const b=new Date(a);b.setDate(a.getDate()+1);P.push([a.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'numeric'}),+a,+b])}
if(hmode=='w'){const m=new Date(t);m.setDate(t.getDate()-(t.getDay()+6)%7);for(let i=0;i<8;i++){const a=new Date(m);a.setDate(m.getDate()-7*i);const b=new Date(a);b.setDate(a.getDate()+7);P.push(['Semana del '+a.toLocaleDateString('es-AR',{day:'numeric',month:'numeric'}),+a,+b])}}
if(hmode=='m')for(let i=0;i<6;i++){const a=new Date(t.getFullYear(),t.getMonth()-i,1),b=new Date(t.getFullYear(),t.getMonth()-i+1,1);P.push([a.toLocaleDateString('es-AR',{month:'long',year:'numeric'}),+a,+b])}
const R=P.map(([l,a,b])=>{const c=cst(db.sales.filter(x=>x.ts>=a&&x.ts<b),db.expenses.filter(e=>e.ts>=a&&e.ts<b));return{l,n:db.sales.filter(x=>x.ts>=a&&x.ts<b).length,rev:c.rev,net:c.rev-c.cost-c.gas}});
const mx=Math.max(1,...R.map(r=>r.rev)),tr=R.reduce((a,r)=>a+r.rev,0),tn=R.reduce((a,r)=>a+r.net,0);
$('#app').innerHTML=`${rTabs()}<div class="tabs">${[['d','Días'],['w','Semanas'],['m','Meses']].map(([k,n])=>`<button data-h="${k}" class="${k==hmode?'on':''}">${n}</button>`).join('')}</div>
<div class="stats"><div class="card">Ventas del período<div class="big">${money(tr)}</div></div><div class="card">Ganancia neta<div class="big ${tn>=0?'good':'bad'}">${money(tn)}</div></div></div>
${R.map(r=>`<div class="card"><div class="row" style="margin:0"><b style="flex:1">${r.l}</b><b>${money(r.rev)}</b></div><div style="height:8px;background:var(--line);border-radius:4px;margin:8px 0"><div style="height:8px;width:${r.rev/mx*100}%;background:var(--main);border-radius:4px"></div></div><small class="mut">${r.n} venta(s) · Ganancia neta </small><b class="${r.net>=0?'good':'bad'}">${money(r.net)}</b></div>`).join('')}`;
document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{range=b.dataset.r;viewBal()});
document.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{hmode=b.dataset.h;viewHist()})}

/* ---- MÁS: backup y recuperar ---- */
function viewMore(){const ex=expSoon(),on=db.cfg.expOn;const fi=db.sales.filter(x=>x.method=='Fiado'&&!x.paid);const low=db.products.filter(p=>p.stock<=p.min);
$('#app').innerHTML=`<div class="card"><label>Nombre del negocio (sale en el ticket)<input id="shop" value="${esc(db.shop||'')}"></label></div>
<div class="card"><b>Fiado pendiente: ${money(fi.reduce((a,x)=>a+pend(x),0))}</b>${fi.map(x=>`<div class="row" style="margin:8px 0 0;align-items:center"><span style="flex:1">${esc(x.client)}<br><small class="mut">${new Date(x.ts).toLocaleDateString('es-AR')} · Debe ${money(pend(x))} de ${money(x.total)}</small></span><button data-c="${x.id}" style="flex:0 0 auto">Cobrar</button></div>`).join('')||'<p class="mut">Nadie debe nada</p>'}</div>
<div class="card"><b>Cobro por transferencia / Mercado Pago</b><label>Tu alias o CVU<input id="alias" value="${esc(db.cfg.alias||'')}"></label>
<div class="row"><button id="qrb" class="ghost">${db.cfg.qr?'Cambiar imagen del QR':'Subir imagen de tu QR'}</button>${db.cfg.qr?'<button id="qrx" class="danger" style="flex:0 0 auto">Quitar</button>':''}</div><input type="file" id="qrf" accept="image/*" hidden>
<p class="mut">Se muestra al cobrar con Transferencia. La app no confirma el pago: lo verificás en tu app del banco.</p></div>
<div class="card"><b>Control de vencimientos</b><div class="row" style="margin-top:8px"><button id="expT" class="ghost">${on?'Activado ✓ (tocá para desactivar)':'Desactivado (tocá para activar)'}</button></div>${on?`<label>Avisar con cuántos días de anticipación<input id="expD" type="number" value="${db.cfg.expDays||7}"></label>${ex.map(p=>`<p>${esc(p.name)} · <b class="${p.exp<today()?'bad':''}">${p.exp<today()?'VENCIDO':p.exp}</b> · stock ${p.stock}</p>`).join('')||'<p class="mut">Nada por vencer</p>'}`:'<p class="mut">Opcional. Si lo activás, podés poner la fecha de vencimiento en cada producto que quieras.</p>'}</div>
<div class="card"><b>Clave de acceso</b><p class="mut">${db.cfg.pin?'Activada':'Sin clave'}</p><div class="row"><button id="pinb" class="ghost">${db.cfg.pin?'Cambiar o quitar clave':'Poner clave'}</button></div></div>
<div class="card"><b>Backup</b><p class="mut">Último: ${db.last||'nunca'}</p>
<div class="row"><button id="b1">Hacer backup ahora</button></div><div class="row"><button id="b5" class="ghost">Compartir backup (WhatsApp, Drive…)</button></div><div class="row"><button id="b2" class="ghost">Recuperar datos</button></div>
<input type="file" id="file" accept=".json,application/json" hidden></div>
<div class="card"><b>Exportar ventas a Excel (CSV)</b><div class="row" style="margin-top:8px"><button id="b3" class="ghost">Descargar CSV</button></div></div>
<div class="card"><b>Productos con poco stock (${low.length})</b>${low.map(p=>`<p>${esc(p.name)}: <b class="bad">${p.stock}</b></p>`).join('')||'<p class="mut">Todo bien</p>'}</div>`;
$('#shop').onchange=async e=>{db.shop=e.target.value.trim();await save()};document.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{cobrarFiado(b.dataset.c)});$('#alias').onchange=async e=>{db.cfg.alias=e.target.value.trim();await save()};
$('#qrb').onclick=()=>$('#qrf').click();if($('#qrx'))$('#qrx').onclick=async()=>{db.cfg.qr='';await save();viewMore()};
$('#qrf').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=async()=>{const k=Math.min(1,600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);db.cfg.qr=c.toDataURL('image/jpeg',.9);await save();viewMore()};im.src=URL.createObjectURL(f)};
$('#expT').onclick=async()=>{db.cfg.expOn=!db.cfg.expOn;await save();banner();viewMore()};
if($('#expD'))$('#expD').onchange=async e=>{db.cfg.expDays=Math.max(1,parseInt(e.target.value)||7);await save();banner();viewMore()};
$('#pinb').onclick=pinForm;
$('#b5').onclick=compartir;$('#b1').onclick=backup;$('#b2').onclick=()=>$('#file').click();$('#b3').onclick=csv;
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;
try{const d=JSON.parse(await f.text());if(!Array.isArray(d.products)||!Array.isArray(d.sales))throw 0;
if(!confirm('Esto REEMPLAZA los datos actuales. ¿Seguir?'))return;const pin0=db.cfg.pin||'';db=d;db.cfg=d.cfg||{};db.cfg.pin=pin0;db.expenses=db.expenses||[];db.cash=db.cash||{};db.closes=db.closes||[];await save();toast('Datos recuperados ✓');go('sell')}catch{toast('Archivo no válido')}}}
function bajar(f){const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();a.remove()}
const fileOut=bajar;
function bkFile(){return new File([JSON.stringify({...db,cfg:{...db.cfg,pin:''}})],'backup-negocio-'+today()+'.json',{type:'application/json'})}
async function backup(){try{db.last=today();await save();bajar(bkFile());banner();toast('Backup guardado en Descargas ✓')}catch(e){toast('Error: '+e.message)}}
async function compartir(){const f=bkFile();const movil=/Android|iPhone|iPad/i.test(navigator.userAgent);
if(movil&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:f.name});return}catch(e){if(e.name=='AbortError')return}}
bajar(f);toast(movil?'No se pudo abrir Compartir. Se guardó en Descargas':'En la compu se descarga. Mandalo desde WhatsApp Web con el clip 📎')}
function csv(){const r=['fecha,producto,cantidad,precio,costo,medio'];
db.sales.forEach(s=>s.items.forEach(i=>r.push([new Date(s.ts).toISOString(),'"'+i.name.replace(/"/g,'""')+'"',i.qty,i.price,i.cost,s.method].join(','))));
fileOut(new File([r.join('\n')],'ventas-'+today()+'.csv',{type:'text/csv'}))}

/* ---- Lector de código de barras (cámara) ---- */
function loadZX(){return window.ZXing?Promise.resolve():new Promise((ok,ko)=>{const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
function scan(cb){const b=document.createElement('div');b.id='scanbox';
b.innerHTML='<video id="vid" playsinline muted></video><p>Apuntá al código de barras</p><button id="sx" class="ghost" style="color:#fff;border-color:#fff">Cancelar</button>';
document.body.appendChild(b);let rd;const stop=()=>{try{rd&&rd.reset()}catch{}b.remove()};$('#sx').onclick=stop;
loadZX().then(()=>{rd=new ZXing.BrowserMultiFormatReader();
rd.decodeFromConstraints({video:{facingMode:'environment'}},'vid',r=>{if(r){const t=r.getText();stop();cb(t)}}).catch(()=>{toast('No se pudo abrir la cámara');stop()})})
.catch(()=>{toast('Necesitás internet la primera vez para el lector');stop()})}

/* ---- Clave de acceso ---- */
const sha=async t=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('negocio'+t)))].map(b=>b.toString(16).padStart(2,'0')).join('');
let hiddenAt=0;
function lock(){if(!db.cfg.pin||$('#lock'))return;const l=document.createElement('div');l.id='lock';
l.innerHTML='<div class="sheet" style="margin-top:18vh;text-align:center"><h3>🔒 Mi Negocio</h3><input id="pin" type="password" inputmode="numeric" placeholder="Clave" style="text-align:center;font-size:24px"><div class="row" style="margin-top:10px"><button id="pin_ok">Entrar</button></div><p class="mut" id="pin_f">Olvidé mi clave</p></div>';
document.body.appendChild(l);
const t=async()=>{try{if(await sha($('#pin').value)===db.cfg.pin)l.remove();else{toast('Clave incorrecta');$('#pin').value=''}}catch{toast('Necesita https')}};
$('#pin_ok').onclick=t;$('#pin').onkeydown=e=>{if(e.key=='Enter')t()};
$('#pin_f').onclick=()=>alert('Para recuperar el acceso: borrá los datos de la app (Ajustes del celular > Apps > Mi Negocio > Almacenamiento > Borrar datos), abrila de nuevo y tocá Recuperar datos con tu último backup.');
$('#pin').focus()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(db.cfg.pin&&Date.now()-hiddenAt>12e4)lock()});
function pinForm(){modal(`<h3>Clave de acceso</h3><p class="mut">Si la olvidás, hay que borrar los datos de la app y recuperar el backup. Hacé backup seguido.</p><label>Nueva clave (4 a 8 números)<input id="np" type="password" inputmode="numeric"></label>
<div class="row"><button id="np_ok">Guardar</button>${db.cfg.pin?'<button id="np_x" class="danger">Quitar clave</button>':''}<button class="ghost" onclick="closeModal()">Cancelar</button></div>`);
$('#np_ok').onclick=async()=>{const v=$('#np').value;if(!/^\d{4,8}$/.test(v))return toast('Usá 4 a 8 números');try{db.cfg.pin=await sha(v)}catch{return toast('Necesita https')}await save();closeModal();toast('Clave guardada ✓');viewMore()};
if(db.cfg.pin)$('#np_x').onclick=async()=>{db.cfg.pin='';await save();closeModal();viewMore()}}

/* ---- Arranque ---- */
(async()=>{await load();if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');lock();go('sell')})();
