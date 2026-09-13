const test=require('node:test');const assert=require('node:assert/strict');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
const {Firestore,FieldValue}=require('../../functions/node_modules/@google-cloud/firestore');
const {initializeApp,deleteApp}=require('firebase/app');const fs=require('firebase/firestore');
const {createCommerce}=require('../../functions/commerce');const {createProductService}=require('../../functions/products');
const projectId='demo-eshwe-launch';const db=new Firestore({projectId});const apps=[];let n=0;
function client(uid,email,verified=false){const app=initializeApp({projectId,apiKey:'demo-key',appId:'demo'},`test-${++n}`);apps.push(app);const client=fs.getFirestore(app);fs.connectFirestoreEmulator(client,'127.0.0.1',8080,uid?{mockUserToken:{sub:uid,email:email||`${uid}@example.test`,email_verified:verified}}:{});return client;}
const fixture={name:'Emulator test',sku:'EMULATOR-A',slug:'emulator-a',category:'Silk',fabric:'Silk',price:100,availableStock:1,status:'active',updatedAt:FieldValue.serverTimestamp()};
test.before(async()=>{const r=await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});assert.equal(r.status,200);await db.collection('sarees').doc('A').set(fixture);await db.collection('sarees').doc('DRAFT').set({...fixture,sku:'DRAFT',slug:'draft',status:'draft'});});
test.after(async()=>{for(const app of apps){await fs.terminate(fs.getFirestore(app));await deleteApp(app);}await db.terminate();});
test('real Firestore: last item race, two-product capture, replay and stale admin edit',async()=>{
 let creates=0;const service=createCommerce({db,timestamp:()=>FieldValue.serverTimestamp(),gateway:{createOrder:async body=>({...body,id:`gateway-${++creates}`})}});
 const attempts=await Promise.allSettled(Array.from({length:8},(_,i)=>service.reserve({userId:`race-${i}`,checkoutKey:'emulator-checkout-00001',items:[{productId:'A',sku:'EMULATOR-A',quantity:1}],customer:{fullName:'Test'}})));
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(creates,1);assert.equal((await db.doc('sarees/A').get()).data().availableStock,0);
 await db.doc('sarees/B').set({...fixture,sku:'B',slug:'b',availableStock:2});await db.doc('sarees/C').set({...fixture,sku:'C',slug:'c',availableStock:2});
 const before=(await db.doc('sarees/B').get()).data().updatedAt.toMillis();
 const order=await service.reserve({userId:'multi',checkoutKey:'emulator-checkout-00002',items:[{productId:'B',sku:'B',quantity:1},{productId:'C',sku:'C',quantity:1}],customer:{fullName:'Test'}});
 const p={id:'payment-multi',order_id:order.razorpayOrderId,amount:order.amountPaise,currency:'INR',status:'captured'};await Promise.all([service.recordPayment(order.id,p),service.recordPayment(order.id,p)]);
 assert.equal((await db.doc('sarees/B').get()).data().availableStock,1);assert.equal((await db.doc('sarees/C').get()).data().reservedStock,0);
 await assert.rejects(createProductService({db,timestamp:()=>FieldValue.serverTimestamp()}).save({id:'B',expectedVersion:before,changes:{availableStock:2}},'owner'),e=>e.status===409);
});
test('real rules: public catalogue is readable, drafts and direct stock changes are blocked',async()=>{
 const guest=client();assert.equal((await fs.getDoc(fs.doc(guest,'sarees/A'))).exists(),true);await assert.rejects(fs.getDoc(fs.doc(guest,'sarees/DRAFT')),e=>e.code==='permission-denied');
 const q=fs.query(fs.collection(guest,'sarees'),fs.where('status','in',['active','out_of_stock']));assert.ok((await fs.getDocs(q)).size>=1);
 for(const user of [client('alice'),client('owner','ajyghosh@gmail.com',true)])await assert.rejects(fs.updateDoc(fs.doc(user,'sarees/A'),{availableStock:99}),e=>e.code==='permission-denied');
});
test('real rules: customer data and orders are isolated; owners cannot forge payment or stock commits',async()=>{
 await db.doc('customerProfiles/alice').set({favoriteSkus:['A']});await db.doc('checkoutOrders/private').set({userId:'alice',paymentStatus:'captured'});
 const alice=client('alice');const bob=client('bob');const owner=client('owner','ajyghosh@gmail.com',true);
 assert.equal((await fs.getDoc(fs.doc(alice,'checkoutOrders/private'))).exists(),true);
 for(const path of ['customerProfiles/alice','checkoutOrders/private'])await assert.rejects(fs.getDoc(fs.doc(bob,path)),e=>e.code==='permission-denied');
 await fs.updateDoc(fs.doc(alice,'customerProfiles/alice'),{favoriteSkus:['B']});
 for(const user of [alice,owner])await assert.rejects(fs.updateDoc(fs.doc(user,'checkoutOrders/private'),{paymentStatus:'captured',inventoryCommitted:true}),e=>e.code==='permission-denied');
 await assert.rejects(fs.setDoc(fs.doc(alice,'productKeys/fake'),{productId:'A'}),e=>e.code==='permission-denied');
});
test('real customer history orders on the server before limiting and supports older pages',async()=>{
 const batch=db.batch();for(let i=0;i<151;i++)batch.set(db.doc(`checkoutOrders/history-${String(i).padStart(3,'0')}`),{userId:'history',createdAt:new Date(1000+i*1000),status:'paid'});await batch.commit();
 const {loadSource}=require('../helpers/source.cjs');const customer=client('history');const api=loadSource('src/lib/orders.ts',{'@/lib/firebase':{db:customer},'@/lib/api':{postJson:()=>{throw Error('No API expected');}}});
 const read=count=>new Promise((resolve,reject)=>{const stop=api.subscribeToCustomerOrders('history',orders=>{if(orders.length===count){stop();resolve(orders);}},reject,count);});
 const recent=await read(50);assert.equal(recent[0].id,'history-150');assert.equal(recent[49].id,'history-101');const all=await read(151);assert.equal(all.at(-1).id,'history-000');
});

