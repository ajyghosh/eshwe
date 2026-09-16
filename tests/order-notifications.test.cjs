const test=require('node:test');const assert=require('node:assert/strict');
const {createCommerce}=require('../functions/commerce');
const {buildOrderEmail,createOrderNotificationWorker}=require('../functions/order-notifications');
const {memoryFirestore}=require('./helpers/firestore.cjs');
const {loadBackend,request}=require('./helpers/backend.cjs');
const customer={fullName:'Test Customer',email:'customer@example.test',phone:'+919999999991',address:'12 Test Street',city:'Kochi',state:'Kerala',pincode:'682001'};
const paid={id:'A',userId:'alice',customer,cartItems:[{productId:'P',sku:'P',name:'Soft Silk',color:'Green',quantity:2,unitPrice:100}],amountPaise:23000,currency:'INR',amountBreakdown:{subtotal:200,shippingFee:20,packagingFee:10,total:230,savings:40},receipt:'receipt-A',razorpayOrderId:'gateway-A',razorpayPaymentId:'pay-A',paymentMethod:'upi',paymentCaptured:true,inventoryCommitted:true,dispatchStatus:'new',notes:'Leave with reception'};
function fixture(order=paid){const f=memoryFirestore({'checkoutOrders/A':order,'sarees/P':{sku:'P',status:'active',availableStock:0,reservedStock:2,price:100}});return{...f,service:createCommerce({db:f.db,timestamp:()=>1000,gateway:{},now:()=>1000})};}
function worker(f,options={}){return createOrderNotificationWorker({db:f.db,timestamp:()=>2000,smsConfigured:()=>false,sendEmail:async()=>{throw Error('Unexpected email')},sendSms:async()=>{throw Error('Unexpected SMS')},...options});}
const job=(f,kind)=>f.records.get(`checkoutOrders/A/notifications/${kind}`);

