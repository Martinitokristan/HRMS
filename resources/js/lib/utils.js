import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical PHP currency formatter. Use this everywhere currency is rendered
 * so admin / supplier / customer / rider modules stay visually consistent.
 *
 * Output example: ₱30.00
 *
 * Styling convention:
 *   - Repeating-row table cells:   className="font-mono text-right text-foreground"
 *     (no font-bold — matches Rider Payouts → Paid tab Fee column, the reference)
 *   - Summary / total / footer rows, cards, and product-grid prices:
 *     className="font-mono font-bold text-foreground" is fine.
 */
export const formatPHP = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));