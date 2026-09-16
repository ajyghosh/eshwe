const test=require('node:test');const assert=require('node:assert/strict');
const {createProductService}=require('../functions/products');const {memoryFirestore}=require('./helpers/firestore.cjs');
const product={name:'Test saree',sku:'TEST-1',slug:'test-saree',category:'Silk',fabric:'Silk',price:100,availableStock:1,status:'active',updatedAt:1,reservedStock:0};
function fixture(){const f=memoryFirestore({'sarees/A':product});return {...f,service:createProductService({db:f.db,timestamp:()=>2})};}
test('stale admin form cannot restore reserved/sold stock',async()=>{const f=fixture();await f.db.collection('sarees').doc('A').update({availableStock:0,reservedStock:1,updatedAt:2});await assert.rejects(f.service.save({id:'A',expectedVersion:1,changes:{availableStock:1,name:'Changed'}},'owner'),e=>e.status===409);assert.equal(f.records.get('sarees/A').availableStock,0);});
test('content-only admin save preserves stock and archive retains image history',async()=>{const f=fixture();await f.db.collection('sarees').doc('A').update({primaryImageUrl:'saved-image'});await f.service.save({id:'A',expectedVersion:1,changes:{status:'draft'}},'owner');assert.equal(f.records.get('sarees/A').availableStock,1);assert.equal(f.records.get('sarees/A').primaryImageUrl,'saved-image');assert.equal(f.records.get('sarees/A').status,'draft');});
test('concurrent product creation enforces unique SKU and URL atomically',async()=>{const f=fixture();const changes={...product,sku:'NEW',slug:'new-product'};delete changes.updatedAt;delete changes.reservedStock;const results=await Promise.allSettled([f.service.save({changes},'one'),f.service.save({changes},'two')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);});
test('legacy SKU/slug conflicts, stock tampering and SKU edits rejected',async()=>{const f=fixture();for(const changes of [{sku:'CHANGED'},{reservedStock:100},{availableStock:-1},{availableStock:0.5}])await assert.rejects(f.service.save({id:'A',expectedVersion:1,changes},'owner'));const changes={...product,sku:'NEW'};delete changes.updatedAt;delete changes.reservedStock;await assert.rejects(f.service.save({changes},'owner'),e=>e.status===409);});
test('delete removes catalogue record while keeping order snapshots, media references and identities',async()=>{
 const f=fixture();const order={cartItems:[{productId:'A',sku:product.sku,name:product.name,primaryImageUrl:'saved-image'}]};await f.db.collection('checkoutOrders').doc('O').set(order);
 await f.service.remove({id:'A',expectedVersion:1},'owner');assert.equal(f.records.has('sarees/A'),false);assert.deepEqual(f.records.get('checkoutOrders/O'),order);
 assert.ok([...f.records.values()].some(v=>v.action==='product_deleted'&&v.actor==='owner'));
 const changes={...product};delete changes.updatedAt;delete changes.reservedStock;await assert.rejects(f.service.save({changes},'owner'),e=>e.status===409);
});
test('delete rejects reserved stock, stale versions and malformed IDs without removing products',async()=>{
 const f=fixture();await assert.rejects(f.service.remove({id:'A',expectedVersion:0},'owner'),e=>e.status===409);
 await f.db.collection('sarees').doc('A').update({reservedStock:1});await assert.rejects(f.service.remove({id:'A',expectedVersion:1},'owner'),e=>e.status===409);assert.ok(f.records.has('sarees/A'));
 for(const id of ['', '../A',null])await assert.rejects(f.service.remove({id,expectedVersion:1},'owner'),e=>e.status===400);
 await assert.rejects(f.service.remove({id:'missing',expectedVersion:null},'owner'),e=>e.status===404);
});
test('concurrent stock reservation wins safely against deletion',async()=>{
 const f=fixture();await Promise.allSettled([f.db.runTransaction(async tx=>{const ref=f.db.collection('sarees').doc('A');const s=await tx.get(ref);if(s.exists)tx.update(ref,{reservedStock:1,availableStock:0,updatedAt:2});}),f.service.remove({id:'A',expectedVersion:1},'owner')]);
 const remaining=f.records.get('sarees/A');assert.ok(remaining&&remaining.reservedStock===1);
});
test('delete endpoint requires a verified owner and explicit delete action',async()=>{
 const {loadBackend,request}=require('./helpers/backend.cjs');const f=fixture();const api=loadBackend(f.db,{users:{customer:{uid:'c'},unverified:{uid:'u',email:'ajyghosh@gmail.com',email_verified:false},owner:{uid:'o',email:'ajyghosh@gmail.com',email_verified:true}}});const payload={action:'delete',id:'A',expectedVersion:1};
 for(const [token,status] of [[undefined,403],['customer',403],['unverified',403]])assert.equal((await request(api.ownerProductAction,payload,token)).status,status);
 assert.equal((await request(api.ownerProductAction,{...payload,action:'bad'},'owner')).status,400);assert.ok(f.records.has('sarees/A'));
 assert.equal((await request(api.ownerProductAction,payload,'owner')).status,200);assert.equal(f.records.has('sarees/A'),false);
});
