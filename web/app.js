(function(){
'use strict';
var SYS={psych:'Психика и сон',resp:'Дыхание',nose:'Нос и пазухи',metab:'Обмен веществ',blood:'Кровь и витамины',gi:'ЖКТ',heart:'Сердце',other:'Прочее'};
var SYS_S={psych:'Психика',resp:'Дыхание',nose:'Нос',metab:'Обмен',blood:'Кровь',gi:'ЖКТ',heart:'Сердце',other:'Прочее'};
var TYPES=['Анализ','Приём','Исследование','Звонок','Запись','Препарат','Процедура','Замер','Другое'];
var MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
var MON_N=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
var LEVELS=['Старт','Разведка','Опора','Ритм','Устойчивость','Прочность','Запас хода','Навигатор','Мастер','Хранитель'];
var MOOD=['','очень тяжело','тяжело','ровно','неплохо','хорошо'];
var SLEEP=['','почти не спал','плохо','так себе','нормально','отлично'];
var CAN=[['none','Не было'],['less','Меньше обычного'],['usual','Как обычно'],['more','Больше обычного']];
var PHQ_Q=['Мало интереса или удовольствия от занятий','Подавленность, безнадёжность','Трудности со сном: засыпание, прерывистый сон или слишком много сна','Усталость, мало сил','Плохой аппетит или переедание','Плохое мнение о себе, ощущение, что подвёл себя или близких','Трудно сосредоточиться на чтении, работе, фильме','Заторможенность или, наоборот, суетливость','Мысли, что лучше было бы умереть, или о том, чтобы причинить себе вред'];
var PHQ_A=['Ни разу','Несколько дней','Больше половины дней','Почти каждый день'];
var CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var IC={
 today:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
 tasks:'<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.6 1.6L8 4.7M3.5 12l1.6 1.6L8 10.7M3.5 18l1.6 1.6L8 16.7"/>',
 card:'<path d="M5 3.5h9.5L19 8v12.5H5z"/><path d="M14.5 3.5V8H19M8.5 12.5h7M8.5 16.5h4.5"/>',
 advice:'<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
 progress:'<path d="M5 20v-8M11 20V5M17 20v-5M3 20.5h18"/>'
};
var TABS=[['today','Сегодня'],['tasks','Задачи'],['card','Медкарта'],['advice','Советы'],['progress','Прогресс']];
var SEGS=[['summary','Сводка'],['meds','Препараты'],['labs','Анализы'],['studies','Исследования'],['visits','Приёмы'],['private','Личное']];

/* ---------- utils ---------- */
function pad(n){return String(n).padStart(2,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function today(){return iso(new Date())}
function parseD(s){var m=String(s||'').match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);if(!m)return null;return new Date(+m[1],(m[2]?+m[2]:1)-1,m[3]?+m[3]:1)}
function addDays(s,n){var d=parseD(s);d.setDate(d.getDate()+n);return iso(d)}
function diffDays(a,b){return Math.round((parseD(a)-parseD(b))/864e5)}
function isFull(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s||''))}
function fmtDate(s,withYear){
  if(!s)return '';var p=String(s).split('-');
  if(p.length===1)return p[0];
  if(p.length===2)return MON_N[+p[1]-1]+' '+p[0];
  var y=+p[0];return (+p[2])+' '+MON[+p[1]-1]+((withYear||y!==new Date().getFullYear())?' '+y:'');
}
function plural(n,f){n=Math.abs(n)%100;var a=n%10;if(n>10&&n<20)return f[2];if(a>1&&a<5)return f[1];if(a===1)return f[0];return f[2]}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function num(v){var n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n}
function fmtNum(v){return Math.abs(v)>=100?Math.round(v):(Math.round(v*10)/10).toString().replace('.',',')}
function byDue(a,b){return (a.due||'9999')<(b.due||'9999')?-1:(a.due||'9999')>(b.due||'9999')?1:0}

/* ---------- state ---------- */
var S=null;
var UI={screen:'boot',tab:'today',day:today(),seg:'summary',filter:'all',adv:'all',open:{},priv:false,pending:null,foreign:null,phq:null,backupFile:null,useRec:false,gateErr:''};
/* blank, normalize, слияние и штампы _u — в model.js */
var M=window.ZModel,blank=M.blank,normalize=M.normalize;
function upsertBy(arr,items,key){
  items.forEach(function(it){var i=arr.findIndex(function(x){return x[key]===it[key]});if(i<0)arr.push(it);else arr[i]=it});
  arr.sort(function(a,b){return a[key]<b[key]?-1:1});
}
/* ---------- XP, levels, achievements ---------- */
function dayXP(v,hx){
  var x=0;if(v.h)Object.keys(v.h).forEach(function(k){if(v.h[k])x+=(hx[k]!=null?hx[k]:3)});
  if(v.mood)x+=5;if(v.sleep)x+=3;
  if(v.can){x+=5;if(v.can==='none')x+=10;else if(v.can==='less')x+=5}
  return x;
}
function ledger(){
  var p={tasks:0,days:0,weights:0,phq:0,backups:0,bonus:0},hx={};
  S.habits.forEach(function(h){hx[h.id]=+h.xp||3});
  S.tasks.forEach(function(t){if(t.done)p.tasks+=(+t.xp||0)});
  Object.keys(S.daily).forEach(function(d){p.days+=dayXP(S.daily[d]||{},hx)});
  p.weights=S.weights.length*15;p.phq=S.phq.length*25;p.backups=new Set(S.backups).size*20;
  p.bonus=S.bonus.reduce(function(a,b){return a+(+b.xp||0)},0);
  var t=0;Object.keys(p).forEach(function(k){t+=p[k]});return {total:t,p:p};
}
function levelOf(xp){var n=1;while(xp>=50*(n+1)*n)n++;var lo=50*n*(n-1),hi=50*(n+1)*n;return {n:n,lo:lo,hi:hi,frac:(xp-lo)/(hi-lo)}}
function levelName(n){return LEVELS[n-1]||('Уровень '+n)}
function loggedDays(){return Object.keys(S.daily).filter(function(d){var v=S.daily[d]||{};return v.mood||v.can||(v.h&&Object.keys(v.h).some(function(k){return v.h[k]}))}).length}
function canDays(kind){return Object.keys(S.daily).filter(function(d){return (S.daily[d]||{}).can===kind}).length}
/* Достижения за конкретные задачи задаются в данных медкарты: task.ach = 'Название'. Препараты для «По схеме» — habit.med = true.
   В коде нет ничего, что описывает конкретного человека. */
function ACH(){
  var done=function(t){return t.done},a=[['first','Первый шаг','Закрыта первая задача',S.tasks.some(done)]];
  S.tasks.forEach(function(t){if(t.ach)a.push(['task:'+t.id,String(t.ach),t.title||'',!!t.done])});
  a.push(['d7','Семь дней заботы','7 дней с отметками, не обязательно подряд',loggedDays()>=7],
    ['d30','Месяц заботы','30 дней с отметками',loggedDays()>=30]);
  var med=S.habits.filter(function(h){return h.med}).map(function(h){return h.id});
  if(med.length)a.push(['meds14','По схеме','14 дней с отмеченными препаратами',Object.keys(S.daily).filter(function(d){var h=(S.daily[d]||{}).h||{};return med.every(function(id){return h[id]})}).length>=14]);
  a.push(['w4','Ровная линия','4 взвешивания',S.weights.length>=4],['phq','Чекпойнты','3 опроса PHQ-9',S.phq.length>=3]);
  if(S.settings.trackLabel)a.push(['c1','Пауза','Первый день с отметкой «Не было»',canDays('none')>=1],
    ['c7','Семь пауз','7 дней с отметкой «Не было», в сумме',canDays('none')>=7],
    ['c30','Тридцать пауз','30 дней с отметкой «Не было», в сумме',canDays('none')>=30]);
  a.push(['bk3','Резервист','3 резервные копии',new Set(S.backups).size>=3],['t10','Десятка','10 закрытых задач',S.tasks.filter(done).length>=10]);
  return a;
}
function achSet(){var s=new Set();ACH().forEach(function(a){if(a[3])s.add(a[0])});return s}

var toastT=null;
function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2200)}
/* nostamp: fn сама расставила _u (слияние, импорт) */
function commit(fn,quiet,nostamp){
  var b=ledger().total,ab=achSet(),prev=nostamp?null:M.clone(S);fn();if(prev)M.stamp(prev,S,Date.now());save();render();
  if(quiet)return;var a=ledger().total,aa=achSet(),msg=[];
  if(a>b)msg.push('+'+(a-b)+' XP');
  if(levelOf(a).n>levelOf(b).n)msg.push('Уровень '+levelOf(a).n);
  ACH().forEach(function(x){if(aa.has(x[0])&&!ab.has(x[0]))msg.push(x[1])});
  if(msg.length)toast(msg.join(', '));
}

