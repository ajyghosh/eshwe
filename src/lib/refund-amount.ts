export function parseRefundAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [rupees, paise = ""] = trimmed.split(".");
  const amount = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
