import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';

/**
 * Modern Variant Selector Component
 * Displays product variants with:
 * - Color swatches (circular color buttons)
 * - Size buttons (pill-shaped buttons)
 * - Weight dropdown (select box)
 * - Stock availability display
 * - Orange theme for consistency
 */
export default function VariantSelector({ 
    variants = [], 
    onVariantChange, 
    selectedVariant = null,
    showStock = true,
    showPrice = true,
    compact = false
}) {
    const [selected, setSelected] = useState({
        size: '',
        color: '',
        weight: ''
    });

    // Extract unique values from variants
    const uniqueSizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
    const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    const uniqueWeights = [...new Set(variants.map(v => v.weight).filter(Boolean))];

    // Get color hex code from variant values (if available)
    const getColorHex = (colorName) => {
        const variant = variants.find(v => v.color === colorName);
        return variant?.color_hex || getDefaultColorHex(colorName);
    };

    // Default color mapping for common colors
    const getDefaultColorHex = (colorName) => {
        const colorMap = {
            'red': '#EF4444',
            'blue': '#3B82F6',
            'green': '#10B981',
            'yellow': '#F59E0B',
            'black': '#1F2937',
            'white': '#F9FAFB',
            'gray': '#6B7280',
            'grey': '#6B7280',
            'orange': '#F97316',
            'purple': '#A855F7',
            'pink': '#EC4899',
            'brown': '#92400E',
        };
        
        const lowerName = colorName?.toLowerCase() || '';
        for (const [key, value] of Object.entries(colorMap)) {
            if (lowerName.includes(key)) return value;
        }
        return '#9CA3AF'; // Default gray
    };

    // Find matching variant based on current selection
    const getCurrentVariant = () => {
        return variants.find(v => 
            (!selected.size || v.size === selected.size) &&
            (!selected.color || v.color === selected.color) &&
            (!selected.weight || v.weight === selected.weight)
        );
    };

    // Update parent when selection changes
    useEffect(() => {
        const currentVariant = getCurrentVariant();
        if (onVariantChange) {
            onVariantChange(currentVariant, selected);
        }
    }, [selected]);

    // Initialize with first variant if available
    useEffect(() => {
        if (selectedVariant) {
            setSelected({
                size: selectedVariant.size || '',
                color: selectedVariant.color || '',
                weight: selectedVariant.weight || ''
            });
        } else if (variants.length > 0 && !selected.size && !selected.color && !selected.weight) {
            const firstVariant = variants[0];
            setSelected({
                size: firstVariant.size || '',
                color: firstVariant.color || '',
                weight: firstVariant.weight || ''
            });
        }
    }, [selectedVariant, variants]);

    const handleSizeChange = (size) => {
        setSelected(prev => ({ ...prev, size }));
    };

    const handleColorChange = (color) => {
        setSelected(prev => ({ ...prev, color }));
    };

    const handleWeightChange = (weight) => {
        setSelected(prev => ({ ...prev, weight }));
    };

    const currentVariant = getCurrentVariant();
    const hasStock = currentVariant?.stock > 0;
    const stockCount = currentVariant?.stock || 0;

    if (variants.length === 0) {
        return null;
    }

    return (
        <div className={`space-y-${compact ? '3' : '4'}`}>
            {/* Color Selection */}
            {uniqueColors.length > 0 && (
                <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Color</Label>
                    <div className="flex flex-wrap gap-2">
                        {uniqueColors.map(color => {
                            const isSelected = selected.color === color;
                            const hexColor = getColorHex(color);
                            const isLight = hexColor === '#F9FAFB' || hexColor === '#FFFFFF';
                            
                            return (
                                <button
                                    key={color}
                                    onClick={() => handleColorChange(color)}
                                    className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                                        isSelected 
                                            ? 'border-orange-500 ring-2 ring-orange-200' 
                                            : isLight 
                                                ? 'border-gray-300 hover:border-orange-300' 
                                                : 'border-transparent hover:border-orange-300'
                                    }`}
                                    style={{ backgroundColor: hexColor }}
                                    title={color}
                                >
                                    {isSelected && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Check className={`h-4 w-4 ${isLight ? 'text-gray-800' : 'text-white'}`} strokeWidth={3} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Size Selection */}
            {uniqueSizes.length > 0 && (
                <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Size</Label>
                    <div className="flex flex-wrap gap-2">
                        {uniqueSizes.map(size => {
                            const isSelected = selected.size === size;
                            return (
                                <button
                                    key={size}
                                    onClick={() => handleSizeChange(size)}
                                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                                        isSelected 
                                            ? 'border-orange-500 bg-orange-500 text-white' 
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                                    }`}
                                >
                                    {size}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Weight Selection */}
            {uniqueWeights.length > 0 && (
                <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Weight Option</Label>
                    <div className="flex flex-wrap gap-2">
                        {uniqueWeights.map(weight => {
                            const isSelected = selected.weight === weight;
                            return (
                                <button
                                    key={weight}
                                    onClick={() => handleWeightChange(weight)}
                                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                                        isSelected 
                                            ? 'border-orange-500 bg-orange-500 text-white' 
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                                    }`}
                                >
                                    {weight}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Stock & Price Display */}
            {currentVariant && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    {showStock && (
                        <div className="flex items-center gap-2">
                            <Badge variant={hasStock ? "success" : "destructive"} className="text-xs">
                                {hasStock ? `${stockCount} in stock` : 'Out of Stock'}
                            </Badge>
                        </div>
                    )}
                    {showPrice && currentVariant.price_override && (
                        <div className="text-lg font-bold text-orange-600">
                            ₱{parseFloat(currentVariant.price_override).toFixed(2)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
