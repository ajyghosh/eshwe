const test=require('node:test');const assert=require('node:assert/strict');const {loadSource}=require('./helpers/source.cjs');
test('empty cache snapshot does not masquerade as an empty catalogue or missing product',()=>{let next;const firestore={collection:()=>({}),query:()=>({}),where:()=>({}),orderBy:()=>({}),onSnapshot:(q,options,callback)=>{next=callback;return()=>{};}};const api=loadSource('src/lib/sarees.ts',{'firebase/firestore':firestore,'@/lib/firebase':{db:{}},'@/lib/api':{postJson:()=>{}},'@/lib/product-discovery':{normalizeOccasionTags:()=>[]}});const updates=[];api.subscribeToSarees(items=>updates.push(items),{status:['active']});next({metadata:{fromCache:true},empty:true,docs:[]});assert.equal(updates.length,0);next({metadata:{fromCache:false},empty:true,docs:[]});assert.equal(updates.length,1);});

test('category search URLs round-trip the category independently of the search text',()=>{
 const routes=loadSource('src/lib/storefront-routes.ts',{'@/lib/sarees':{slugifySareeName:value=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-')}});
 const path=routes.buildShopVisiblePath({browse:'curated',filter:'Mul Cotton',q:'Golden Checkered'});
 assert.equal(path,'/shop/category/mul-cotton/search/golden-checkered/');
 assert.equal(routes.resolveShopLocation(path).filter,'mul-cotton');
 assert.equal(routes.resolveShopSearchQuery(path),'golden checkered');
 assert.equal(routes.resolveShopLocation('/shop/category/search/').filter,'search');
 assert.equal(routes.resolveShopLocation('/shop/category/search/search/silk/').filter,'search');
 assert.equal(routes.resolveShopLocation('/shop/','curated','Mul Cotton').filter,'Mul Cotton');
});
