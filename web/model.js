/* Модель данных и слияние для синхронизации. Чистые функции без DOM: их же гоняют node-тесты (tests/model.test.js).
   Каждая запись несёт _u (мс). Удаления — надгробия S.tomb{'<коллекция>:<ключ>': _u}. При слиянии побеждает больший _u,
   надгробие побеждает запись, если оно не старше её. Записи без _u считаются _u = 0. */
(function(root){
'use strict';
var CARD=['problems','meds','labs','studies','visits','recs'];
var LISTS=[{n:'tasks',k:'id'},{n:'habits',k:'id'},{n:'bonus',k:'id'},{n:'weights',k:'date'},{n:'phq',k:'date'}]
  .concat(CARD.map(function(n){return {n:n,k:'id',card:1}}));
var OBJS=[{n:'patient',card:1},{n:'private',card:1},{n:'safety'},{n:'settings'}];

function blank(){return {schema:1,card:{patient:{},problems:[],meds:[],labs:[],studies:[],visits:[],recs:[],private:{screening:[],substances:'',family:'',plan:''}},
  tasks:[],habits:[],daily:{},weights:[],phq:[],backups:[],bonus:[],safety:{doctor:'',contact:'',helps:''},settings:{},tomb:{}}}
function getL(S,L){return L.card?S.card[L.n]:S[L.n]}
function setL(S,L,a){if(L.card)S.card[L.n]=a;else S[L.n]=a}
function getO(S,O){return O.card?S.card[O.n]:S[O.n]}
function setO(S,O,v){if(O.card)S.card[O.n]=v;else S[O.n]=v}
function clone(o){return JSON.parse(JSON.stringify(o))}
function isObj(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function sig(r){var o=Object.assign({},r);delete o._u;return JSON.stringify(o)}
function u(r){return (r&&+r._u)||0}
/* Детерминированный id для записей без id: одинаковый на всех устройствах, иначе миграция задвоит записи. */
function hid(s){var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return 'h'+(h>>>0).toString(36)}

function normalize(o){
  var b=blank();if(!isObj(o))return b;var c=isObj(o.card)?o.card:{};
  b.card.patient=Object.assign({},isObj(c.patient)?c.patient:{});
  b.card.private=Object.assign(b.card.private,isObj(c.private)?c.private:{});
  LISTS.forEach(function(L){var a=L.card?c[L.n]:o[L.n];setL(b,L,Array.isArray(a)?a.filter(isObj).map(function(r){return Object.assign({},r)}):[])});
  b.backups=Array.isArray(o.backups)?o.backups.slice():[];
  b.daily=isObj(o.daily)?Object.assign({},o.daily):{};
  b.safety=Object.assign(b.safety,isObj(o.safety)?o.safety:{});b.settings=Object.assign({},isObj(o.settings)?o.settings:{});
  if(isObj(o.tomb))Object.keys(o.tomb).forEach(function(k){var t=+o.tomb[k];if(t>0)b.tomb[k]=t});
  LISTS.forEach(function(L){
    if(L.k!=='id')return;var seen={};
    getL(b,L).forEach(function(r){if(r.id)seen[r.id]=1});
    getL(b,L).forEach(function(r){
      if(r.id)return;var base=hid(L.n+'|'+sig(r)),id=base,n=1;
      while(seen[id])id=base+'-'+(++n);seen[id]=1;r.id=id;
    });
  });
  return b;
}

/* Проставить _u изменённым записям и надгробия удалённым: сравнение состояния до мутации (prev) и после (cur). */
function stamp(prev,cur,now){
  cur.tomb=cur.tomb||{};
  function bump(key,pu){return Math.max(now,pu+1,(cur.tomb[key]||0)+1)}
  LISTS.forEach(function(L){
    var pm={},seen={};
    getL(prev,L).forEach(function(r){var k=r[L.k];if(k!=null)pm[k]={s:sig(r),u:u(r)}});
    getL(cur,L).forEach(function(r){
      var k=r[L.k];if(k==null)return;seen[k]=1;var p=pm[k],tk=L.n+':'+k;
      if(p&&p.s===sig(r)){if(p.u)r._u=p.u;else delete r._u;return}
      r._u=bump(tk,p?p.u:u(r));delete cur.tomb[tk];
    });
    Object.keys(pm).forEach(function(k){if(!seen[k])cur.tomb[L.n+':'+k]=Math.max(now,pm[k].u+1)});
  });
  var pd=prev.daily||{};
  Object.keys(cur.daily).forEach(function(d){
    var r=cur.daily[d],p=pd[d],tk='daily:'+d;if(!isObj(r))return;
    if(p&&sig(p)===sig(r)){if(u(p))r._u=u(p);else delete r._u;return}
    r._u=bump(tk,u(p));delete cur.tomb[tk];
  });
  Object.keys(pd).forEach(function(d){if(!(d in cur.daily))cur.tomb['daily:'+d]=Math.max(now,u(pd[d])+1)});
  OBJS.forEach(function(O){
    var p=getO(prev,O)||{},r=getO(cur,O);
    if(sig(p)===sig(r)){if(u(p))r._u=u(p);else delete r._u}else r._u=Math.max(now,u(p)+1);
  });
  return cur;
}

/* Слияние двух записей при равных _u = 0 (данные до миграции): по старым правилам, без потери отметок.
   Порядок аргументов детерминирован, поэтому результат не зависит от того, какое устройство локальное. */
var COMBINE={
  tasks:function(x,y){return Object.assign({},x,y,{done:x.done||y.done})},
  daily:function(x,y){var h=Object.assign({},x.h||{});Object.keys(y.h||{}).forEach(function(k){if(y.h[k])h[k]=true});return Object.assign({},x,y,{h:h})},
  obj:function(x,y){var o=Object.assign({},x);Object.keys(y).forEach(function(k){var v=y[k];if(Array.isArray(v)?v.length:(v!==''&&v!=null))o[k]=v});return o}
};
function pick(a,b,kind){
  if(!a)return b;if(!b)return a;
  var ua=u(a),ub=u(b);if(ua!==ub)return ua>ub?a:b;
  var sa=JSON.stringify(a),sb=JSON.stringify(b);if(sa===sb)return a;
  if(ua>0)return sa>sb?a:b;
  var x=sa<sb?a:b,y=sa<sb?b:a,c=(COMBINE[kind]||function(x,y){return Object.assign({},x,y)})(x,y);
  c._u=1;return c;
}

function merge(local,remote){
  var A=normalize(clone(local)),B=normalize(clone(remote)),R=normalize(clone(local));
  var tomb=Object.assign({},A.tomb);
  Object.keys(B.tomb).forEach(function(k){tomb[k]=Math.max(tomb[k]||0,B.tomb[k])});
  function alive(key,r){return !(key in tomb)||tomb[key]<u(r)}
  LISTS.forEach(function(L){
    var la=getL(A,L),ra=getL(B,L),rm={},out=[],done={};
    ra.forEach(function(r){var k=r[L.k];if(k!=null)rm[k]=r});
    la.concat(ra).forEach(function(r,i){
      var k=r[L.k];
      if(k==null){if(i<la.length)out.push(r);return}
      if(done[k])return;done[k]=1;
      var w=pick(i<la.length?r:null,rm[k],L.n);
      if(alive(L.n+':'+k,w))out.push(w);
    });
    if(L.k==='date')out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0});
    setL(R,L,out);
  });
  R.daily={};
  Object.keys(A.daily).concat(Object.keys(B.daily)).forEach(function(d){
    if(d in R.daily)return;var w=pick(A.daily[d],B.daily[d],'daily');
    if(isObj(w)&&alive('daily:'+d,w))R.daily[d]=w;
  });
  OBJS.forEach(function(O){setO(R,O,pick(getO(A,O),getO(B,O),'obj'))});
  R.backups=Array.from(new Set(A.backups.concat(B.backups))).sort();
  R.tomb=tomb;R.schema=Math.max(A.schema||1,B.schema||1);
  return R;
}

/* Импорт обновления медкарты от Claude (открытый JSON без _u): добавить, не затирая отметки.
   Записи, удалённые пользователем (есть надгробие), не воскрешаются. Изменённым и новым записям — _u = now. */
function importPlain(base,raw,now){
  var prev=clone(base),inc=normalize(raw),c=base.card,ic=inc.card,tomb=base.tomb||{};
  LISTS.forEach(function(L){setL(inc,L,getL(inc,L).filter(function(r){return !tomb[L.n+':'+r[L.k]]}))});
  /* Новые задачи без названия и отметки без подписи не добавляются: так файл-патч может дополнить поля существующих записей, не создавая пустых */
  function upsert(arr,items,fn,req){items.forEach(function(it){delete it._u;var i=arr.findIndex(function(x){return x.id===it.id});if(i<0){if(!req||it[req])arr.push(it)}else arr[i]=fn?fn(arr[i],it):Object.assign({},arr[i],it)})}
  function upsertBy(arr,items,key){items.forEach(function(it){delete it._u;var i=arr.findIndex(function(x){return x[key]===it[key]});if(i<0)arr.push(it);else arr[i]=it});arr.sort(function(a,b){return a[key]<b[key]?-1:1})}
  Object.keys(ic.patient).forEach(function(k){var v=ic.patient[k];if(k!=='_u'&&v!==''&&v!=null)c.patient[k]=v});
  CARD.forEach(function(k){upsert(c[k],ic[k])});
  Object.keys(ic.private).forEach(function(k){var v=ic.private[k];if(k!=='_u'&&(Array.isArray(v)?v.length:v))c.private[k]=v});
  upsert(base.tasks,inc.tasks,function(a,b){return Object.assign({},a,b,{done:a.done||b.done})},'title');
  upsert(base.habits,inc.habits,null,'label');
  Object.keys(inc.daily).forEach(function(d){
    var a=base.daily[d]||{},v=inc.daily[d]||{},h=Object.assign({},a.h||{});
    Object.keys(v.h||{}).forEach(function(k){if(v.h[k])h[k]=true});
    base.daily[d]=Object.assign({},a,v,{h:h,_u:a._u});
  });
  upsertBy(base.weights,inc.weights,'date');upsertBy(base.phq,inc.phq,'date');
  base.backups=Array.from(new Set(base.backups.concat(inc.backups)));
  upsert(base.bonus,inc.bonus);
  ['doctor','contact','helps'].forEach(function(k){if(inc.safety[k])base.safety[k]=inc.safety[k]});
  Object.keys(inc.settings).forEach(function(k){if(k!=='_u'&&inc.settings[k]!=null&&inc.settings[k]!=='')base.settings[k]=inc.settings[k]});
  return stamp(prev,base,now);
}

/* Равенство по содержимому: без учёта порядка ключей, порядка записей в коллекциях и копий. */
function stable(o){
  if(Array.isArray(o))return '['+o.map(stable).join(',')+']';
  if(isObj(o))return '{'+Object.keys(o).sort().filter(function(k){return o[k]!==undefined}).map(function(k){return JSON.stringify(k)+':'+stable(o[k])}).join(',')+'}';
  return JSON.stringify(o);
}
function canon(S){
  var o=normalize(clone(S));
  LISTS.forEach(function(L){getL(o,L).sort(function(a,b){var x=String(a[L.k]),y=String(b[L.k]);return x<y?-1:x>y?1:0})});
  o.backups=Array.from(new Set(o.backups)).sort();
  return stable(o);
}
function equal(a,b){return canon(a)===canon(b)}

var api={blank:blank,normalize:normalize,stamp:stamp,merge:merge,importPlain:importPlain,clone:clone,equal:equal,LISTS:LISTS};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ZModel=api;
})(typeof self!=='undefined'?self:this);
