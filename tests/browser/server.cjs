// Isolated browser-test server: real Firebase emulators, simulated OTP and Razorpay.
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const admin=require('../../functions/node_modules/firebase-admin');admin.initializeApp({projectId:'demo-eshwe-launch'});const db=admin.firestore();
const {loadBackend}=require('../helpers/backend.cjs');let sequence=0;const payments=new Map();const gatewayOrders=new Map();const refunds=new Map();
class Razorpay{constructor(){this.orders={create:async body=>{const order={...body,id:`order_${++sequence}`};gatewayOrders.set(order.id,order);return order;},fetchPayments:async id=>({items:[...payments.values()].filter(p=>p.order_id===id)})};this.payments={fetch:async id=>payments.get(id)};this.refunds={fetch:async id=>[...refunds.values()].find(r=>r.id===id)};}}
const backend=loadBackend(db,{auth:()=>admin.auth(),FieldValue:admin.firestore.FieldValue,mocks:{razorpay:Razorpay},fetch:async(url,options)=>{const match=url.match(/^https:\/\/api\.razorpay\.com\/v1\/payments\/([^/]+)\/refund$/);if(!match)throw Error('Unexpected external request in browser fixture');const key=options.headers['X-Refund-Idempotency'];const body=JSON.parse(options.body);if(!refunds.has(key))refunds.set(key,{id:`refund_${refunds.size}`,payment_id:decodeURIComponent(match[1]),amount:body.amount,notes:body.notes,status:'processed'});return{ok:true,json:async()=>refunds.get(key)};}});
const root=path.resolve(process.env.BROWSER_BUILD_ROOT || 'out');const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.txt':'text/x-component','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.xml':'application/xml'};
async function main(){
 const catalogue=JSON.parse(fs.readFileSync('.catalogue-build/products.json'));const products=catalogue.slice(0,3);
 for(const [i,p] of products.entries())await db.doc(`sarees/${p.id}`).set({...p,price:100+i,availableStock:i===0?1:5,reservedStock:0,status:'active',createdAt:admin.firestore.Timestamp.now(),updatedAt:admin.firestore.Timestamp.now()});
 for(const uid of ['alice','bob','owner']){try{await admin.auth().createUser({uid,phoneNumber:uid==='alice'?'+919999999991':uid==='bob'?'+919999999992':'+919999999993',...(uid==='owner'?{email:'ajyghosh@gmail.com',emailVerified:true}:{})});}catch(e){if(e.code!=='auth/uid-already-exists'&&e.code!=='auth/phone-number-already-exists')throw e;}}
 const address=(id,label)=>({id,label,fullName:'Alice Test',email:'alice@example.test',phone:'+919999999991',address:`${label} test street`,city:'Kochi',state:'Kerala',pincode:'682001'});
 await db.doc('customerProfiles/alice').set({...address('office','Office'),addresses:[address('home','Home'),address('office','Office')],selectedAddressId:'office',cartItems:[],favoriteSkus:[]});
 await db.doc('customerProfiles/bob').set({cartItems:[],favoriteSkus:[]});
 fs.writeFileSync('/private/tmp/eshwe-browser-fixture.json',JSON.stringify(products));
 http.createServer(async(req,res)=>{
  res.set=(key,value)=>{res.setHeader(key,value);return res;};res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};res.send=value=>{res.end(value);return res;};req.get=name=>req.headers[name.toLowerCase()];
  try{const url=new URL(req.url,'http://127.0.0.1:3000');let body='';for await(const chunk of req)body+=chunk;req.body=body?JSON.parse(body):{};req.rawBody=Buffer.from(body);req.query=Object.fromEntries(url.searchParams);
   if(url.pathname==='/__test/payment'){const o=gatewayOrders.get(req.body.orderId);const p={id:`pay_${o.id}`,order_id:o.id,amount:o.amount,currency:o.currency,status:req.body.status||'captured',created_at:Math.floor(Date.now()/1000)};payments.set(p.id,p);return res.json({razorpay_order_id:o.id,razorpay_payment_id:p.id,razorpay_signature:crypto.createHmac('sha256','test-RAZORPAY_KEY_SECRET').update(`${o.id}|${p.id}`).digest('hex')});}
   if(url.pathname==='/__test/reset-stock'){await db.doc(`sarees/${products[0].id}`).update(req.body);return res.json({ok:true});}
   if(url.pathname.startsWith('/test-api/')){
    const name=url.pathname.split('/').pop();
    if(name==='sendCustomerOtp')return res.json({success:true,cooldownSeconds:0});
    if(name==='verifyCustomerOtp'){const uid=req.body.phone.endsWith('2')?'bob':req.body.phone.endsWith('3')?'owner':'alice';const token=[{alg:'none',typ:'JWT'},{uid,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.';return res.json({success:true,customToken:token});}
    if(backend[name])return await backend[name](req,res);return res.status(404).json({error:'Unknown test API'});
   }
   let target=path.join(root,decodeURIComponent(url.pathname));if(!target.startsWith(root+path.sep)&&target!==root)return res.status(403).send('Forbidden');
   if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
   if(!fs.existsSync(target)){
    if(url.pathname.startsWith('/product/'))target=path.join(root,'product',url.pathname.endsWith('.txt')?'index.txt':'index.html');
    else if(url.pathname.startsWith('/app/product/'))target=path.join(root,'app','product',url.pathname.endsWith('.txt')?'index.txt':'index.html');
    else if(url.pathname.startsWith('/app/search/'))target=path.join(root,'app','search',url.pathname.endsWith('.txt')?'index.txt':'index.html');
    else if(url.pathname.startsWith('/shop/'))target=path.join(root,'shop',url.pathname.endsWith('.txt')?'index.txt':'index.html');
    else return res.status(404).send('Not found');
   }
   res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));
  }catch(e){console.error(e.message);if(!res.headersSent)res.status(500).json({error:e.message});else res.end();}
 }).listen(3000,'127.0.0.1',()=>console.log('Browser test server ready on 127.0.0.1:3000; demo data only.'));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
