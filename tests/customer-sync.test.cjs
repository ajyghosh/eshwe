const test=require('node:test');const assert=require('node:assert/strict');const {loadSource}=require('./helpers/source.cjs');const {memoryFirestore}=require('./helpers/firestore.cjs');
function fixture(){const f=memoryFirestore();const firestore={doc:(_,collection,id)=>f.db.collection(collection).doc(id),runTransaction:(_,fn)=>f.db.runTransaction(tx=>fn({...tx,get:async ref=>{const s=await tx.get(ref);return {...s,exists:()=>s.exists};}})),serverTimestamp:()=>1};return {...f,api:loadSource('src/lib/customer-profiles.ts',{'firebase/firestore':firestore,'@/lib/firebase':{db:f.db}})};}
const address=id=>({id,label:id,fullName:'Tester',email:'test@example.test',phone:'+919999999999',address:'Test street',city:'City',state:'State',pincode:'123456'});
const line={sku:'SKU',slug:'test',name:'Test',price:100,quantity:1,availableStock:1,status:'active'};
test('PWA address edit preserves other web addresses and selected address',async()=>{const f=fixture();await f.api.saveCustomerAddress('alice',address('home'));await f.api.saveCustomerAddress('alice',address('office'));await f.api.saveCustomerAddress('alice',{...address('home'),city:'Changed'},address('home'),false);const p=f.records.get('customerProfiles/alice');assert.equal(p.addresses.length,2);assert.equal(p.selectedAddressId,'office');assert.equal(f.api.getSelectedAddress(p).id,'office');});
test('two devices saving different addresses preserve both; same-address stale edit is rejected',async()=>{const f=fixture();await Promise.all([f.api.saveCustomerAddress('alice',address('home')),f.api.saveCustomerAddress('alice',address('office'))]);assert.equal(f.records.get('customerProfiles/alice').addresses.length,2);await f.api.saveCustomerAddress('alice',{...address('home'),city:'New'},address('home'));await assert.rejects(f.api.saveCustomerAddress('alice',{...address('home'),city:'Stale'},address('home')));});
test('concurrent wishlist additions/removal do not overwrite unrelated items',async()=>{const f=fixture();await f.api.changeCustomerFavorites('alice',['A','B']);await Promise.all([f.api.changeCustomerFavorites('alice',['C']),f.api.changeCustomerFavorites('alice',[],['A'])]);assert.deepEqual([...f.records.get('customerProfiles/alice').favoriteSkus].sort(),['B','C']);});
test('guest migration is once only, merges snapshots without doubling, and matches legacy SKU to ID',async()=>{const f=fixture();await f.api.changeCustomerCart('alice',()=>[{...line,productId:'id'}]);await Promise.all([f.api.migrateCustomerCart('alice',[line],'migration'),f.api.migrateCustomerCart('alice',[line],'migration')]);let p=f.records.get('customerProfiles/alice');assert.equal(p.cartItems.length,1);assert.equal(p.cartItems[0].quantity,1);await f.api.changeCustomerCart('alice',()=>[]);await f.api.migrateCustomerCart('alice',[line],'migration');assert.equal(f.records.get('customerProfiles/alice').cartItems.length,0);});
test('cart edits from two devices and different accounts stay isolated',async()=>{const f=fixture();await Promise.all([f.api.changeCustomerCart('alice',items=>[...items,line]),f.api.changeCustomerCart('alice',items=>[...items,{...line,sku:'B'}]),f.api.changeCustomerCart('bob',()=>[{...line,sku:'PRIVATE'}])]);assert.equal(f.records.get('customerProfiles/alice').cartItems.length,2);assert.equal(f.records.get('customerProfiles/bob').cartItems[0].sku,'PRIVATE');});
test('missing, draft and deleted products become unavailable; stock caps displayed quantities',()=>{const {syncCartItemsWithCatalogue,mergeCartSnapshots}=loadSource('src/lib/cart-state.ts');assert.equal(syncCartItemsWithCatalogue([line],[])[0].status,'out_of_stock');const result=syncCartItemsWithCatalogue([{...line,quantity:5}],[{...line,id:'id',availableStock:2}]);assert.equal(result[0].quantity,2);assert.equal(result[0].productId,'id');assert.equal(mergeCartSnapshots([line],[line])[0].quantity,1);});
test('interrupted guest migration belongs to first account and is never imported by the next customer',()=>{
 const values=new Map([['guest',JSON.stringify([line])]]);const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),get length(){return values.size},key:i=>[...values.keys()][i]};
 const {claimGuestData}=loadSource('src/lib/guest-migration.ts',{}, {crypto:require('node:crypto')});
 const first=claimGuestData(storage,'guest','alice');assert.equal(first.length,1);assert.equal(storage.getItem('guest'),null);assert.equal(claimGuestData(storage,'guest','bob').length,0);assert.equal(claimGuestData(storage,'guest','alice')[0].id,first[0].id);
});
test('wishlist migration retry cannot restore an item removed after successful import',async()=>{const f=fixture();await f.api.changeCustomerFavorites('alice',['A'],[],'job');await f.api.changeCustomerFavorites('alice',[],['A']);await f.api.changeCustomerFavorites('alice',['A'],[],'job');assert.equal(f.records.get('customerProfiles/alice').favoriteSkus.length,0);});

test('cart operation retries apply once, preserve other devices, and never restore purchased items', async () => {
 const f=fixture();const add={removed:[],changes:[{item:line,delta:1}]};
 await Promise.all([f.api.saveCustomerCartMutation('alice','add-a',add),f.api.saveCustomerCartMutation('alice','add-a',add)]);
 assert.equal(f.records.get('customerProfiles/alice').cartItems[0].quantity,1);
 await f.api.changeCustomerCart('alice',items=>[...items,{...line,sku:'B'}]);
 await f.api.saveCustomerCartMutation('alice','increase-a',add);
 assert.equal(f.records.get('customerProfiles/alice').cartItems.find(i=>i.sku==='B').quantity,1);
 await f.api.changeCustomerCart('alice',()=>[]); // Payment removes purchased items.
 for(let i=0;i<35;i++)await f.api.saveCustomerCartMutation('alice','empty-'+i,{removed:[],changes:[]});
 await f.api.saveCustomerCartMutation('alice','add-a',add);
 assert.equal(f.records.get('customerProfiles/alice').cartItems.length,0);
 await f.api.saveCustomerCartMutation('bob','add-a',add);
 assert.equal(f.records.get('customerProfiles/bob').cartItems.length,1);
});
