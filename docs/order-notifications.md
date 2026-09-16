# Order and dispatch notifications

Order confirmation is queued only when payment capture and stock commitment succeed. Payment authorization, failed payments, and paid inventory exceptions do not send a success email. Customers without email do not receive an order confirmation message. Email is now optional in web/PWA delivery forms and checkout validation; provided email must be valid.

Mark completed now requires a 3–60 character AWB (letters, digits, hyphens). The API saves AWB, dispatch status and a notification job atomically. It rejects unpaid, uncommitted, refund and attention-required orders. Repeating the same completion request is idempotent; changing the AWB of an already dispatched order or reopening it is rejected. AWB is shown in the owner row and printed slip. Completed means dispatched, not delivered.

Confirmation and dispatch emails use cream/olive eshwe branding, HTML plus plain text, the saved order/customer snapshot, item names/SKUs/colours/quantities/unit prices/line totals, subtotal, shipping, packaging, savings if available, total paid, address/contact, order/payment references, payment method, date and note. Both emails include a centered eshwe logo and a visible eshwe.com footer link. Dispatch also includes AWB and instructions to visit eshwe.com, select Track, and enter that AWB. No attachment or courier-specific tracking URL is assumed.

Email transport reuses the support SMTP settings and CONTACT_SMTP_PASSWORD: sender display name eshwe studio for both order and support emails; sender/reply address hello@nohello.in. Production credentials were not read or changed. Test sends were mocked and previews saved locally.

## SMS configuration

The shipping MSG91 Template/Flow ID supplied by the owner is `6aaa5c46a95e1f0cf5056822`. It is configured as `MSG91_DISPATCH_TEMPLATE_ID` in `functions/.env.eshwesareestudio`, the project-specific Firebase Functions environment file. This file contains non-secret configuration only; the existing `MSG91_AUTH_KEY` secret remains unchanged. The previous reference `1077098020055206214` is retained here for the associated DLT template reference, not passed as `flow_id`.

The flow's message is:

> Your order is shipped! Track it using {#alphanumeric#} at eshwe.com under Track Order. - athmasakhi

Its single recipient variable is `alphanumeric`, populated from the AWB saved by the owner's Mark completed action (`order.awbNumber`). No order-ID or OTP variable is sent. The static wording and signature belong to the MSG91 flow. Phone numbers use the existing India/MSISDN normalization. The owner-authorized test SMS was accepted by MSG91 with AWB TESTAWB123. Provider acceptance does not prove handset delivery. The configured notification worker and owner website were deployed on 2026-09-16.

New completed orders without email now use the configured shipping flow. Environments without `MSG91_DISPATCH_TEMPLATE_ID` continue to show pending SMS template configuration. Existing pending jobs are not automatically replayed: review them before explicitly invoking the notification worker, to avoid unexpectedly texting customers about old dispatches. The worker supports processing awaiting_configuration jobs once configuration is present.

## Reliability and access

Jobs live at checkoutOrders/{orderId}/notifications/{confirmation|dispatch}. The new sendOrderNotificationUs creation trigger uses the existing regional cutover guard and bound SMTP/MSG91 secrets. Client access to the job documents remains denied by existing Firestore rules. Customers and owners cannot forge or reset jobs via Firestore. Only summary status is saved on the order.

A transaction claims pending jobs before sending. Duplicate events and repeated completion/capture requests do not send twice. Sent means accepted by the email/SMS provider, not proven inbox/handset delivery. Transport failures are marked delivery unconfirmed and do not revert dispatch. Automatic re-sending after an ambiguous provider response could duplicate a customer notification, so failed/sending jobs require manual review; there is no automatic retry after a send attempt. A worker crash after claiming or provider acceptance can leave sending status, also requiring review. Trigger retries still handle failures before claiming. SMTP uses a stable message ID, but SMTP does not guarantee exactly-once delivery.

Deployed on 2026-09-16: all 12 US functions and Hosting release `7ae20eed84159fc0`. Future changes to notification/capture logic must include the affected backend functions and owner UI; a hosting-only deployment is insufficient. Owners with an older page open should refresh to load the required AWB dialog. See deployments/2026-09-16-order-notifications/ for deployment and verification evidence.
