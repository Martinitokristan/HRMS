/**
 * Price calculation utilities for product sales
 * Follows development rules: no hardcoded values, proper error handling, semantic functions
 */

/**
 * Calculate sale price based on original price and sale percentage
 * @param {number} originalPrice - Original price of the product
 * @param {number} salePercentage - Sale percentage (0-100)
 * @returns {number} Calculated sale price
 */
export const calculateSalePrice = (originalPrice, salePercentage) => {
    if (!originalPrice || originalPrice <= 0) return originalPrice;
    if (!salePercentage || salePercentage <= 0 || salePercentage > 100) return originalPrice;
    
    const discount = (originalPrice * salePercentage) / 100;
    return Number((originalPrice - discount).toFixed(2));
};

/**
 * Calculate savings amount
 * @param {number} originalPrice - Original price
 * @param {number} salePrice - Sale price
 * @returns {number} Amount saved
 */
export const calculateSavings = (originalPrice, salePrice) => {
    if (!originalPrice || !salePrice || salePrice >= originalPrice) return 0;
    return Number((originalPrice - salePrice).toFixed(2));
};

/**
 * Check if a product has an active sale
 * @param {object} product - Product object
 * @returns {boolean} True if product is on sale
 */
export const isProductOnSale = (product) => {
    if (!product) return false;
    
    // Check base product sale
    if (product.sale_percentage && product.sale_percentage > 0) {
        return true;
    }
    
    // Check variant sale
    if (product.product_variants && product.product_variants.length > 0) {
        return product.product_variants.some(variant => 
            variant.sale_percentage && variant.sale_percentage > 0
        );
    }
    
    return false;
};

/**
 * Get the best sale price for a product (considering both base and variants)
 * @param {object} product - Product object
 * @returns {object} Sale information { isOnSale, originalPrice, salePrice, savings, salePercentage }
 */
export const getProductSaleInfo = (product) => {
    if (!product) {
        return {
            isOnSale: false,
            originalPrice: 0,
            salePrice: 0,
            savings: 0,
            salePercentage: 0
        };
    }
    
    const originalPrice = Number(product.sell_price || 0);
    
    // Convert sale_percentage to number for proper comparison
    const salePercentage = parseFloat(product.sale_percentage) || 0;
    
    // Check base product sale first
    if (salePercentage > 0) {
        const salePrice = calculateSalePrice(originalPrice, salePercentage);
        const savings = calculateSavings(originalPrice, salePrice);
        
        return {
            isOnSale: true,
            originalPrice,
            salePrice,
            savings,
            salePercentage
        };
    }
    
    // Check variant sales
    if (product.product_variants && product.product_variants.length > 0) {
        const variantOnSale = product.product_variants.find(variant => {
            const variantSalePercentage = parseFloat(variant.sale_percentage) || 0;
            return variantSalePercentage > 0;
        });
        
        if (variantOnSale) {
            const variantSalePercentage = parseFloat(variantOnSale.sale_percentage) || 0;
            const variantPrice = Number(variantOnSale.price_override || originalPrice);
            const salePrice = calculateSalePrice(variantPrice, variantSalePercentage);
            const savings = calculateSavings(variantPrice, salePrice);
            
            return {
                isOnSale: true,
                originalPrice: variantPrice,
                salePrice,
                savings,
                salePercentage: variantSalePercentage
            };
        }
    }
    
    return {
        isOnSale: false,
        originalPrice,
        salePrice: originalPrice,
        savings: 0,
        salePercentage: 0
    };
};

/**
 * Get sale information for a specific variant
 * @param {object} variant - Variant object
 * @param {number} basePrice - Base product price as fallback
 * @returns {object} Sale information
 */
export const getVariantSaleInfo = (variant, basePrice) => {
    if (!variant) {
        return {
            isOnSale: false,
            originalPrice: basePrice || 0,
            salePrice: basePrice || 0,
            savings: 0,
            salePercentage: 0
        };
    }
    
    const originalPrice = Number(variant.price_override || basePrice || 0);
    const salePercentage = parseFloat(variant.sale_percentage) || 0;
    
    if (salePercentage > 0) {
        const salePrice = calculateSalePrice(originalPrice, salePercentage);
        const savings = calculateSavings(originalPrice, salePrice);
        
        return {
            isOnSale: true,
            originalPrice,
            salePrice,
            savings,
            salePercentage
        };
    }
    
    return {
        isOnSale: false,
        originalPrice,
        salePrice: originalPrice,
        savings: 0,
        salePercentage: 0
    };
};
