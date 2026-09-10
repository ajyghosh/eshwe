import { normalizeAvailableStock } from "@/lib/inventory";
import type { CheckoutOrder } from "@/types/order";
import type { Saree } from "@/types/saree";

export function buildOwnerOverviewMetrics(orders: CheckoutOrder[], products: Saree[], now = new Date()) {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const previousMonthEnd = currentMonthStart;
  const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const totalUnitsSold = orders.reduce((sum, order) => sum + getOrderUnits(order), 0);
  const currentMonthRevenue = sumOrdersByRange(orders, currentMonthStart, nextMonthStart);
  const previousMonthRevenue = sumOrdersByRange(orders, previousMonthStart, previousMonthEnd);
  const currentMonthOrders = countOrdersByRange(orders, currentMonthStart, nextMonthStart);
  const previousMonthOrders = countOrdersByRange(orders, previousMonthStart, previousMonthEnd);
  const pendingDispatch = orders.filter((order) => order.dispatchStatus !== "completed").length;
  const activeProducts = products.filter((product) => product.status === "active").length;
  const featuredProducts = products.filter((product) => product.featured).length;
  const outOfStockProducts = products.filter((product) => product.status === "out_of_stock").length;
  const lowStockProducts = products.filter(
    (product) => product.status === "active" && normalizeAvailableStock(product.availableStock) <= 2
  ).length;
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
  const revenueSeries = buildMonthlyRevenueSeries(orders, now);
  const revenueTrendDifference = currentMonthRevenue - previousMonthRevenue;
  const revenueTrendPercent =
    previousMonthRevenue > 0 ? (revenueTrendDifference / previousMonthRevenue) * 100 : currentMonthRevenue > 0 ? 100 : 0;
  const orderTrendDifference = currentMonthOrders - previousMonthOrders;

  return {
    activeProducts,
    averageOrderValue,
    currentMonthOrders,
    currentMonthRevenue,
    featuredProducts,
    lowStockProducts,
    outOfStockProducts,
    pendingDispatch,
    previousMonthOrders,
    previousMonthRevenue,
    revenueSeries,
    revenueTrendLabel:
      previousMonthRevenue > 0
        ? `${formatSignedPercent(revenueTrendPercent)} vs last month. ${formatSignedCurrency(
            revenueTrendDifference
          )} change in revenue and ${formatSignedNumber(orderTrendDifference)} order movement.`
        : currentMonthRevenue > 0
          ? "First recorded monthly revenue is visible here. The next month will show a direct comparison."
          : "No revenue recorded yet. As orders start landing, this area will show the monthly trend.",
    revenueTrendTone:
      revenueTrendDifference > 0
        ? "bg-[#dfe9d6] text-[#4d6a41]"
        : revenueTrendDifference < 0
          ? "bg-[#f3ddd6] text-[#8a4d43]"
          : "bg-[#ece7dd] text-[#6b665f]",
    revenueTrendValue:
      previousMonthRevenue > 0 ? formatSignedPercent(revenueTrendPercent) : currentMonthRevenue > 0 ? "NEW" : "FLAT",
    totalOrders: orders.length,
    totalRevenue,
    totalUnitsSold
  };
}

function buildMonthlyRevenueSeries(orders: CheckoutOrder[], now: Date) {
  const formatter = new Intl.DateTimeFormat("en-IN", { month: "short" });
  const buckets = Array.from({ length: 6 }).map((_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      label: formatter.format(monthDate),
      start: monthDate.getTime(),
      total: 0
    };
  });

  orders.forEach((order) => {
    const timestamp = getTimestampValue(order.createdAt);

    if (timestamp <= 0) {
      return;
    }

    const match = buckets.find((bucket, index) => {
      const nextStart = buckets[index + 1]?.start ?? new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return timestamp >= bucket.start && timestamp < nextStart;
    });

    if (!match) {
      return;
    }

    match.total += getOrderTotal(order);
  });

  const maxTotal = Math.max(...buckets.map((bucket) => bucket.total), 0);

  return buckets.map((bucket) => ({
    ...bucket,
    heightPercent: maxTotal > 0 ? (bucket.total / maxTotal) * 100 : 0
  }));
}

function sumOrdersByRange(orders: CheckoutOrder[], start: number, end: number) {
  return orders.reduce((sum, order) => {
    const timestamp = getTimestampValue(order.createdAt);
    return timestamp >= start && timestamp < end ? sum + getOrderTotal(order) : sum;
  }, 0);
}

function countOrdersByRange(orders: CheckoutOrder[], start: number, end: number) {
  return orders.reduce((count, order) => {
    const timestamp = getTimestampValue(order.createdAt);
    return timestamp >= start && timestamp < end ? count + 1 : count;
  }, 0);
}

export function getOrderTotal(order: CheckoutOrder) {
  if (typeof order.amountBreakdown?.total === "number") {
    return order.amountBreakdown.total;
  }

  if (typeof order.amountPaise === "number") {
    return order.amountPaise / 100;
  }

  return (order.cartItems ?? []).reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
}

function getOrderUnits(order: CheckoutOrder) {
  return (order.cartItems ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

export function getTimestampValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  return 0;
}

export function shortOrderId(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

export function formatTimestamp(value: unknown) {
  const timestamp = getTimestampValue(value);

  if (!timestamp) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(timestamp));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}%`;
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}
