// Build a human-friendly label for a sale/order line item.
// e.g. "1x Claw Hammer (8 oz)" or "1x Claw Hammer".
//
// `item` is expected to have:
//   - quantity
//   - product?.name
//   - product_variant?.size_value?.label
//   - product_variant?.color_value?.label
//   - product_variant?.weight_value?.label
//   - or legacy: variants?.size / .color / .weight
export function orderItemLabel(item) {
    if (!item) return '';
    const qty = Number(item.quantity || 0) || 0;
    const name = item.product?.name || 'Item';
    const v = item.product_variant || item.variants || null;
    const variantParts = v
        ? [
              v.size_value?.label ?? v.size ?? null,
              v.color_value?.label ?? v.color ?? null,
              v.weight_value?.label ?? v.weight ?? null,
          ].filter(Boolean)
        : [];
    const variantSuffix = variantParts.length ? ` (${variantParts.join(' / ')})` : '';
    return `${qty}x ${name}${variantSuffix}`;
}