test('real Firestore: concurrent partial refunds, replay, remainder and protected refund ledger',async()=>{
 const refunds=new Map();const service=createCommerce({db,timestamp:()=>FieldValue.serverTimestamp(),gateway:{refund:async(payment,body,key)=>{if(!refunds.has(key))refunds.set(key,{id:`refund-${refunds.size}`,payment_id:payment,amount:body.amount,notes:body.notes,status:'processed'});return refunds.get(key);}}});
 await db.doc('checkoutOrders/refund-test').set({userId:'alice',paymentCaptured:true,razorpayPaymentId:'original',amountPaise:10000,inventoryCommitted:true,reservationState:'committed'});
 const input={amountPaise:2525,expectedRefundedAmountPaise:0,requestId:'emulator-refund-00001'};
 await Promise.all(Array.from({length:5},()=>service.requestAmountRefund('refund-test',input,'owner')));
 assert.equal(refunds.size,1);assert.equal((await service.readOrder('refund-test')).refundedAmountPaise,2525);
 await assert.rejects(service.requestAmountRefund('refund-test',{...input,requestId:'emulator-refund-00002'},'owner'),e=>e.status===409);
 const final=await service.requestAmountRefund('refund-test',{amountPaise:7475,expectedRefundedAmountPaise:2525,requestId:'emulator-refund-00003'},'owner');
 assert.equal(final.refundStatus,'processed');assert.equal(final.refundedAmountPaise,10000);assert.equal(refunds.size,2);
 for(const user of [client('alice'),client('owner','ajyghosh@gmail.com',true)])await assert.rejects(fs.setDoc(fs.doc(user,'checkoutOrders/refund-test/refundRequests/forged'),{amountPaise:99999,status:'processed'}),e=>e.code==='permission-denied');
});
