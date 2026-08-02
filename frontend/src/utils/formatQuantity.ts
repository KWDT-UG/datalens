export function formatQuantity(
  quantity?: string | number | null,
  unit?: string | null,
  fallback = 'Not recorded'
) {
  if (quantity === undefined || quantity === null || quantity === '') {
    return fallback;
  }

  const numericQuantity = Number(quantity);
  const displayQuantity = Number.isFinite(numericQuantity)
    ? numericQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(quantity);

  return [displayQuantity, unit?.trim()].filter(Boolean).join(' ');
}
