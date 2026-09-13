const fs=require('node:fs');const vm=require('node:vm');const {createRequire}=require('node:module');const path=require('node:path');
function loadBackend(db, overrides={}){
 const filename=path.resolve('functions/index.js');const localRequire=createRequire(filename);const module={exports:{}};
 const firestore=()=>db;firestore.FieldValue=overrides.FieldValue||{serverTimestamp:()=>1};
 const admin={apps:[{}],firestore,auth:overrides.auth||(()=>({verifyIdToken:async token=>{if(!overrides.users?.[token])throw Error('Invalid auth');return overrides.users[token];}}))};
 const mocks={...overrides.mocks,'firebase-admin':admin,'firebase-functions/v2/https':{onRequest:(_,fn)=>fn},'firebase-functions/v2/firestore':{onDocumentCreated:(_,fn)=>fn},'firebase-functions/v2/scheduler':{onSchedule:(_,fn)=>fn},'firebase-functions/params':{defineSecret:name=>({value:()=>`test-${name}`})},'firebase-functions/logger':{error(){},warn(){},info(){}}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.testOnly={verifyStoredCustomerCode,verifyPaymentForOrder,hashVerificationCode,hashValue,buildOrderConfirmationPayload,handleWebhookEvent};',{require:id=>id in mocks?mocks[id]:localRequire(id),module,exports:module.exports,process:{env:{}},Buffer,console,URL,Date,Error,fetch:overrides.fetch||(()=>{throw Error('Unexpected external request');}),AbortSignal},{filename});
 return module.exports;
}
async function request(handler,body={},token){let status=200,result;const req={method:'POST',body,headers:{},get:name=>name.toLowerCase()==='authorization'&&token?`Bearer ${token}`:undefined};const res={set(){return this;},status(value){status=value;return this;},json(value){result=value;return this;},send(value){result=value;return this;}};await handler(req,res);return {status,body:result};}
module.exports={loadBackend,request};
