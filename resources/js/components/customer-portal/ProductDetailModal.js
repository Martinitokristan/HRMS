import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';

export default function ProductDetailModal({ isOpen, onClose, product, onAddToCart }) {
    const [qty, setQty] = useState(1);
    const [selectedColor, setSelectedColor] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);

    useEffect(() => {
        if (isOpen && product) {
            setQty(product.qty || 1);
            setSelectedColor(product.selectedVariants?.Color || null);
            setSelectedSize(product.selectedVariants?.Size || null);
        }
    }, [isOpen, product]);

    if (!product) return null;

    const allVariants = product.product_variants || [];
    const hasVariants = allVariants.length > 0;

    const colorMap = {};
    const sizeMap = {};
    allVariants.forEach(v => {
        if (v.color_value) colorMap[v.color_value_id] = v.color_value;
        if (v.size_value)  sizeMap[v.size_value_id]  = v.size_value;
    });
    const availableColors = Object.values(colorMap);
    const availableSizes  = Object.values(sizeMap);
    const hasColors = availableColors.length > 0;
    const hasSizes  = availableSizes.length  > 0;

    const totalVariantStock = allVariants.reduce((s, v) => s + (v.stock || 0), 0);

    const findVariant = (sizeId, colorId) =>
        allVariants.find(v =>
            (sizeId  ? v.size_value_id  === sizeId  : !v.size_value_id)  &&
            (colorId ? v.color_value_id === colorId : !v.color_value_id)
        );

    const stockForColor = (colorId) => {
        if (selectedSize) {
            const v = findVariant(selectedSize.id, colorId);
            return v ? v.stock : 0;
        }
        return allVariants
            .filter(v => v.color_value_id === colorId)
            .reduce((s, v) => s + (v.stock || 0), 0);
    };

    const stockForSize = (sizeId) => {
        if (selectedColor) {
            const v = findVariant(sizeId, selectedColor.id);
            return v ? v.stock : 0;
        }
        return allVariants
            .filter(v => v.size_value_id === sizeId)
            .reduce((s, v) => s + (v.stock || 0), 0);
    };

    const activeCombo = hasVariants
        ? findVariant(
            hasSizes  ? selectedSize?.id  : undefined,
            hasColors ? selectedColor?.id : undefined
          )
        : null;

    const currentPrice = activeCombo?.price_override || product.sell_price;

    let currentStock;
    if (!hasVariants) {
        currentStock = product.inventory?.current_stock || 0;
    } else if (activeCombo) {
        currentStock = activeCombo.stock;
    } else if (selectedColor && !hasSizes) {
        currentStock = stockForColor(selectedColor.id);
    } else if (selectedSize && !hasColors) {
        currentStock = stockForSize(selectedSize.id);
    } else {
        currentStock = totalVariantStock;
    }

    const isOutOfStock = currentStock <= 0;
    const isLowStock   = currentStock > 0 && currentStock <= 5;
    const subtotal     = currentPrice * qty;

    const needsSize  = hasSizes  && !selectedSize;
    const needsColor = hasColors && !selectedColor;
    const selectionComplete = !needsSize && !needsColor;
    const canAdd = selectionComplete && !isOutOfStock && (!hasVariants || activeCombo);

    const handleAddToCart = () => {
        if (!canAdd) return;
        onAddToCart(product, {
            qty,
            variants: { Size: selectedSize, Color: selectedColor },
            price: currentPrice,
            variant_id: activeCombo?.id,
            isUpdate: !!product.cartId
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Product Specification" size="lg" hideFooter>
            <div className="pdm-wrap">
                {/* Image Section */}
                <div className="pdm-left">
                    <div className="pdm-img-main">
                        {product.image_path
                            ? <img src={`/storage/${product.image_path}`} alt={product.name} />
                            : <div className="pdm-img-fallback">🛠️</div>}
                    </div>
                </div>

                {/* Details Section */}
                <div className="pdm-right">
                    <div style={{ marginBottom: '2rem' }}>
                        <div className="pdm-category">{product.category?.name || 'Supply'}</div>
                        <h1 className="pdm-name">{product.name}</h1>
                        <div className="pdm-price">₱{Number(currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>

                    <div className="pdm-stock-status">
                        {selectionComplete ? (
                            isOutOfStock ? (
                                <span className="status-badge status-out">Out of Stock</span>
                            ) : (
                                <span className="status-badge status-in">{currentStock} Units in Stock</span>
                            )
                        ) : (
                            <span className="status-badge status-neutral">Select variant for availability</span>
                        )}
                    </div>

                    {product.description && (
                        <div className="pdm-section">
                            <label>Description</label>
                            <p className="pdm-desc">{product.description}</p>
                        </div>
                    )}

                    {/* Variants */}
                    {hasColors && (
                        <div className="pdm-section">
                            <label>Finish / Color</label>
                            <div className="pdm-variant-options">
                                {availableColors.map(color => (
                                    <button
                                        key={color.id}
                                        onClick={() => setSelectedColor(prev => prev?.id === color.id ? null : color)}
                                        className={`opt-btn ${selectedColor?.id === color.id ? 'active' : ''} ${stockForColor(color.id) <= 0 ? 'disabled' : ''}`}
                                    >
                                        {color.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {hasSizes && (
                        <div className="pdm-section">
                            <label>Dimension / Size</label>
                            <div className="pdm-variant-options">
                                {availableSizes.map(size => (
                                    <button
                                        key={size.id}
                                        onClick={() => setSelectedSize(prev => prev?.id === size.id ? null : size)}
                                        className={`opt-btn ${selectedSize?.id === size.id ? 'active' : ''} ${stockForSize(size.id) <= 0 ? 'disabled' : ''}`}
                                    >
                                        {size.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quantity & Add to Cart */}
                    <div className="pdm-footer">
                        <div className="pdm-qty-picker">
                            <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                            <input type="number" readOnly value={qty} />
                            <button onClick={() => setQty(q => Math.min(q + 1, currentStock))}>+</button>
                        </div>
                        <button
                            disabled={!canAdd}
                            onClick={handleAddToCart}
                            className={`pdm-primary-btn ${!canAdd ? 'disabled' : ''}`}
                        >
                            {isOutOfStock ? 'Sold Out' : `Add to Cart • ₱${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .pdm-wrap {
                    display: grid;
                    grid-template-columns: 1.1fr 1fr;
                    gap: 0;
                    background: #fff;
                }
                @media (max-width: 768px) {
                    .pdm-wrap { grid-template-columns: 1fr; }
                }

                .pdm-left {
                    padding: 2rem;
                    background: #fdfdfd;
                    border-right: 1px solid #f1f5f9;
                    display: flex; align-items: center; justify-content: center;
                }
                .pdm-img-main {
                    width: 100%;
                    aspect-ratio: 1;
                    display: flex; align-items: center; justify-content: center;
                }
                .pdm-img-main img {
                    max-width: 100%; max-height: 100%; object-fit: contain;
                }
                .pdm-img-fallback { font-size: 6rem; opacity: 0.2; }

                .pdm-right {
                    padding: 2.5rem;
                    display: flex; flex-direction: column;
                }

                .pdm-category {
                    color: #FF6B35; font-weight: 800; font-size: 0.8rem;
                    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem;
                }
                .pdm-name {
                    font-size: 1.75rem; font-weight: 900; color: #111827;
                    margin-bottom: 0.75rem; line-height: 1.2; letter-spacing: -0.02em;
                }
                .pdm-price {
                    font-size: 2rem; font-weight: 900; color: #111827;
                }

                .pdm-stock-status { margin-bottom: 2rem; }
                .status-badge {
                    padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.85rem;
                }
                .status-in { background: #dcfce7; color: #166534; }
                .status-out { background: #fee2e2; color: #991b1b; }
                .status-neutral { background: #f1f5f9; color: #475569; }

                .pdm-section { margin-bottom: 2rem; }
                .pdm-section label {
                    display: block; font-size: 0.85rem; font-weight: 800;
                    text-transform: uppercase; color: #94a3b8; margin-bottom: 1rem;
                    letter-spacing: 0.05em;
                }
                .pdm-desc { color: #475569; line-height: 1.6; font-size: 0.95rem; }

                .pdm-variant-options { display: flex; flex-wrap: wrap; gap: 10px; }
                .opt-btn {
                    padding: 10px 20px; border-radius: 12px; border: 2px solid #e2e8f0;
                    background: #fff; font-weight: 700; color: #475569; cursor: pointer;
                    transition: all 0.2s;
                }
                .opt-btn:hover:not(.disabled) { border-color: #cbd5e1; color: #111827; }
                .opt-btn.active { border-color: #111827; background: #111827; color: #fff; }
                .opt-btn.disabled { opacity: 0.3; cursor: not-allowed; }

                .pdm-footer {
                    margin-top: auto; display: flex; gap: 1.5rem; padding-top: 2.5rem;
                    border-top: 1px solid #f1f5f9;
                }
                .pdm-qty-picker {
                    display: flex; align-items: center; background: #f8fafc;
                    border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden;
                }
                .pdm-qty-picker button {
                    width: 42px; height: 46px; border: none; background: transparent;
                    font-size: 1.25rem; color: #111827; cursor: pointer; transition: background 0.2s;
                }
                .pdm-qty-picker button:hover { background: #e2e8f0; }
                .pdm-qty-picker input {
                    width: 44px; text-align: center; border: none; background: transparent;
                    font-weight: 800; font-size: 1.1rem; color: #111827;
                }

                .pdm-primary-btn {
                    flex: 1; height: 46px; border: none; border-radius: 14px;
                    background: #111827; color: #fff; font-weight: 800; font-size: 1rem;
                    cursor: pointer; transition: all 0.3s;
                }
                .pdm-primary-btn:hover:not(.disabled) {
                    background: #FF6B35; transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(255, 107, 53, 0.3);
                }
                .pdm-primary-btn.disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
            `}</style>
        </Modal>
    );
}
