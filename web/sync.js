/* Синхронизация через Google Drive, appDataFolder/vault.enc.json. Без DOM: ядро гоняют node-тесты (tests/sync.test.js).
   В облако уходит тот же конверт, что лежит локально, но без wraps.pk (Face ID привязан к устройству) и без local
   (метаданные синхронизации и зашифрованный refresh token). Данные внутри конверта зашифрованы DEK. */
(function(root){
'use strict';
var NAME='vault.enc.json';
var API='https://www.googleapis.com/drive/v3/files',UP='https://www.googleapis.com/upload/drive/v3/files';

function cloudEnvelope(v){
  var w=Object.assign({},v.wraps);delete w.pk;
  return {format:v.format,v:v.v,created:v.created,updated:v.updated,wraps:w,data:v.data};
}
function at(w){return (w&&+w.at)||0}
function differs(a,b){return JSON.stringify(a||null)!==JSON.stringify(b||null)}
/* Обёртку DEK сменили на другом устройстве (новая фраза или ключ восстановления): берём ту, что новее. */
function newerWraps(a,b){return ['pass','rec'].filter(function(k){return a[k]&&differs(a[k],b[k])&&at(a[k])>at(b[k])})}

/* Drive REST. fx — fetch (в Tauri fetch плагина http), token(force) — access token, force=true после 401. */
function driveApi(fx,token){
  async function call(url,init,retried){
    init=init||{};
    var r=await fx(url,Object.assign({},init,{headers:Object.assign({},init.headers,{Authorization:'Bearer '+(await token(!!retried))})}));
    if(r.status===401&&!retried)return call(url,init,true);
    if(!r.ok){var e=new Error('drive '+r.status);e.status=r.status;throw e}
    return r;
  }
  return {
    find:async function(){
      var q=encodeURIComponent("name='"+NAME+"' and trashed=false");
      var j=await (await call(API+'?spaces=appDataFolder&orderBy=createdTime&pageSize=10&fields=files(id,version,modifiedTime)&q='+q)).json();
      return (j.files&&j.files[0])||null;
    },
    meta:async function(id){return (await call(API+'/'+id+'?fields=id,version,modifiedTime')).json()},
    download:async function(id){return (await call(API+'/'+id+'?alt=media')).text()},
    create:async function(body){
      var b='zdorovie-'+Math.random().toString(36).slice(2);
      var payload='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:NAME,parents:['appDataFolder']})+
        '\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+b+'--';
      return (await call(UP+'?uploadType=multipart&fields=id,version',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body:payload})).json();
    },
    update:async function(id,body){
      return (await call(UP+'/'+id+'?uploadType=media&fields=id,version',{method:'PATCH',headers:{'Content-Type':'application/json'},body:body})).json();
    }
  };
}

/* Один проход синхронизации.
   c.drive — driveApi; c.vault — локальный конверт (c.vault.local.sync — метаданные); c.S — расшифрованное состояние;
   c.decrypt(env) — состояние облака локальным DEK (бросает, если DEK другой); c.merge(a,b), c.equal(a,b) — из model.js;
   c.persist(withData) — сохранить локально (withData: перешифровать c.S в c.vault.data); c.now() — время.
   Возвращает {status:'created'|'ok'|'foreign'|'busy', changed, uploaded, remote}. */
async function run(c){
  var v=c.vault,sy=v.local.sync,now=c.now();
  var meta=await c.drive.find();
  if(!meta){
    var m=await c.drive.create(JSON.stringify(cloudEnvelope(v)));
    Object.assign(sy,{fileId:m.id,version:String(m.version),dirty:false,at:now});
    await c.persist(false);return {status:'created',uploaded:true};
  }
  sy.fileId=meta.id;
  if(String(meta.version)===sy.version&&!sy.dirty){sy.at=now;await c.persist(false);return {status:'ok'}}
  var changed=false;
  for(var i=0;i<3;i++){
    var env;try{env=JSON.parse(await c.drive.download(meta.id))}catch(e){if(e&&e.status)throw e;env=null}
    if(!env||env.format!=='zdorovie-vault'||!env.data||!env.wraps)return {status:'foreign',remote:env,meta:meta};
    var rs;try{rs=await c.decrypt(env)}catch(e){return {status:'foreign',remote:env,meta:meta}}
    var adopt=newerWraps(env.wraps,v.wraps);
    adopt.forEach(function(k){v.wraps[k]=env.wraps[k]});
    var merged=c.merge(c.S,rs);
    if(!c.equal(merged,c.S)){c.S=merged;changed=true;await c.persist(true)}
    else if(adopt.length)await c.persist(false);
    var needUp=!c.equal(c.merge(rs,c.S),rs)||newerWraps(v.wraps,env.wraps).length>0;
    if(!needUp){Object.assign(sy,{version:String(meta.version),dirty:false,at:now});await c.persist(false);return {status:'ok',changed:changed}}
    var m2=await c.drive.meta(meta.id);
    if(String(m2.version)!==String(meta.version)){meta=m2;continue}
    var up=await c.drive.update(meta.id,JSON.stringify(cloudEnvelope(v)));
    Object.assign(sy,{version:String(up.version),dirty:false,at:now});
    await c.persist(false);return {status:'ok',changed:changed,uploaded:true};
  }
  return {status:'busy',changed:changed};
}

var api={NAME:NAME,cloudEnvelope:cloudEnvelope,newerWraps:newerWraps,driveApi:driveApi,run:run};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ZSync=api;
})(typeof self!=='undefined'?self:this);