/* ---------- small renderers ---------- */
function top(title){return '<header class="top"><h1 class="display">'+esc(title)+'</h1><div class="top-act"><button class="btn sm ghost" data-act="help">Помощь</button><button class="btn sm ghost" data-act="data">Данные</button><button class="btn sm ghost" data-act="security">Защита</button></div></header>'}
function lvlStrip(){
  var led=ledger(),L=levelOf(led.total);
  return '<section class="lvl" aria-label="Уровень"><div class="lvl-n display">'+L.n+'</div><div><div class="lvl-t">'+esc(levelName(L.n))+'</div>'+
    '<div class="bar"><i style="width:'+(L.frac*100).toFixed(1)+'%"></i></div>'+
    '<div class="lvl-s">'+led.total+' XP, до '+(L.n+1)+' уровня осталось '+(L.hi-led.total)+'</div></div></section>';
}
function dueLabel(t){
  if(t.done)return 'сделано '+fmtDate(t.done);if(!t.due)return 'без срока';
  var n=diffDays(t.due,today());
  if(n===0)return 'сегодня';if(n===1)return 'завтра';
  if(n>1)return 'через '+n+' '+plural(n,['день','дня','дней'])+', '+fmtDate(t.due);
  return 'срок был '+fmtDate(t.due);
}
function taskRow(x){
  var key='t'+x.id,o=UI.open[key],late=!x.done&&x.due&&x.due<today();
  var s='<div class="task'+(x.done?' is-done':'')+'"><button class="check" data-act="'+(x.done?'task-undo':'task-done')+'" data-id="'+esc(x.id)+'" aria-pressed="'+(!!x.done)+'" aria-label="'+(x.done?'Вернуть в работу':'Отметить выполненной')+'">'+(x.done?CHECK:'')+'</button>'+
    '<button class="t-main" data-act="open" data-key="'+esc(key)+'" aria-expanded="'+(!!o)+'"><span class="t-title">'+esc(x.title)+'</span>'+
    '<span class="t-meta"><span class="'+(late?'late':'')+'">'+esc(dueLabel(x))+'</span><span class="chip">'+esc(SYS_S[x.system]||'Прочее')+'</span>'+(x.type?'<span>'+esc(x.type)+'</span>':'')+'</span></button>'+
    '<span class="xp">+'+(+x.xp||0)+'</span></div>';
  if(o)s+='<div class="t-more">'+(x.details?'<p>'+esc(x.details)+'</p>':'')+'<div class="acts"><button class="btn sm" data-act="form" data-kind="task" data-id="'+esc(x.id)+'">Изменить</button></div></div>';
  return s;
}
function spark(vals,flag){
  if(vals.length<2)return '';var w=84,h=26,mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),r=(mx-mn)||1;
  var pts=vals.map(function(v,i){return [(i/(vals.length-1))*(w-6)+3,h-3-((v-mn)/r)*(h-6)]});
  var last=pts[pts.length-1];
  return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true"><polyline points="'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' ')+'" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="2.6" fill="currentColor"/></svg>';
}
function refRange(r){
  if(!r)return null;r=String(r).replace(/,/g,'.');var m=r.match(/^\s*([\d.]+)\s*[–\-—]\s*([\d.]+)/);
  if(m)return [+m[1],+m[2]];m=r.match(/^\s*[<≤]\s*([\d.]+)/);if(m)return [-Infinity,+m[1]];
  m=r.match(/^\s*[>≥]\s*([\d.]+)/);if(m)return [+m[1],Infinity];return null;
}
function flagOf(l){var r=refRange(l.ref),v=num(l.value);if(!r||v==null)return '';if(v<r[0])return 'low';if(v>r[1])return 'high';return 'ok'}
function ring(frac,label){
  var s=58,r=(s-8)/2,c=2*Math.PI*r;
  return '<svg viewBox="0 0 '+s+' '+s+'" width="'+s+'" height="'+s+'" aria-hidden="true"><circle cx="29" cy="29" r="'+r+'" class="rbg"/>'+
    (frac>0?'<circle cx="29" cy="29" r="'+r+'" class="rfg" stroke-dasharray="'+(c*frac).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 29 29)"/>':'')+
    '<text x="29" y="33" text-anchor="middle">'+esc(label)+'</text></svg>';
}
function lineChart(pts,o){
  o=o||{};if(!pts.length)return '<p class="muted">Пока нет данных.</p>';
  pts=pts.slice().sort(function(a,b){return a.d<b.d?-1:1});
  var W=340,H=160,pl=36,pr=12,pt=12,pb=26;
  var xs=pts.map(function(p){return parseD(p.d).getTime()}),x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs);
  if(x0===x1){x0-=3*864e5;x1+=3*864e5}
  var vals=pts.map(function(p){return p.v});if(o.ref!=null)vals.push(o.ref);
  var y0=o.yMin!=null?o.yMin:Math.min.apply(null,vals),y1=o.yMax!=null?o.yMax:Math.max.apply(null,vals);
  if(y0===y1){y0-=1;y1+=1}var py=(y1-y0)*.15;if(o.yMin==null)y0-=py;if(o.yMax==null)y1+=py;
  function X(t){return pl+(t-x0)/(x1-x0)*(W-pl-pr)}function Y(v){return pt+(1-(v-y0)/(y1-y0))*(H-pt-pb)}
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'')+'">';
  (o.bands||[]).forEach(function(b){var a=Y(Math.min(b[1],y1)),c=Y(Math.max(b[0],y0));if(c>a)s+='<rect x="'+pl+'" y="'+a.toFixed(1)+'" width="'+(W-pl-pr)+'" height="'+(c-a).toFixed(1)+'" style="fill:'+b[2]+'"/>'});
  for(var i=0;i<=2;i++){var v=y0+(y1-y0)*i/2;s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" class="grid"/><text x="'+(pl-6)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end" class="ax">'+fmtNum(v)+'</text>'}
  if(o.ref!=null)s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(o.ref).toFixed(1)+'" y2="'+Y(o.ref).toFixed(1)+'" class="refl"/><text x="'+(W-pr)+'" y="'+(Y(o.ref)-5).toFixed(1)+'" text-anchor="end" class="ax">'+esc(o.refLabel||'')+'</text>';
  if(pts.length>1)s+='<path class="ln" d="'+pts.map(function(p,i){return (i?'L':'M')+X(xs[i]).toFixed(1)+' '+Y(p.v).toFixed(1)}).join(' ')+'"/>';
  pts.forEach(function(p,i){s+='<circle class="dot" cx="'+X(xs[i]).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="3.4"/>'});
  s+='<text x="'+pl+'" y="'+(H-8)+'" class="ax">'+fmtDate(pts[0].d,true)+'</text>';
  if(pts.length>1)s+='<text x="'+(W-pr)+'" y="'+(H-8)+'" text-anchor="end" class="ax">'+fmtDate(pts[pts.length-1].d,true)+'</text>';
  return s+'</svg>';
}
function barsChart(vals,max,label){
  var W=340,H=96,pb=20,n=vals.length,bw=(W-8)/n;
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'">';
  vals.forEach(function(v,i){if(!v)return;var h=(v/max)*(H-pb-10);s+='<rect class="barr" x="'+(4+i*bw+1).toFixed(1)+'" y="'+(H-pb-h).toFixed(1)+'" width="'+Math.max(2,bw-2).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2"/>'});
  s+='<line x1="4" x2="'+(W-4)+'" y1="'+(H-pb)+'" y2="'+(H-pb)+'" class="grid"/><text x="4" y="'+(H-5)+'" class="ax">'+n+' дней назад</text><text x="'+(W-4)+'" y="'+(H-5)+'" text-anchor="end" class="ax">сегодня</text>';
  return s+'</svg>';
}
function weightForm(){
  return '<div class="inline"><label>Вес, кг<input id="w-kg" type="number" inputmode="decimal" step="0.1" min="30" max="250"></label><label>Талия, см<input id="w-waist" type="number" inputmode="decimal" step="0.5" min="40" max="200"></label><button class="btn pri" data-act="weight-save">Записать</button></div>';
}
function lastOf(arr,key){var s=arr.slice().sort(function(a,b){return a[key]<b[key]?-1:1});return s[s.length-1]}

/* ---------- views ---------- */
function vNav(){
  return '<nav class="tabs" aria-label="Разделы"><div class="brand display">Здоровье</div>'+TABS.map(function(t){
    return '<button class="tab" data-act="tab" data-tab="'+t[0]+'"'+(UI.tab===t[0]?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true">'+IC[t[0]]+'</svg><span>'+t[1]+'</span></button>'}).join('')+'</nav>';
}
function vToday(){
  var d=UI.day,t=today(),rec=S.daily[d]||{},h=rec.h||{};
  var title=d===t?'Сегодня':(d===addDays(t,-1)?'Вчера':fmtDate(d,true));
  var s=top(title);
  s+='<div class="daynav"><button class="btn sm ghost" data-act="day" data-n="-1" aria-label="Предыдущий день">‹</button><span>'+fmtDate(d,true)+'</span><button class="btn sm ghost" data-act="day" data-n="1" aria-label="Следующий день"'+(d>=t?' disabled':'')+'>›</button></div>';
  s+=lvlStrip();

  var focus=S.tasks.filter(function(x){return !x.done}).sort(byDue).slice(0,4);
  s+='<section class="sec"><div class="sec-h"><h2>Ближайшие задачи</h2><button class="btn sm ghost" data-act="tab" data-tab="tasks">Все задачи</button></div>';
  s+=focus.length?'<div class="list">'+focus.map(taskRow).join('')+'</div>':'<div class="list"><p class="empty">Открытых задач нет. Добавьте новую во вкладке «Задачи».</p></div>';
  s+='</section>';

  s+='<section class="sec"><div class="sec-h"><h2>Отметки дня</h2><button class="btn sm ghost" data-act="habits">Изменить список</button></div><div class="pills">'+
    S.habits.map(function(x){return '<button class="pill" data-act="habit" data-id="'+esc(x.id)+'" aria-pressed="'+(!!h[x.id])+'">'+esc(x.label)+'<small>+'+(+x.xp||3)+'</small></button>'}).join('')+'</div></section>';

  s+='<section class="sec"><div class="sec-h"><h2>Настроение</h2><small>'+esc(MOOD[rec.mood]||'')+'</small></div><div class="scale">'+
    [1,2,3,4,5].map(function(n){return '<button class="pill" data-act="mood" data-n="'+n+'" aria-pressed="'+(rec.mood===n)+'" aria-label="'+MOOD[n]+'">'+n+'</button>'}).join('')+'</div></section>';
  s+='<section class="sec"><div class="sec-h"><h2>Сон</h2><small>'+esc(SLEEP[rec.sleep]||'')+'</small></div><div class="scale">'+
    [1,2,3,4,5].map(function(n){return '<button class="pill" data-act="sleep" data-n="'+n+'" aria-pressed="'+(rec.sleep===n)+'" aria-label="'+SLEEP[n]+'">'+n+'</button>'}).join('')+'</div></section>';

  var tl=S.settings.trackLabel;
  if(tl){
    s+='<section class="sec"><h2 style="margin-bottom:10px">'+esc(tl)+'</h2><div class="pills">'+
      CAN.map(function(c){return '<button class="pill" data-act="can" data-v="'+c[0]+'" aria-pressed="'+(rec.can===c[0])+'">'+c[1]+'</button>'}).join('')+'</div>'+
      (S.settings.trackHint?'<p class="hint">'+esc(S.settings.trackHint)+'</p>':'')+'</section>';
  }

  if(d===t){
    var lw=lastOf(S.weights,'date'),lp=lastOf(S.phq,'date');
    if(!lw||diffDays(t,lw.date)>=7){
      s+='<section class="sec"><h2 style="margin-bottom:6px">Взвешивание</h2><p class="muted" style="font-size:14px">'+(lw?'Последний замер '+fmtDate(lw.date)+': '+fmtNum(lw.kg)+' кг.':'Первый замер станет точкой отсчёта.')+' Утром, натощак.</p>'+weightForm()+'</section>';
    }
    if(!lp||diffDays(t,lp.date)>=14){
      s+='<section class="sec"><div class="list"><div class="row"><h4>Пора пройти PHQ-9</h4><p>Девять вопросов, около двух минут. Динамику удобно показать врачу.</p><div class="acts"><button class="btn pri sm" data-act="phq-start">Пройти</button></div></div></div></section>';
    }
    var lb=S.backups.slice().sort().pop();
    if(!lb||diffDays(t,lb)>=7){
      s+='<section class="sec"><div class="list"><div class="row"><h4>Сохраните резервную копию</h4><p>'+(lb?'Последняя: '+fmtDate(lb)+'.':'Копий пока не было.')+' Зашифрованный файл защитит медкарту при потере телефона и перенесёт её на ПК.</p><div class="acts"><button class="btn sm" data-act="data">Сохранить копию</button></div></div></div></section>';
    }
  }
  return s;
}
function vTasks(){
  var t=today(),f=UI.filter;
  var list=S.tasks.filter(function(x){return f==='all'||x.system===f});
  var open=list.filter(function(x){return !x.done}).sort(byDue);
  var groups=[
    ['Срок прошёл',open.filter(function(x){return x.due&&x.due<t})],
    ['Ближайшие две недели',open.filter(function(x){return x.due&&x.due>=t&&diffDays(x.due,t)<=14})],
    ['Позже',open.filter(function(x){return x.due&&diffDays(x.due,t)>14})],
    ['Без срока',open.filter(function(x){return !x.due})],
    ['Сделано',list.filter(function(x){return x.done}).sort(function(a,b){return a.done<b.done?1:-1})]
  ];
  var used=Object.keys(SYS).filter(function(k){return S.tasks.some(function(x){return x.system===k})});
  var s=top('Задачи');
  s+='<div class="chips"><button class="pill" data-act="filter" data-v="all" aria-pressed="'+(f==='all')+'">Все</button>'+used.map(function(k){return '<button class="pill" data-act="filter" data-v="'+k+'" aria-pressed="'+(f===k)+'">'+SYS_S[k]+'</button>'}).join('')+'</div>';
  s+='<button class="btn pri" data-act="form" data-kind="task">Добавить задачу</button>';
  groups.forEach(function(g){if(!g[1].length)return;s+='<section class="sec"><h2 style="margin-bottom:10px">'+g[0]+'</h2><div class="list">'+g[1].map(taskRow).join('')+'</div></section>'});
  if(!list.length)s+='<p class="empty">Задач в этом разделе нет.</p>';
  s+='<p class="hint" style="margin-top:20px">Пропущенный срок ничего не отнимает. Задачу можно перенести через «Изменить».</p>';
  return s;
}
function addBtn(kind,label){return '<button class="btn pri" data-act="form" data-kind="'+kind+'">'+label+'</button>'}
function vCard(){
  var s=top('Медкарта'),c=S.card,seg=UI.seg;
  s+='<div class="chips">'+SEGS.map(function(x){return '<button class="pill" data-act="seg" data-v="'+x[0]+'" aria-pressed="'+(seg===x[0])+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(seg==='summary'){
    var p=c.patient,rows=[['Имя',p.name],['Дата рождения',p.birth?fmtDate(p.birth,true):'не указана'],['Рост',p.height],['Вес',p.weightNote],['Группа крови',p.blood],['Непереносимость',p.intolerance],['Важно для врачей',p.note]];
    s+='<section><div class="list"><div class="row"><dl class="prof">'+rows.filter(function(r){return r[1]}).map(function(r){return '<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>'}).join('')+'</dl><div class="acts"><button class="btn sm" data-act="form" data-kind="patient">Изменить профиль</button></div></div></div></section>';
    s+='<section class="sec"><div class="sec-h"><h2>Состояния и диагнозы</h2></div><div class="list">'+
      (c.problems.length?c.problems.map(function(x){return '<button class="row" data-act="form" data-kind="problem" data-id="'+esc(x.id)+'"><h4>'+esc(x.title)+'</h4><p><span class="chip">'+esc(SYS_S[x.system]||'Прочее')+'</span> '+(x.status?'<span class="chip">'+esc(x.status)+'</span>':'')+'</p>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</button>'}).join(''):'<p class="empty">Пока пусто.</p>')+
      '</div><div class="acts">'+addBtn('problem','Добавить состояние')+'</div></section>';
  }else if(seg==='meds'){
    var act=c.meds.filter(function(m){return m.status!=='stopped'}),st=c.meds.filter(function(m){return m.status==='stopped'});
    function medRow(m){return '<button class="row" data-act="form" data-kind="med" data-id="'+esc(m.id)+'"><h4>'+esc(m.name)+(m.dose?' <span class="muted" style="font-weight:400">'+esc(m.dose)+'</span>':'')+'</h4>'+(m.schedule?'<p>'+esc(m.schedule)+(m.start?', с '+fmtDate(m.start,true):'')+'</p>':'')+(m.note?'<p>'+esc(m.note)+'</p>':'')+'</button>'}
    s+='<section><h2 style="margin-bottom:10px">Принимаю</h2><div class="list">'+(act.length?act.map(medRow).join(''):'<p class="empty">Нет препаратов.</p>')+'</div></section>';
    if(st.length)s+='<section class="sec"><h2 style="margin-bottom:10px">Отменённые и неподходящие</h2><div class="list">'+st.map(medRow).join('')+'</div></section>';
    s+='<div class="acts">'+addBtn('med','Добавить препарат')+'</div>';
  }else if(seg==='labs'){
    var groups=new Map();c.labs.forEach(function(l){if(!groups.has(l.name))groups.set(l.name,[]);groups.get(l.name).push(l)});
    s+='<div class="acts" style="margin:0 0 14px">'+addBtn('lab','Добавить результат')+'</div>';
    if(!groups.size)s+='<p class="empty">Результатов пока нет.</p>';
    else{
      s+='<div class="list">';
      groups.forEach(function(arr,name){
        arr.sort(function(a,b){return a.date<b.date?-1:1});var last=arr[arr.length-1],f=flagOf(last),key='l'+name,o=UI.open[key];
        var nums=arr.map(function(x){return num(x.value)}).filter(function(v){return v!=null});
        s+='<button class="row lab" data-act="open" data-key="'+esc(key)+'" aria-expanded="'+(!!o)+'"><span class="lab-n">'+esc(name)+'<small>'+(last.ref?'норма '+esc(last.ref):'')+'</small></span><span class="lab-s '+f+'">'+spark(nums)+'</span>'+
          '<span class="lab-v"><b class="'+f+'">'+esc(String(last.value).replace('.',','))+'</b> '+esc(last.unit||'')+'<small>'+fmtDate(last.date,true)+(f==='high'?', выше нормы':f==='low'?', ниже нормы':'')+'</small></span></button>';
        if(o)s+='<div class="row sub">'+arr.slice().reverse().map(function(x){return '<button class="hist" data-act="form" data-kind="lab" data-id="'+esc(x.id)+'"><span>'+fmtDate(x.date,true)+'</span><span class="'+flagOf(x)+'">'+esc(String(x.value).replace('.',','))+' '+esc(x.unit||'')+'</span>'+(x.note?'<small>'+esc(x.note)+'</small>':'')+'</button>'}).join('')+'</div>';
      });
      s+='</div><p class="hint">Нажмите на показатель, чтобы увидеть историю и поправить запись.</p>';
    }
  }else if(seg==='studies'||seg==='visits'){
    var isS=seg==='studies',arr2=c[seg].slice().sort(function(a,b){return a.date<b.date?1:-1});
    s+='<div class="acts" style="margin:0 0 14px">'+addBtn(isS?'study':'visit',isS?'Добавить исследование':'Добавить приём')+'</div><div class="list">';
    s+=arr2.length?arr2.map(function(x){return '<button class="row dated" data-act="form" data-kind="'+(isS?'study':'visit')+'" data-id="'+esc(x.id)+'"><time>'+fmtDate(x.date,true)+'</time><span><h4>'+esc(isS?x.type:x.specialty)+'</h4><p>'+esc([isS?'':x.doctor,x.place].filter(Boolean).join(', '))+'</p><p>'+esc(isS?x.conclusion:x.summary)+'</p></span></button>'}).join(''):'<p class="empty">Пока пусто.</p>';
    s+='</div>';
  }else if(seg==='private'){
    s+=vPrivate();
  }
  return s;
}
function vPrivate(){
  var pv=S.card.private;
  if(!UI.priv){
    return '<div class="list"><div class="row"><h4>Раздел скрыт</h4><p>Скрининги, вещества и семейный анамнез. Скрыт от случайного взгляда через плечо.</p><div class="acts"><button class="btn pri sm" data-act="priv-open">Показать</button></div></div></div>';
  }
  var s='<div class="acts" style="margin:0 0 14px"><button class="btn sm" data-act="priv-close">Скрыть</button><button class="btn sm" data-act="priv-edit">Изменить</button></div>';
  s+='<div class="list">'+(pv.screening||[]).map(function(x){return '<div class="row dated"><time style="font-weight:600;color:var(--ink)">'+esc(x.value)+'</time><span><h4>'+esc(x.name)+'</h4>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</span></div>'}).join('')+'</div>';
  [['Вещества',pv.substances],['Семейный анамнез',pv.family],['Лечение',pv.plan]].forEach(function(r){if(r[1])s+='<section class="sec"><h2 style="margin-bottom:6px">'+r[0]+'</h2><p>'+esc(r[1])+'</p></section>'});
  var ph=S.phq.slice().sort(function(a,b){return a.date<b.date?-1:1});
  s+='<section class="sec"><div class="sec-h"><h2>PHQ-9</h2><button class="btn sm ghost" data-act="phq-start">Пройти</button></div>'+lineChart(ph.map(function(p){return {d:p.date,v:p.score}}),{yMin:0,yMax:27,label:'PHQ-9',bands:[[20,27,'var(--warn-soft)'],[0,4,'var(--soft)']]})+'</section>';
  return s;
}
function vAdvice(){
  var s=top('Советы'),f=UI.adv,recs=S.card.recs.slice().sort(function(a,b){return (a.priority||3)-(b.priority||3)});
  s+='<section class="safety"><h2>Если станет хуже</h2><p>Если мысли о смерти усиливаются или появляется желание действовать, звоните сейчас, не дожидаясь приёма.</p><button class="btn" data-act="help">Номера и личный план</button></section>';
  var used=Object.keys(SYS).filter(function(k){return recs.some(function(r){return r.system===k})});
  s+='<div class="chips" style="margin-top:20px"><button class="pill" data-act="adv" data-v="all" aria-pressed="'+(f==='all')+'">Все</button>'+used.map(function(k){return '<button class="pill" data-act="adv" data-v="'+k+'" aria-pressed="'+(f===k)+'">'+SYS_S[k]+'</button>'}).join('')+'</div>';
  var list=recs.filter(function(r){return f==='all'||r.system===f});
  var PR={1:'Важно сейчас',2:'Полезно',3:'Когда будет время'};
  s+='<div class="list">'+(list.length?list.map(function(r){return '<div class="row rec"><p style="margin:0 0 6px"><span class="chip'+(r.priority===1?' prio1':'')+'">'+PR[r.priority||3]+'</span><span class="chip">'+esc(SYS_S[r.system]||'Прочее')+'</span></p><h4>'+esc(r.title)+'</h4><p>'+esc(r.text)+'</p></div>'}).join(''):'<p class="empty">Советов в этом разделе нет.</p>')+'</div>';
  s+='<p class="hint">Советы составлены по вашим документам и не заменяют врача. Обновляются вместе с файлом медкарты.</p>';
  return s;
}
function vProgress(){
  var s=top('Прогресс'),led=ledger(),p=led.p;
  s+=lvlStrip();
  s+='<p class="hint">Задачи '+p.tasks+', отметки дня '+p.days+', замеры '+p.weights+', опросы '+p.phq+', копии '+p.backups+', записи в медкарту '+p.bonus+'. Пропуски очков не отнимают.</p>';
  var used=Object.keys(SYS).filter(function(k){return k!=='other'&&S.tasks.some(function(t){return t.system===k})});
  s+='<section class="sec"><h2 style="margin-bottom:10px">Карта систем</h2><div class="atlas">'+used.map(function(k){
    var all=S.tasks.filter(function(t){return t.system===k}),dn=all.filter(function(t){return t.done}).length;
    return '<div class="sys">'+ring(all.length?dn/all.length:0,dn+'/'+all.length)+'<div><b>'+SYS_S[k]+'</b><small class="muted">'+(dn===all.length?'всё закрыто':'осталось '+(all.length-dn))+'</small></div></div>'}).join('')+'</div></section>';
  var A=ACH(),on=A.filter(function(a){return a[3]}).length;
  s+='<section class="sec"><div class="sec-h"><h2>Достижения</h2><small>'+on+' из '+A.length+'</small></div><div class="ach">'+A.map(function(a){return '<div class="'+(a[3]?'on':'')+'"><b>'+esc(a[1])+'</b><small>'+esc(a[2])+'</small></div>'}).join('')+'</div></section>';
  var ws=S.weights.slice().sort(function(a,b){return a.date<b.date?-1:1});
  var first=ws[0];
  s+='<section class="sec"><div class="sec-h"><h2>Вес</h2>'+(ws.length>1?'<small>'+(function(){var d=ws[ws.length-1].kg-first.kg;return (d>0?'+':'')+fmtNum(d)+' кг от первого замера'})()+'</small>':'')+'</div>'+
    lineChart(ws.map(function(w){return {d:w.date,v:+w.kg}}),{label:'Вес',ref:first?+first.kg*1.05:null,refLabel:'+5%, обсудить с врачом'})+
    '<details><summary>Добавить замер</summary>'+weightForm()+'</details>'+
    (ws.length?'<details><summary>Все замеры</summary><div class="list" style="margin-top:8px">'+ws.slice().reverse().map(function(w){return '<div class="row dated"><time>'+fmtDate(w.date,true)+'</time><span>'+fmtNum(+w.kg)+' кг'+(w.waist?', талия '+fmtNum(+w.waist)+' см':'')+' <button class="btn sm ghost danger" data-act="weight-del" data-d="'+esc(w.date)+'">Удалить</button></span></div>'}).join('')+'</div></details>':'')+'</section>';
  var days=[],moods=[],sleeps=[];for(var i=29;i>=0;i--){var dd=addDays(today(),-i),v=S.daily[dd]||{};moods.push(v.mood||0);sleeps.push(v.sleep||0);days.push(dd)}
  s+='<section class="sec"><h2 style="margin-bottom:10px">Настроение за 30 дней</h2>'+barsChart(moods,5,'Настроение')+'</section>';
  s+='<section class="sec"><h2 style="margin-bottom:10px">Сон за 30 дней</h2>'+barsChart(sleeps,5,'Сон')+'</section>';
  if(S.settings.trackLabel){
    var c={none:0,less:0,usual:0,more:0};days.forEach(function(d){var v=(S.daily[d]||{}).can;if(v)c[v]++});
    s+='<section class="sec"><h2 style="margin-bottom:6px">'+esc(S.settings.trackLabel)+' за 30 дней</h2><div class="stats"><span><b>'+c.none+'</b> без</span><span><b>'+c.less+'</b> меньше обычного</span><span><b>'+c.usual+'</b> как обычно</span><span><b>'+c.more+'</b> больше</span></div></section>';
  }
  return s;
}
/* ---------- sheets ---------- */
var sheetKind=null;
function openSheet(html,kind,keep){
  var w=document.getElementById('sheet'),b=document.getElementById('sheet-body'),st=keep?b.scrollTop:0;
  b.innerHTML=html;w.hidden=false;sheetKind=kind||null;b.scrollTop=st;
  if(!keep){var f=b.querySelector('input:not(.vh),textarea,select,button');if(f&&f.tagName!=='BUTTON'&&window.matchMedia('(min-width:700px)').matches)f.focus()}
}
function closeSheet(){document.getElementById('sheet').hidden=true;sheetKind=null;UI.phq=null;UI.foreign=null}
function sheetHead(t){return '<div class="sheet-h"><h2 class="display" style="font-size:20px">'+esc(t)+'</h2><button class="btn sm ghost" data-act="close">Закрыть</button></div>'}

function helpSheet(){
  var sf=S?S.safety:{};
  return sheetHead('Если станет хуже')+
    '<p>Если мысли о смерти становятся сильнее, появляется план или желание действовать, действуйте сейчас. В начале или при смене лечения о таких изменениях сообщают врачу сразу.</p>'+
    '<div class="callrow"><a class="btn pri" href="tel:+7495051">+7 495 051</a><span>Психологическая помощь Москвы, круглосуточно, бесплатно и анонимно. С городского: 051.</span></div>'+
    '<div class="callrow"><a class="btn" href="tel:112">112</a><span>Экстренные службы</span></div>'+
    (S?'<h3>Мой план</h3><label class="f" for="sf-doctor">Мой врач и телефон</label><input id="sf-doctor" value="'+esc(sf.doctor)+'">'+
    '<label class="f" for="sf-contact">Кому позвоню</label><input id="sf-contact" value="'+esc(sf.contact)+'" placeholder="Имя и телефон близкого человека">'+
    '<label class="f" for="sf-helps">Что мне помогает пережить тяжёлый момент</label><textarea id="sf-helps" placeholder="Например: выйти на улицу, позвонить другу, душ, музыка">'+esc(sf.helps)+'</textarea>'+
    '<div class="acts"><button class="btn pri" data-act="safety-save">Сохранить план</button></div>':'');
}
function habitsSheet(){
  var s=sheetHead('Отметки дня')+'<div class="list">'+S.habits.map(function(h){return '<div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span>'+esc(h.label)+' <small class="xp">+'+(+h.xp||3)+'</small></span><button class="btn sm ghost danger" data-act="habit-del" data-id="'+esc(h.id)+'">Убрать</button></div>'}).join('')+'</div>';
  s+='<h3>Новая отметка</h3><div class="inline"><label>Название<input id="hb-label" placeholder="Например: вода 1,5 л"></label><label style="flex:0 1 90px">Очки<input id="hb-xp" type="number" value="3" min="1" max="20"></label><button class="btn pri" data-act="habit-add">Добавить</button></div>';
  s+='<p class="hint">Отметки за прошлые дни сохраняются, даже если убрать пункт из списка.</p>';
  return s;
}
function phqSheet(){
  var a=UI.phq,all=a.every(function(x){return x!=null});
  return sheetHead('PHQ-9')+'<p class="muted">Как часто за последние 2 недели вас беспокоило следующее?</p>'+
    PHQ_Q.map(function(q,i){return '<div class="q"><p>'+(i+1)+'. '+q+'</p><div class="pills">'+PHQ_A.map(function(t,v){return '<button class="pill" data-act="phq-ans" data-i="'+i+'" data-v="'+v+'" aria-pressed="'+(a[i]===v)+'">'+t+'</button>'}).join('')+'</div></div>'}).join('')+
    '<div class="acts"><button class="btn pri" data-act="phq-submit"'+(all?'':' disabled')+'>Посчитать</button></div>';
}
function phqBand(n){return n<=4?'минимальные симптомы':n<=9?'лёгкая депрессия':n<=14?'умеренная':n<=19?'умеренно тяжёлая':'тяжёлая'}
function phqResult(rec,prev){
  var s=sheetHead('Результат PHQ-9')+'<p><span class="big">'+rec.score+'</span> <span class="muted">из 27, '+phqBand(rec.score)+'</span></p>';
  if(prev)s+='<p>Прошлый раз: '+prev.score+' ('+fmtDate(prev.date,true)+'). '+(rec.score<prev.score?'Меньше на '+(prev.score-rec.score)+'.':rec.score>prev.score?'Больше на '+(rec.score-prev.score)+'. Стоит рассказать врачу.':'Без изменений.')+'</p>';
  s+='<p class="muted">Опросник не ставит диагноз. Он помогает отслеживать, работает ли лечение.</p>';
  if(rec.items[8]>0)s+='<div class="safety" style="margin-top:14px"><h2>Про мысли о смерти</h2><p>Вы отметили их в этот раз. Если они усиливаются или появляется желание действовать, звоните сейчас: +7 495 051 (круглосуточно, анонимно) или 112. Вашему врачу важно знать об этом до следующего приёма.</p><button class="btn" data-act="help">Номера и личный план</button></div>';
  s+='<div class="acts"><button class="btn pri" data-act="close">Готово</button></div>';
  return s;
}

/* ---------- forms ---------- */
function sysOpts(){return Object.keys(SYS).map(function(k){return [k,SYS[k]]})}
var FORMS={
  lab:{list:'labs',title:'Результат анализа',f:[['name','Показатель','text',1],['value','Значение','text',1],['unit','Единицы','text'],['ref','Норма (например 4–9 или <5.2)','text'],['date','Дата','date',1],['note','Комментарий','text']]},
  visit:{list:'visits',title:'Приём врача',f:[['date','Дата','date',1],['specialty','Специалист','text',1],['doctor','Врач','text'],['place','Где','text'],['summary','Итог и назначения','textarea']]},
  study:{list:'studies',title:'Исследование',f:[['date','Дата','date',1],['type','Что делали','text',1],['place','Где','text'],['conclusion','Заключение','textarea']]},
  med:{list:'meds',title:'Препарат',f:[['name','Название','text',1],['dose','Доза','text'],['schedule','Схема','text'],['start','Начало','date'],['status','Статус','select',0,function(){return [['active','Принимаю'],['stopped','Отменён']]}],['note','Комментарий','textarea']]},
  problem:{list:'problems',title:'Состояние',f:[['title','Название','text',1],['system','Система','select',0,sysOpts],['status','Статус','text'],['note','Подробности','textarea']]},
  task:{list:'tasks',root:1,title:'Задача',f:[['title','Что сделать','text',1],['system','Система','select',0,sysOpts],['type','Тип','select',0,function(){return TYPES.map(function(t){return [t,t]})}],['due','Срок','date'],['xp','Очки','number'],['details','Подробности','textarea']]},
  patient:{single:1,title:'Профиль',f:[['name','Имя','text'],['birth','Дата рождения','date'],['height','Рост','text'],['weightNote','Вес, справочно','text'],['blood','Группа крови','text'],['intolerance','Непереносимость, аллергии','textarea'],['note','Важно для врачей','textarea']]},
  priv:{single:1,title:'Личное',f:[['substances','Вещества','textarea'],['family','Семейный анамнез','textarea'],['plan','Лечение','textarea']]}
};
function getList(def){return def.root?S[def.list]:S.card[def.list]}
function formSheet(kind,id){
  var def=FORMS[kind],item={};
  if(kind==='patient')item=S.card.patient;else if(kind==='priv')item=S.card.private;
  else if(id)item=getList(def).find(function(x){return x.id===id})||{};
  if(!id&&kind==='task')item={xp:30,system:'other',type:'Другое'};
  if(!id&&kind==='lab'){item={date:today()}}
  var s=sheetHead((id||def.single?'':'Новое: ')+def.title.toLowerCase().replace(/^./,function(c){return c.toUpperCase()}))+'<div id="f-form">';
  def.f.forEach(function(f){
    var k=f[0],v=item[k]==null?'':item[k],type=f[2],idA='ff-'+k;
    s+='<label class="f" for="'+idA+'">'+f[1]+(f[3]?' *':'')+'</label>';
    if(type==='textarea')s+='<textarea id="'+idA+'" name="'+k+'">'+esc(v)+'</textarea>';
    else if(type==='select')s+='<select id="'+idA+'" name="'+k+'">'+f[4]().map(function(o){return '<option value="'+esc(o[0])+'"'+(String(v)===o[0]?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>';
    else{var tp=(type==='date'&&v&&!isFull(v))?'text':type;s+='<input id="'+idA+'" name="'+k+'" type="'+tp+'"'+(type==='number'?' inputmode="numeric"':'')+(kind==='lab'&&k==='name'?' list="lab-names"':'')+' value="'+esc(v)+'">'}
  });
  if(kind==='lab'){var names=Array.from(new Set(S.card.labs.map(function(l){return l.name})));s+='<datalist id="lab-names">'+names.map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist>'}
  s+='</div><div class="acts"><button class="btn pri" data-act="form-save" data-kind="'+kind+'" data-id="'+esc(id||'')+'">Сохранить</button>'+
    (id&&!def.single?'<button class="btn danger" data-act="form-del" data-kind="'+kind+'" data-id="'+esc(id)+'">Удалить</button>':'')+'</div>';
  if(kind==='task'&&id){var t=S.tasks.find(function(x){return x.id===id});if(t&&t.done)s+='<p class="hint">Выполнено '+fmtDate(t.done,true)+'.</p>'}
  return s;
}
function readForm(kind){
  var def=FORMS[kind],o={},miss=null;
  def.f.forEach(function(f){var el=document.querySelector('#f-form [name="'+f[0]+'"]');if(!el)return;var v=el.value.trim();if(f[3]&&!v&&!miss)miss=f[1];o[f[0]]=v});
  if(miss){toast('Заполните поле «'+miss+'»');return null}
  if(kind==='lab'){var n=num(o.value);if(n!=null&&/^[\d.,\s-]+$/.test(o.value))o.value=n;
    if(!o.unit||!o.ref){var prev=S.card.labs.filter(function(l){return l.name===o.name}).pop();if(prev){o.unit=o.unit||prev.unit||'';o.ref=o.ref||prev.ref||''}}}
  if(kind==='task')o.xp=Math.max(0,Math.min(500,parseInt(o.xp,10)||0));
  return o;
}

/* ---------- storage: IndexedDB ---------- */
var DBP=null;
function db(){if(!DBP)DBP=new Promise(function(res,rej){var r=indexedDB.open('zdorovie',1);r.onupgradeneeded=function(){r.result.createObjectStore('kv')};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}});return DBP}
function idb(mode,fn){return db().then(function(d){return new Promise(function(res,rej){var tx=d.transaction('kv',mode),st=tx.objectStore('kv'),q=fn(st);tx.oncomplete=function(){res(q&&q.result)};tx.onerror=function(){rej(tx.error)};tx.onabort=function(){rej(tx.error)}})})}
function idbGet(k){return idb('readonly',function(s){return s.get(k)})}
function idbPut(k,v){return idb('readwrite',function(s){return s.put(v,k)})}
function idbDel(k){return idb('readwrite',function(s){return s.delete(k)})}

/* ---------- storage: где лежит конверт хранилища ---------- */
/* В вебе IndexedDB. В Tauri файл vault.enc.json в appDataDir: запись во временный файл, затем rename (атомарно). */
var TAURI=window.__TAURI__||null;
function tauriStore(){
  var fs=TAURI.fs,dirP=null,q=Promise.resolve();
  function paths(){if(!dirP)dirP=TAURI.path.appDataDir().then(async function(d){
    await fs.mkdir(d,{recursive:true}).catch(function(){});
    return {f:await TAURI.path.join(d,'vault.enc.json'),tmp:await TAURI.path.join(d,'vault.enc.json.tmp')}});return dirP}
  function queued(fn){var r=q.then(fn);q=r.catch(function(){});return r}
  return {
    get:function(){return queued(async function(){var p=await paths();if(!(await fs.exists(p.f)))return null;return JSON.parse(await fs.readTextFile(p.f))})},
    put:function(v){var body=JSON.stringify(v);return queued(async function(){var p=await paths();await fs.writeTextFile(p.tmp,body);await fs.rename(p.tmp,p.f)})},
    del:function(){return queued(async function(){var p=await paths();if(await fs.exists(p.f))await fs.remove(p.f)})}
  };
}
var storage=TAURI?tauriStore():{get:function(){return idbGet('vault')},put:function(v){return idbPut('vault',v)},del:function(){return idbDel('vault')}};

/* ---------- crypto ---------- */
var TE=new TextEncoder(),TD=new TextDecoder(),AAD=TE.encode('zdorovie-vault-v1'),ITER=600000;
var B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function rnd(n){return crypto.getRandomValues(new Uint8Array(n))}
function b64(u){u=new Uint8Array(u);var s='';for(var i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
function unb64(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function toB32(u){var bits=0,val=0,out='';for(var i=0;i<u.length;i++){val=((val<<8)|u[i])&0xFFFF;bits+=8;while(bits>=5){out+=B32[(val>>>(bits-5))&31];bits-=5}}if(bits>0)out+=B32[(val<<(5-bits))&31];return out}
function fromB32(s){s=String(s).toUpperCase().replace(/[^0-9A-Z]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1').replace(/U/g,'V');var bits=0,val=0,out=[];for(var i=0;i<s.length;i++){var k=B32.indexOf(s[i]);if(k<0)return null;val=((val<<5)|k)&0xFFFF;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
function fmtRec(code){return code.match(/.{1,4}/g).join('-')}
function kdfPass(pass,salt,iter){return crypto.subtle.importKey('raw',TE.encode(pass.normalize('NFC')),'PBKDF2',false,['deriveKey']).then(function(b){return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])})}
function kdfRaw(bytes,info){return crypto.subtle.importKey('raw',bytes,'HKDF',false,['deriveKey']).then(function(b){return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:TE.encode(info)},b,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])})}
function aesEnc(key,data){var iv=rnd(12);return crypto.subtle.encrypt({name:'AES-GCM',iv:iv,additionalData:AAD},key,data).then(function(ct){return {iv:b64(iv),ct:b64(ct)}})}
function aesDec(key,o){return crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv),additionalData:AAD},key,unb64(o.ct)).then(function(p){return new Uint8Array(p)})}
function dataKey(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}

/* Хранилище: случайный ключ данных (DEK) зашифрован отдельно кодовой фразой, ключом восстановления и Face ID. */
var VAULT=null,DEK=null,DK=null,saveChain=Promise.resolve(),storageOK=true;
async function wrapPass(dek,pass){var salt=rnd(16),k=await kdfPass(pass,salt,ITER),w=await aesEnc(k,dek);return {salt:b64(salt),iter:ITER,iv:w.iv,ct:w.ct}}
async function wrapRec(dek,recBytes){var k=await kdfRaw(recBytes,'zdorovie-recovery'),w=await aesEnc(k,dek);return {iv:w.iv,ct:w.ct}}
async function unwrapPass(v,pass){var w=v.wraps.pass,k=await kdfPass(pass,unb64(w.salt),w.iter);return aesDec(k,w)}
async function unwrapRec(v,code){var b=fromB32(code);if(!b||b.length!==20)throw new Error('bad');var k=await kdfRaw(b,'zdorovie-recovery');return aesDec(k,v.wraps.rec)}
async function openWith(dek){DEK=dek;DK=await dataKey(dek)}
async function decryptData(v,key){var p=await aesDec(key,v.data);return normalize(JSON.parse(TD.decode(p)))}
function save(){
  if(!DK||!S)return;var snapshot=JSON.stringify(S);
  saveChain=saveChain.then(async function(){
    VAULT.data=await aesEnc(DK,TE.encode(snapshot));VAULT.updated=new Date().toISOString();
    await storage.put(VAULT);storageOK=true;
  }).catch(function(){storageOK=false;toast('Не удалось сохранить на устройство')});
}
async function newVault(pass){
  var dek=rnd(32),rec=rnd(20);
  VAULT={format:'zdorovie-vault',v:1,created:new Date().toISOString(),wraps:{pass:await wrapPass(dek,pass),rec:await wrapRec(dek,rec),prfSalt:b64(rnd(32)),pk:[]},data:null};
  await openWith(dek);return toB32(rec);
}
function lock(){
  if(DEK)DEK.fill(0);DEK=null;DK=null;S=null;UI.priv=false;UI.pending=null;UI.backupFile=null;closeSheet();
  UI.screen=VAULT?'lock':'welcome';UI.gateErr='';render();
}

/* ---------- Face ID: passkey + PRF ---------- */
/* В Tauri вход только по фразе: Windows Hello — отдельная задача */
function pkPossible(){return !TAURI&&!!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext&&location.hostname)}
async function pkEval(ids){
  var a=await navigator.credentials.get({publicKey:{challenge:rnd(32),rpId:location.hostname,userVerification:'required',timeout:60000,
    allowCredentials:ids.map(function(id){return {type:'public-key',id:unb64(id)}}),extensions:{prf:{eval:{first:unb64(VAULT.wraps.prfSalt)}}}}});
  var r=a.getClientExtensionResults();if(!r.prf||!r.prf.results||!r.prf.results.first)throw new Error('noprf');
  return {id:b64(a.rawId),out:new Uint8Array(r.prf.results.first)};
}
async function pkAdd(){
  var salt=unb64(VAULT.wraps.prfSalt);
  var c=await navigator.credentials.create({publicKey:{rp:{name:'Здоровье',id:location.hostname},user:{id:rnd(16),name:'Здоровье',displayName:'Медкарта'},
    challenge:rnd(32),pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],timeout:60000,
    authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},extensions:{prf:{eval:{first:salt}}}}});
  var ext=c.getClientExtensionResults(),id=b64(c.rawId),out=null;
  if(!ext.prf||ext.prf.enabled===false)throw new Error('noprf');
  if(ext.prf.results&&ext.prf.results.first)out=new Uint8Array(ext.prf.results.first);
  else out=(await pkEval([id])).out;
  var k=await kdfRaw(out,'zdorovie-faceid'),w=await aesEnc(k,DEK);
  VAULT.wraps.pk=(VAULT.wraps.pk||[]).concat([{id:id,iv:w.iv,ct:w.ct,host:location.hostname,created:today()}]);
  await storage.put(VAULT);
}
async function pkUnlock(){
  var list=(VAULT.wraps.pk||[]).filter(function(p){return p.host===location.hostname});if(!list.length)throw new Error('none');
  var r=await pkEval(list.map(function(p){return p.id})),w=list.find(function(p){return p.id===r.id});if(!w)throw new Error('unknown');
  var k=await kdfRaw(r.out,'zdorovie-faceid');return aesDec(k,w);
}
function hasPk(){return !!(VAULT&&(VAULT.wraps.pk||[]).some(function(p){return p.host===location.hostname}))}

/* ---------- gate screens ---------- */
function gate(inner){return '<div class="gate">'+inner+'</div>'}
function vGate(){
  var s=UI.screen,e='<p class="err" id="gerr">'+esc(UI.gateErr||'')+'</p>';
  if(s==='welcome')return gate('<h1 class="display">Здоровье</h1><p class="lead">Медкарта, задачи и отметки дня. Всё шифруется и хранится только на этом устройстве.</p>'+
    '<button class="btn pri" data-act="g-new">Создать защищённое хранилище</button>'+
    '<label class="btn" for="restore-in">Восстановить из резервной копии</label><input class="vh" type="file" id="restore-in" accept=".json,application/json">'+e+
    (navigator.standalone===false&&/iPhone|iPad/.test(navigator.userAgent)?'<p class="hint">Сначала добавьте приложение на экран «Домой» и откройте его оттуда: у вкладки Safari отдельное хранилище.</p>':''));
  if(s==='setpass'||s==='newpass')return gate('<h1 class="display">Кодовая фраза</h1>'+
    (s==='newpass'?'<p class="lead">Задайте новую фразу: старая больше не подойдёт.</p>':'<p class="lead">Ей шифруется вся медкарта. Лучше 4 случайных слова, например «окно сирень мост пятница».</p>')+
    '<label class="f" for="p1">Фраза, не короче 10 символов</label><input id="p1" type="password" autocomplete="new-password">'+
    '<label class="f" for="p2">Ещё раз</label><input id="p2" type="password" autocomplete="new-password">'+e+
    '<button class="btn pri" data-act="'+(s==='newpass'?'g-newpass':'g-setpass')+'">Продолжить</button>'+
    '<p class="hint">Фразу нельзя восстановить. На следующем шаге вы получите ключ восстановления на случай, если её забудете.</p>');
  if(s==='recovery')return gate('<h1 class="display">Ключ восстановления</h1><p class="lead">Единственный способ открыть медкарту, если забудете фразу и потеряете Face ID. Сохраните его в менеджер паролей или запишите на бумаге.</p>'+
    '<div class="code">'+esc(fmtRec(UI.recCode).replace(/-/g,' '))+'</div><div class="acts"><button class="btn sm" data-act="g-copyrec">Скопировать</button></div>'+
    '<label class="check-line"><input type="checkbox" id="rec-ok"><span>Я сохранил ключ в надёжном месте, не в заметках телефона</span></label>'+e+
    '<button class="btn pri" data-act="g-recdone">Готово</button>');
  if(s==='faceid')return gate('<h1 class="display">Face ID</h1><p class="lead">Открывать медкарту взглядом вместо ввода фразы. Ключ хранится в связке ключей iCloud под защитой Face ID.</p>'+
    '<p>Телефон попросит Face ID два раза: создать ключ и проверить его.</p>'+e+
    '<button class="btn pri" data-act="g-pk">Включить Face ID</button><button class="btn ghost" data-act="g-pkskip">Позже</button>');
  if(s==='import')return gate('<h1 class="display">Медкарта</h1><p class="lead">Откройте файл медкарты, который я подготовил. Он будет зашифрован сразу после чтения.</p>'+
    '<label class="btn pri" for="file-in">Открыть файл медкарты</label><input class="vh" type="file" id="file-in" accept=".json,application/json">'+e+
    '<button class="btn ghost" data-act="g-empty">Начать с пустой карты</button><p class="hint">После импорта удалите исходный файл из «Загрузок» и «Файлов»: он не зашифрован.</p>');
  if(s==='lock'||s==='restore'){
    var isR=s==='restore';
    return gate('<h1 class="display">'+(isR?'Резервная копия':'Здоровье')+'</h1><p class="lead">'+(isR?'Введите кодовую фразу, которой защищена копия.':'Медкарта заблокирована.')+'</p>'+
      (!isR&&hasPk()?'<button class="btn pri" data-act="g-pkunlock">Открыть по Face ID</button>':'')+
      (UI.useRec?'<label class="f" for="rk">Ключ восстановления</label><input id="rk" autocomplete="off" autocapitalize="characters" spellcheck="false">':
        '<label class="f" for="up">Кодовая фраза</label><input id="up" type="password" autocomplete="current-password">')+e+
      '<button class="btn'+(!isR&&hasPk()?'':' pri')+'" data-act="g-unlock">'+(isR?'Восстановить':'Открыть')+'</button>'+
      '<button class="btn ghost" data-act="g-userec">'+(UI.useRec?'Ввести кодовую фразу':'Забыли фразу? Ключ восстановления')+'</button>'+
      (isR?'<button class="btn ghost" data-act="g-back">Назад</button>':''));
  }
  return '';
}
function gerr(m){UI.gateErr=m;var el=document.getElementById('gerr');if(el)el.textContent=m}
function busy(el,on){if(el){el.classList.toggle('spin',on);el.disabled=on}}

/* ---------- render ---------- */
function render(){
  var app=document.getElementById('app');
  if(UI.screen!=='app'){app.innerHTML=vGate();return}
  var V={today:vToday,tasks:vTasks,card:vCard,advice:vAdvice,progress:vProgress};
  app.innerHTML='<div class="shell">'+vNav()+'<main id="main">'+(storageOK?'':'<p class="warn-bar">Последнее изменение не сохранилось. Сделайте резервную копию в разделе «Данные».</p>')+
    (UPD?'<div class="list" style="margin-bottom:14px"><div class="row"><h4>Доступна версия '+esc(UPD.version)+'</h4><p>Приложение закроется, установит обновление и откроется снова. Данные не пострадают.</p><div class="acts"><button class="btn pri sm" data-act="app-update">Обновить</button></div></div></div>':'')+V[UI.tab]()+'</main></div>';
}

/* ---------- data & security sheets ---------- */
async function prepareBackup(){
  UI.backupFile=null;await saveChain;
  var body=JSON.stringify(Object.assign({},VAULT,{exportedAt:new Date().toISOString()}));
  UI.backupFile=new File([body],'medcard_'+today()+'.enc.json',{type:'application/json'});
  if(sheetKind==='data')openSheet(dataSheet(),'data',true);
}
function dataSheet(){
  var lb=S.backups.slice().sort().pop(),s=sheetHead('Данные');
  s+='<p>Медкарта зашифрована и хранится только на этом устройстве. Резервная копия тоже зашифрована: её можно класть в iCloud Drive, Google Drive или Яндекс Диск, без фразы её не прочитать.</p>';
  s+='<p class="muted">'+(lb?'Последняя копия: '+fmtDate(lb,true)+'.':'Резервных копий ещё не было.')+'</p>';
  s+='<div class="acts"><button class="btn pri" data-act="backup"'+(UI.backupFile?'':' disabled')+'>'+(UI.backupFile?'Сохранить копию':'Готовлю копию…')+'</button></div>';
  s+='<h3>Импорт</h3><p class="muted" style="font-size:14px">Копия с другого устройства или обновление медкарты, которое я подготовлю по новым документам.</p>';
  if(UI.pending){
    s+='<div class="list"><div class="row"><h4>Файл прочитан</h4><p>«Объединить» добавит новое и сохранит ваши отметки. «Заменить» сотрёт текущую медкарту на этом устройстве.</p><div class="acts"><button class="btn pri" data-act="imp-merge">Объединить</button><button class="btn danger" data-act="imp-replace">Заменить всё</button><button class="btn ghost" data-act="imp-cancel">Отмена</button></div></div></div>';
  }else if(UI.foreign){
    s+='<div class="list"><div class="row"><h4>Копия защищена другой фразой</h4><label class="f" for="fp">Кодовая фраза этой копии</label><input id="fp" type="password"><div class="acts"><button class="btn pri" data-act="imp-foreign">Открыть</button><button class="btn ghost" data-act="imp-cancel">Отмена</button></div></div></div>';
  }else{
    s+='<label class="btn" for="imp-in">Открыть файл</label><input class="vh" type="file" id="imp-in" accept=".json,application/json">';
  }
  return s;
}
function securitySheet(){
  var s=sheetHead('Защита'),pk=(VAULT.wraps.pk||[]).filter(function(p){return p.host===location.hostname}),al=S.settings.autolock||5;
  s+='<p>Шифрование AES-256-GCM. Ключ из кодовой фразы — PBKDF2, '+(VAULT.wraps.pass.iter/1000)+' тыс. итераций. Хранилище создано '+fmtDate(VAULT.created.slice(0,10),true)+'.</p>';
  s+='<div class="acts"><button class="btn pri" data-act="lock-now">Заблокировать сейчас</button></div>';
  s+='<h3>Автоблокировка в фоне</h3><div class="pills">'+[1,5,15].map(function(m){return '<button class="pill" data-act="autolock" data-v="'+m+'" aria-pressed="'+(al===m)+'">через '+m+' мин</button>'}).join('')+'</div>';
  if(!TAURI)s+='<h3>Face ID</h3>'+(pk.length?'<p>Включён с '+fmtDate(pk[0].created,true)+'.</p><button class="btn danger" data-act="pk-off">Отключить Face ID</button>':
    (pkPossible()?'<button class="btn" data-act="pk-on">Включить Face ID</button>':'<p class="muted">Недоступно в этом браузере. На ПК вход по кодовой фразе.</p>'));
  s+='<h3>Сменить кодовую фразу</h3><label class="f" for="cp0">Текущая фраза</label><input id="cp0" type="password"><label class="f" for="cp1">Новая, не короче 10 символов</label><input id="cp1" type="password" autocomplete="new-password"><label class="f" for="cp2">Ещё раз</label><input id="cp2" type="password" autocomplete="new-password"><div class="acts"><button class="btn" data-act="chpass">Сменить фразу</button></div>';
  s+='<h3>Новый ключ восстановления</h3><p class="muted" style="font-size:14px">Старый перестанет работать. В уже сохранённых резервных копиях действует тот ключ, что был при их создании.</p><label class="f" for="rp0">Текущая фраза</label><input id="rp0" type="password"><div class="acts"><button class="btn" data-act="newrec">Создать новый ключ</button></div><div id="newrec-out"></div>';
  s+='<h3>Удаление</h3><button class="btn danger" data-act="wipe">Удалить медкарту с этого устройства</button>';
  return s;
}
function isVaultFile(o){return o&&o.format==='zdorovie-vault'&&o.wraps&&o.data}
async function handleImportFile(text){
  var o;try{o=JSON.parse(text)}catch(e){toast('Файл не читается: нужен .json из этого приложения или от Claude');return}
  if(isVaultFile(o)){
    try{var st=await decryptData(o,DK);UI.pending=st;UI.pendingVault=true;UI.foreign=null}catch(e){UI.foreign=o;UI.pending=null}
  }else if(o&&typeof o==='object'&&(o.card||o.tasks||o.daily)){UI.pending=o;UI.pendingVault=false;UI.foreign=null}
  else{toast('В файле нет медкарты');return}
  openSheet(dataSheet(),'data',true);
}
async function shareOrDownload(file){
  if(TAURI){
    var dest=await TAURI.dialog.save({defaultPath:file.name,filters:[{name:'Зашифрованная копия',extensions:['json']}]});
    if(!dest){var ab=new Error('cancel');ab.name='AbortError';throw ab}
    await TAURI.fs.writeTextFile(dest,await file.text());return true;
  }
  var mobile=/iPhone|iPad|Android/.test(navigator.userAgent);
  if(mobile&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Резервная копия медкарты'});return true}
  var a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);return true;
}
function markBackup(){commit(function(){if(S.backups.indexOf(today())<0)S.backups.push(today())});}

/* ---------- actions ---------- */
function dayRec(){var d=UI.day;if(!S.daily[d])S.daily[d]={h:{}};if(!S.daily[d].h)S.daily[d].h={};return S.daily[d]}
function val(id){var e=document.getElementById(id);return e?e.value:''}
async function gateAct(a,el){
  switch(a){
  case 'g-new':UI.screen='setpass';UI.gateErr='';render();break;
  case 'g-setpass':case 'g-newpass':
    var p1=val('p1'),p2=val('p2');if(p1.length<10)return gerr('Фраза короче 10 символов');if(p1!==p2)return gerr('Фразы не совпадают');
    busy(el,true);
    if(a==='g-setpass'){UI.recCode=await newVault(p1);S=blank();UI.screen='recovery'}
    else{VAULT.wraps.pass=await wrapPass(DEK,p1);await storage.put(VAULT);UI.screen='app';toast('Новая фраза сохранена')}
    UI.gateErr='';render();break;
  case 'g-copyrec':try{await navigator.clipboard.writeText(fmtRec(UI.recCode));toast('Скопировано. Вставьте в менеджер паролей')}catch(e){toast('Выделите ключ и скопируйте вручную')}break;
  case 'g-recdone':if(!document.getElementById('rec-ok').checked)return gerr('Подтвердите, что ключ сохранён');
    UI.recCode=null;save();await saveChain;try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
    UI.screen=pkPossible()?'faceid':(UI.afterRestore?'app':'import');UI.gateErr='';render();break;
  case 'g-pk':busy(el,true);try{await pkAdd();toast('Face ID включён');UI.screen=UI.afterRestore?'app':'import';UI.gateErr=''}catch(e){busy(el,false);return gerr(e&&e.message==='noprf'?'Это устройство не поддерживает ключ шифрования через Face ID. Вход останется по фразе.':'Face ID не включён: '+(e&&e.name==='NotAllowedError'?'отменено':'ошибка'))}render();break;
  case 'g-pkskip':UI.screen=UI.afterRestore?'app':'import';UI.gateErr='';render();break;
  case 'g-empty':S=blank();S.habits=[{id:'meds',label:'Лекарства по схеме',xp:5},{id:'meals',label:'Три приёма пищи',xp:5},{id:'walk',label:'Прогулка 20+ минут',xp:5}];M.stamp(blank(),S,Date.now());save();UI.screen='app';render();break;
  case 'g-userec':UI.useRec=!UI.useRec;UI.gateErr='';render();break;
  case 'g-back':UI.restore=null;UI.useRec=false;UI.screen='welcome';UI.gateErr='';render();break;
  case 'g-pkunlock':busy(el,true);try{var d=await pkUnlock();await openWith(d);S=await decryptData(VAULT,DK);UI.screen='app';UI.gateErr='';render()}catch(e){busy(el,false);gerr('Face ID не сработал. Введите кодовую фразу.')}break;
  case 'g-unlock':
    var src=UI.screen==='restore'?UI.restore:VAULT;busy(el,true);
    try{
      var dek=UI.useRec?await unwrapRec(src,val('rk')):await unwrapPass(src,val('up'));
      var k=await dataKey(dek),st=await decryptData(src,k);
      if(UI.screen==='restore'){VAULT=src;VAULT.wraps.pk=(VAULT.wraps.pk||[]);await storage.put(VAULT);UI.restore=null;UI.afterRestore=true}
      await openWith(dek);S=st;
      try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
      if(UI.useRec){UI.useRec=false;UI.screen='newpass'}
      else if(UI.afterRestore&&pkPossible()&&!hasPk())UI.screen='faceid';
      else UI.screen='app';
      UI.gateErr='';render();
    }catch(e){busy(el,false);gerr(UI.useRec?'Ключ не подходит':'Фраза не подходит')}
    break;
  }
}
async function act(a,el){
  if(a.indexOf('g-')===0)return gateAct(a,el);
  if(!S)return;
  var id=el.getAttribute('data-id'),v=el.getAttribute('data-v'),kind=el.getAttribute('data-kind');
  switch(a){
  case 'tab':UI.tab=el.getAttribute('data-tab');render();window.scrollTo(0,0);break;
  case 'day':var nd=addDays(UI.day,+el.getAttribute('data-n'));if(nd<=today()){UI.day=nd;render()}break;
  case 'habit':commit(function(){var r=dayRec();r.h[id]=!r.h[id]});break;
  case 'mood':commit(function(){var r=dayRec(),n=+el.getAttribute('data-n');r.mood=r.mood===n?0:n});break;
  case 'sleep':commit(function(){var r=dayRec(),n=+el.getAttribute('data-n');r.sleep=r.sleep===n?0:n});break;
  case 'can':commit(function(){var r=dayRec();r.can=r.can===v?'':v});break;
  case 'open':var k=el.getAttribute('data-key');UI.open[k]=!UI.open[k];render();break;
  case 'task-done':commit(function(){var t=S.tasks.find(function(x){return x.id===id});if(t)t.done=today()});break;
  case 'task-undo':commit(function(){var t=S.tasks.find(function(x){return x.id===id});if(t)t.done=''},true);break;
  case 'filter':UI.filter=v;render();break;
  case 'adv':UI.adv=v;render();break;
  case 'seg':UI.seg=v;render();break;
  case 'form':openSheet(formSheet(kind,id),'form');break;
  case 'form-save':
    var o=readForm(kind);if(!o)return;var def=FORMS[kind];
    commit(function(){
      if(kind==='patient'){Object.assign(S.card.patient,o);return}
      if(kind==='priv'){Object.assign(S.card.private,o);return}
      var list=getList(def);
      if(id){var it=list.find(function(x){return x.id===id});if(it)Object.assign(it,o)}
      else{o.id=uid();if(kind==='task')o.done='';list.push(o);if(!def.root)S.bonus.push({id:'b-'+o.id,xp:10,date:today()})}
    });closeSheet();break;
  case 'form-del':
    if(!confirm('Удалить запись?'))return;
    commit(function(){var def=FORMS[kind],list=getList(def),i=list.findIndex(function(x){return x.id===id});if(i>=0)list.splice(i,1);S.bonus=S.bonus.filter(function(b){return b.id!=='b-'+id})},true);closeSheet();break;
  case 'priv-open':UI.priv=true;render();break;
  case 'priv-close':UI.priv=false;render();break;
  case 'priv-edit':openSheet(formSheet('priv'),'form');break;
  case 'help':openSheet(helpSheet(),'help');break;
  case 'data':UI.pending=null;UI.foreign=null;openSheet(dataSheet(),'data');prepareBackup();break;
  case 'security':openSheet(securitySheet(),'security');break;
  case 'close':closeSheet();break;
  case 'backup':
    if(!UI.backupFile){openSheet(dataSheet(),'data');prepareBackup();return}
    try{await shareOrDownload(UI.backupFile);markBackup();toast('Копия сохранена');if(sheetKind==='data')openSheet(dataSheet(),'data',true);prepareBackup()}
    catch(e){if(!(e&&e.name==='AbortError'))toast('Не удалось сохранить копию')}
    break;
  case 'imp-merge':var inc=UI.pending,isV=UI.pendingVault;UI.pending=null;
    commit(function(){S=isV?M.merge(S,inc):M.importPlain(S,inc,Date.now())},true,true);closeSheet();toast('Данные объединены');break;
  case 'imp-replace':if(!confirm('Медкарта на этом устройстве будет заменена. Продолжить?'))return;var inc2=UI.pending;UI.pending=null;
    commit(function(){var nx=normalize(inc2);Object.keys(S.tomb).forEach(function(k){nx.tomb[k]=Math.max(nx.tomb[k]||0,S.tomb[k])});S=nx},true);closeSheet();toast('Данные заменены');break;
  case 'imp-cancel':UI.pending=null;UI.foreign=null;openSheet(dataSheet(),'data',true);break;
  case 'imp-foreign':busy(el,true);try{var fd=await unwrapPass(UI.foreign,val('fp')),fk=await dataKey(fd);UI.pending=await decryptData(UI.foreign,fk);UI.pendingVault=true;UI.foreign=null;openSheet(dataSheet(),'data',true)}catch(e){busy(el,false);toast('Фраза не подходит')}break;
  case 'lock-now':lock();break;
  case 'app-update':if(UPD)installUpdate(el);break;
  case 'autolock':commit(function(){S.settings.autolock=+v},true);openSheet(securitySheet(),'security',true);break;
  case 'pk-on':busy(el,true);try{await pkAdd();toast('Face ID включён')}catch(e){toast(e&&e.message==='noprf'?'Устройство не поддерживает ключ через Face ID':'Face ID не включён')}openSheet(securitySheet(),'security',true);break;
  case 'pk-off':if(!confirm('Отключить Face ID? Входить придётся по кодовой фразе.'))return;VAULT.wraps.pk=(VAULT.wraps.pk||[]).filter(function(p){return p.host!==location.hostname});await storage.put(VAULT);toast('Face ID отключён');openSheet(securitySheet(),'security',true);break;
  case 'chpass':
    var c0=val('cp0'),c1=val('cp1'),c2=val('cp2');if(c1.length<10){toast('Новая фраза короче 10 символов');return}if(c1!==c2){toast('Фразы не совпадают');return}
    busy(el,true);try{await unwrapPass(VAULT,c0)}catch(e){busy(el,false);toast('Текущая фраза не подходит');return}
    VAULT.wraps.pass=await wrapPass(DEK,c1);await storage.put(VAULT);toast('Фраза изменена. Сделайте новую резервную копию');openSheet(securitySheet(),'security',true);break;
  case 'newrec':
    busy(el,true);try{await unwrapPass(VAULT,val('rp0'))}catch(e){busy(el,false);toast('Фраза не подходит');return}
    var rb=rnd(20);VAULT.wraps.rec=await wrapRec(DEK,rb);await storage.put(VAULT);busy(el,false);
    document.getElementById('newrec-out').innerHTML='<div class="code" style="margin-top:10px">'+esc(fmtRec(toB32(rb)).replace(/-/g,' '))+'</div><p class="hint">Сохраните его и сделайте новую резервную копию.</p>';break;
  case 'wipe':if(!confirm('Удалить медкарту с этого устройства? Без резервной копии её не восстановить.'))return;if(!confirm('Точно удалить?'))return;
    await saveChain;await storage.del();VAULT=null;lock();break;
  case 'habits':openSheet(habitsSheet(),'habits');break;
  case 'habit-add':var hl=val('hb-label').trim(),hx=parseInt(val('hb-xp'),10)||3;if(!hl){toast('Введите название');return}
    commit(function(){S.habits.push({id:uid(),label:hl,xp:Math.max(1,Math.min(20,hx))})},true);openSheet(habitsSheet(),'habits',true);break;
  case 'habit-del':commit(function(){S.habits=S.habits.filter(function(h){return h.id!==id})},true);openSheet(habitsSheet(),'habits',true);break;
  case 'safety-save':var sd=val('sf-doctor').trim(),sc=val('sf-contact').trim(),sh=val('sf-helps').trim();
    commit(function(){S.safety.doctor=sd;S.safety.contact=sc;S.safety.helps=sh},true);toast('План сохранён');break;
  case 'phq-start':UI.phq=[null,null,null,null,null,null,null,null,null];openSheet(phqSheet(),'phq');break;
  case 'phq-ans':UI.phq[+el.getAttribute('data-i')]=+v;openSheet(phqSheet(),'phq',true);break;
  case 'phq-submit':
    var items=UI.phq.slice(),score=items.reduce(function(x,y){return x+y},0),rec={date:today(),score:score,items:items};
    var prev=S.phq.filter(function(p){return p.date!==rec.date}).sort(function(a,b){return a.date<b.date?-1:1}).pop();
    commit(function(){upsertBy(S.phq,[rec],'date')});openSheet(phqResult(rec,prev),'phq');UI.phq=null;break;
  case 'weight-save':
    var kg=num(val('w-kg')),wa=num(val('w-waist'));
    if(kg==null||kg<30||kg>250){toast('Введите вес в килограммах');return}
    commit(function(){var r={date:today(),kg:kg};if(wa!=null)r.waist=wa;upsertBy(S.weights,[r],'date');S.tasks.forEach(function(t){if(t.trigger==='weight'&&!t.done)t.done=today()})});break;
  case 'weight-del':if(!confirm('Удалить замер?'))return;var wd=el.getAttribute('data-d');commit(function(){S.weights=S.weights.filter(function(w){return w.date!==wd})},true);break;
  }
}
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-act]');
  if(!el){if(e.target.id==='sheet')closeSheet();return}
  if(el.disabled)return;act(el.getAttribute('data-act'),el);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!document.getElementById('sheet').hidden)closeSheet();
  if(e.key==='Enter'&&e.target.tagName==='INPUT'&&UI.screen!=='app'){var b=document.querySelector('.gate [data-act="g-unlock"]')||document.querySelector('.gate .btn.pri');if(b)b.click()}
});
function readFileText(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(String(r.result))};r.onerror=rej;r.readAsText(f)})}
document.addEventListener('change',async function(e){
  var t=e.target,f=t.files&&t.files[0];if(!f)return;var text;
  try{text=await readFileText(f)}catch(err){toast('Не удалось прочитать файл');return}t.value='';
  if(t.id==='restore-in'){
    var o;try{o=JSON.parse(text)}catch(err){return gerr('Файл не читается')}
    if(!isVaultFile(o))return gerr('Это не зашифрованная копия. Сначала создайте хранилище, затем импортируйте файл.');
    UI.restore=o;UI.screen='restore';UI.gateErr='';render();
  }else if(t.id==='file-in'){
    var p;try{p=JSON.parse(text)}catch(err){return gerr('Файл не читается')}
    if(!(p&&(p.card||p.tasks)))return gerr('В файле нет медкарты');
    S=M.importPlain(blank(),p,Date.now());save();UI.screen='app';render();toast('Медкарта зашифрована и сохранена');
  }else if(t.id==='imp-in'){handleImportFile(text)}
});

/* автоблокировка: в фоне дольше заданного времени */
var hiddenAt=0;
document.addEventListener('visibilitychange',function(){
  if(document.hidden){hiddenAt=Date.now()}
  else if(DK&&hiddenAt&&Date.now()-hiddenAt>((S&&S.settings.autolock)||5)*60000){lock()}
});

/* Автообновление настольной версии из GitHub Releases. Установщик сам закрывает приложение. */
var UPD=null;
function checkUpdate(){
  if(!TAURI||!TAURI.updater)return;
  TAURI.updater.check().then(function(u){if(u){UPD=u;render()}}).catch(function(){});
}
async function installUpdate(el){
  busy(el,true);
  try{await saveChain;await UPD.downloadAndInstall()}catch(e){busy(el,false);toast('Обновление не установилось. Попробуйте позже')}
}
if(!TAURI&&'serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js').catch(function(){})}
(async function boot(){
  try{VAULT=await storage.get()}catch(e){storageOK=false}
  UI.screen=VAULT?'lock':'welcome';
  var hz=(location.hash||'').slice(1);if(TABS.some(function(t){return t[0]===hz}))UI.tab=hz;
  render();checkUpdate();
})();
})();
