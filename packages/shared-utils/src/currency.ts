/**
 * Formats a number to Indian Rupee (INR) representation.
 * Example: 249 -> "₹249", 249.5 -> "₹249.50"
 */
export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }

  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const isWhole = Number.isInteger(rounded);

  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);

  return `₹${formattedNumber}`;
}
