const test=require('node:test'),assert=require('node:assert/strict');
const {loadSource}=require('./helpers/source.cjs');
const {normalizeAffordableBanner}=loadSource('src/types/affordable-banner.ts');
test('existing homepages retain the original banner and partial settings remain usable',()=>{
 const defaults=normalizeAffordableBanner();assert.equal(defaults.enabled,true);assert.equal(defaults.heading,'Affordable Elegance');assert.equal(defaults.imageUrl,'/hero.webp');
 const custom=normalizeAffordableBanner({enabled:false,heading:'  Everyday sarees  ',eyebrow:'',body:'',buttonLabel:'   '});
 assert.equal(custom.enabled,false);assert.equal(custom.heading,'Everyday sarees');assert.equal(custom.eyebrow,'');assert.equal(custom.body,'');assert.equal(custom.buttonLabel,'Shop now');assert.equal(custom.imageUrl,defaults.imageUrl);
});
test('saving banner changes merges only its own fields without overwriting other homepage content',async()=>{
 const saved=[];const db={};const api=loadSource('src/lib/homepage.ts',{'@/lib/firebase':{db},'firebase/firestore':{doc:(_db,...parts)=>parts.join('/'),serverTimestamp:()=>123,setDoc:async(...args)=>saved.push(args)}});
 const banner=normalizeAffordableBanner({heading:'Everyday sarees',enabled:false});await api.saveAffordableBanner(banner);
 assert.equal(saved[0][0],'siteContent/homepage');assert.equal(saved[0][1].affordableBanner.heading,'Everyday sarees');assert.equal(saved[0][1].affordableBanner.enabled,false);assert.equal(saved[0][2].merge,true);assert.deepEqual(Object.keys(saved[0][1]).sort(),['affordableBanner','updatedAt']);
});