test('capture queues one confirmation from immutable order details, never on authorization or webhook replay',async()=>{
 const f=fixture({...paid,paymentCaptured:false,inventoryCommitted:false,reservationState:'held',paymentStatus:'pending'});
 const payment={id:'pay-A',order_id:'gateway-A',amount:23000,currency:'INR',status:'authorized'};
 await f.service.recordPayment('A',payment);assert.equal(job(f,'confirmation'),undefined);
 await Promise.all([f.service.recordPayment('A',{...payment,status:'captured'}),f.service.recordPayment('A',{...payment,status:'captured'})]);
 assert.equal(job(f,'confirmation').channel,'email');assert.deepEqual(job(f,'confirmation').order.customer,customer);
 await f.service.recordPayment('A',{...payment,status:'captured'});assert.equal([...f.records.keys()].filter(k=>k.endsWith('/notifications/confirmation')).length,1);
});
test('no confirmation email for missing email, failed payment, or inventory exception',async()=>{
 const f=fixture({...paid,customer:{...customer,email:''},paymentCaptured:false,inventoryCommitted:false,reservationState:'held'});
 await f.service.recordPayment('A',{id:'pay-A',order_id:'gateway-A',amount:23000,currency:'INR',status:'captured'});
 assert.equal(job(f,'confirmation'),undefined);assert.equal(f.records.get('checkoutOrders/A').notifications.confirmation.status,'skipped');
 const unavailable=fixture({...paid,paymentCaptured:false,inventoryCommitted:false,reservationState:'released'});
 await unavailable.service.recordPayment('A',{id:'pay-A',order_id:'gateway-A',amount:23000,currency:'INR',status:'captured'});assert.equal(job(unavailable,'confirmation'),undefined);
});
test('dispatch requires a valid AWB, stores it atomically and handles double clicks without duplicate jobs',async()=>{
 const f=fixture();for(const awbNumber of [undefined,'','a','<script>','A\nB'])await assert.rejects(f.service.fulfilment('A','completed','owner',{awbNumber}),e=>e.status===400);
 assert.equal(f.records.get('checkoutOrders/A').dispatchStatus,'new');
 await Promise.all([f.service.fulfilment('A','completed','owner',{awbNumber:' AWB-12345 '}),f.service.fulfilment('A','completed','owner',{awbNumber:'AWB-12345'})]);
 assert.equal(f.records.get('checkoutOrders/A').awbNumber,'AWB-12345');assert.equal(job(f,'dispatch').order.awbNumber,'AWB-12345');assert.equal(job(f,'dispatch').channel,'email');
 await assert.rejects(f.service.fulfilment('A','completed','owner',{awbNumber:'OTHER-123'}),e=>e.status===409);
 await assert.rejects(f.service.fulfilment('A','new','owner'),e=>e.status===409);
});
test('unpaid, uncommitted, refund and attention orders cannot queue a dispatch notice',async()=>{
 for(const change of [{paymentCaptured:false},{inventoryCommitted:false},{refundStatus:'processed'},{attentionRequired:true}]){const f=fixture({...paid,...change});await assert.rejects(f.service.fulfilment('A','completed','owner',{awbNumber:'AWB-123'}));assert.equal(job(f,'dispatch'),undefined);}
});
test('worker sends email once across concurrent trigger deliveries and preserves other notification states',async()=>{
 const f=fixture({...paid,notifications:{confirmation:{channel:'email',status:'sent'}}});await f.service.fulfilment('A','completed','owner',{awbNumber:'AWB-123'});let sent=0;
 const deliver=worker(f,{sendEmail:async(to,email)=>{sent++;assert.equal(to,customer.email);assert.ok(email.text.includes('AWB-123'));}});
 await Promise.all([deliver('A','dispatch'),deliver('A','dispatch')]);await deliver('A','dispatch');assert.equal(sent,1);assert.equal(job(f,'dispatch').status,'sent');assert.equal(f.records.get('checkoutOrders/A').notifications.confirmation.status,'sent');
});
test('SMS stays pending until configured, then includes AWB and is delivered only once',async()=>{
 const f=fixture({...paid,customer:{...customer,email:''}});await f.service.fulfilment('A','completed','owner',{awbNumber:'SMS-123'});assert.equal(job(f,'dispatch').channel,'sms');
 await worker(f)('A','dispatch');assert.equal(job(f,'dispatch').status,'awaiting_configuration');let sent=0;
 const deliver=worker(f,{smsConfigured:()=>true,sendSms:async order=>{sent++;assert.equal(order.awbNumber,'SMS-123');assert.equal(order.customer.phone,customer.phone);}});await deliver('A','dispatch');await deliver('A','dispatch');assert.equal(sent,1);assert.equal(job(f,'dispatch').status,'sent');
});
test('ambiguous transport failures remain visible and do not automatically resend',async()=>{
 const f=fixture();await f.service.fulfilment('A','completed','owner',{awbNumber:'AWB-123'});let calls=0;const deliver=worker(f,{sendEmail:async()=>{calls++;throw Error('Timeout after acceptance');}});await deliver('A','dispatch');await deliver('A','dispatch');assert.equal(calls,1);assert.equal(job(f,'dispatch').status,'failed');assert.equal(f.records.get('checkoutOrders/A').dispatchStatus,'completed');
});
test('branded emails contain receipt details and safely escape customer input',()=>{
 const order={...paid,createdAt:new Date('2026-09-16T04:30:00Z'),awbNumber:'AWB-123',customer:{...customer,fullName:'<img src=x onerror=alert(1)>'},notes:'<script>bad()</script>'};
 for(const kind of ['confirmation','dispatch']){const result=buildOrderEmail(order,kind);for(const text of ['Soft Silk','SKU P','Green','Qty 2','200.00','230.00','20.00','10.00','40.00','12 Test Street','Kochi','682001','gateway-A','pay-A','receipt-A','upi','IST'])assert.ok(result.text.includes(text),text);assert.ok(!result.html.includes('<script>'));assert.ok(result.html.includes('&lt;script&gt;'));assert.ok(result.html.includes('#f5efe4'));assert.ok(result.html.includes('Reply to this email'));assert.ok(result.html.includes('align="center"'));assert.ok(result.html.includes('src="https://eshwe.com/eshwelogo-transparent.png"'));assert.ok(result.html.includes('alt="eshwe Saree Studio"'));assert.match(result.html, /<a href="https:\/\/eshwe\.com"[^>]*>eshwe\.com<\/a>/);assert.ok(result.text.includes('Visit our website: https://eshwe.com'));}
 assert.ok(buildOrderEmail(order,'dispatch').text.includes('AWB-123'));assert.ok(buildOrderEmail(order,'dispatch').text.includes('select Track, and enter the AWB number below'));assert.ok(buildOrderEmail(order,'dispatch').html.includes('<strong>Track</strong>'));assert.ok(!buildOrderEmail(order,'confirmation').text.includes('select Track'));assert.ok(!buildOrderEmail(order,'confirmation').text.includes('AWB-123'));
});
test('owner HTTP action passes AWB to dispatch and rejects nonowners',async()=>{
 const f=fixture();const api=loadBackend(f.db,{users:{owner:{uid:'owner',email:'ajyghosh@gmail.com',email_verified:true},customer:{uid:'alice'}}});const payload={orderId:'A',action:'completed',awbNumber:'HTTP-123'};
 assert.equal((await request(api.ownerOrderAction,payload,'customer')).status,403);assert.equal((await request(api.ownerOrderAction,payload,'owner')).status,200);assert.equal(job(f,'dispatch').order.awbNumber,'HTTP-123');
});
test('delivery address accepts omitted email and validates provided email',()=>{
 const normalize=loadBackend(memoryFirestore().db).testOnly.normalizeCustomer;
 for(const email of ['',undefined,null,'   '])assert.equal(normalize({...customer,email}).email,'');
 assert.equal(normalize({...customer,email:' TEST@example.test '}).email,'test@example.test');
 for(const email of ['bad','one@example.test\nbcc:other@example.test',true])assert.throws(()=>normalize({...customer,email}));
});
test('email trigger uses the support SMTP account, branded sender and reply address',async()=>{
 const f=fixture();await f.db.collection('_functionMigration').doc('regions').set({cutoverAt:0});await f.service.fulfilment('A','completed','owner',{awbNumber:'MAIL-123'});let sent;
 const api=loadBackend(f.db,{mocks:{nodemailer:{createTransport:config=>{assert.equal(config.auth.user,'hello@nohello.in');assert.equal(config.host,'mail.nohello.in');return{sendMail:async mail=>{sent=mail;return{accepted:[mail.to]}},close(){}};}}}});
 await api.sendOrderNotificationUs({time:new Date().toISOString(),params:{orderId:'A',kind:'dispatch'}});assert.equal(sent.to,customer.email);assert.equal(sent.replyTo,'hello@nohello.in');assert.equal(sent.from,'eshwe studio <hello@nohello.in>');assert.ok(sent.html.includes('MAIL-123'));assert.equal(job(f,'dispatch').status,'sent');
});
test('configured shipping flow maps the saved AWB to alphanumeric using the OTP account credentials',async()=>{
 const {MSG91_DISPATCH_TEMPLATE_ID}=require('node:util').parseEnv(require('node:fs').readFileSync(require('node:path').join(__dirname,'../functions/.env.eshwesareestudio'),'utf8'));
 assert.equal(MSG91_DISPATCH_TEMPLATE_ID,'6aaa5c46a95e1f0cf5056822');
 const f=fixture({...paid,customer:{...customer,email:''}});await f.db.collection('_functionMigration').doc('regions').set({cutoverAt:0});await f.service.fulfilment('A','completed','owner',{awbNumber:'SMS-999'});let body;
 const api=loadBackend(f.db,{env:{MSG91_DISPATCH_TEMPLATE_ID,MSG91_OTP_TEMPLATE_ID:'otp-only'},fetch:async(url,options)=>{assert.equal(url,'https://control.msg91.com/api/v5/flow');assert.equal(options.headers.authkey,'test-MSG91_AUTH_KEY');body=JSON.parse(options.body);return{ok:true,json:async()=>({type:'success'})};}});
 await api.sendOrderNotificationUs({time:new Date().toISOString(),params:{orderId:'A',kind:'dispatch'}});assert.equal(body.flow_id,MSG91_DISPATCH_TEMPLATE_ID);assert.deepEqual(body.recipients,[{mobiles:'919999999991',alphanumeric:'SMS-999'}]);assert.equal(job(f,'dispatch').status,'sent');
});

test('dispatch SMS never falls back to the OTP template while approval is pending',async()=>{
 const f=fixture({...paid,customer:{...customer,email:''}});
 await f.db.collection('_functionMigration').doc('regions').set({cutoverAt:0});
 await f.service.fulfilment('A','completed','owner',{awbNumber:'AWB-PENDING-123'});
 let calls=0;
 const api=loadBackend(f.db,{env:{MSG91_OTP_TEMPLATE_ID:'otp-only'},fetch:async()=>{calls++;throw Error('No provider request allowed');}});
 await api.sendOrderNotificationUs({time:new Date().toISOString(),params:{orderId:'A',kind:'dispatch'}});
 assert.equal(calls,0);assert.equal(job(f,'dispatch').status,'awaiting_configuration');
 assert.equal(job(f,'dispatch').order.awbNumber,'AWB-PENDING-123');
 assert.equal(f.records.get('checkoutOrders/A').dispatchStatus,'completed');
});
