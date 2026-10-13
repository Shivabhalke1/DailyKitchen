/**
 * Formats weight in grams to user-friendly Indian grocery units.
 * Example: 250 -> "250g", 500 -> "500g", 1000 -> "1kg", 1500 -> "1.5kg"
 */
export function formatWeight(grams: number): string {
  if (!grams || grams <= 0) {
    return '0g';
  }

  if (grams >= 1000) {
    const kg = grams / 1000;
    return Number.isInteger(kg) ? `${kg}kg` : `${kg.toFixed(1)}kg`;
  }

  return `${Math.round(grams)}g`;
}
