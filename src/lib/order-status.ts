import type { CheckoutOrder } from "@/types/order";
export function paymentLabel(order: Partial<CheckoutOrder>) {
  if(order.refundStatus==="processed")return "Refunded";
  if(order.refundStatus==="partial")return "Partially refunded";
  if(order.refundStatus)return order.refundStatus==="failed"||order.refundStatus==="retry_required"?"Refund needs attention":"Refund in progress";
  if(order.paymentCaptured||order.paymentStatus==="captured"||order.status==="paid")return "Paid";
  if(order.paymentStatus==="authorized")return "Payment authorized — awaiting confirmation";
  if(order.paymentStatus==="failed")return "Payment attempt failed";
  if(order.status==="cancelled")return "Cancelled — unpaid";
  if(order.status==="expired")return "Reservation expired — unpaid";
  return "Payment pending";
}
export function fulfilmentLabel(order: Partial<CheckoutOrder>) {
  if(order.inventoryRestocked)return "Returned and restocked";
  if(order.refundStatus)return "Fulfilment stopped — refund/return";
  if(order.attentionRequired||order.reservationState==="exception")return "Needs attention";
  if(order.dispatchStatus==="completed")return "Dispatched";
  if(order.paymentCaptured||order.paymentStatus==="captured"||order.status==="paid")return "Awaiting dispatch";
  if(order.reservationState==="held")return "Temporarily reserved";
  return "Not dispatched";
}
