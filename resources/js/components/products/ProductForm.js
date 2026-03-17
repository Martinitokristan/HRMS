import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';

export default function ProductForm({ product, categories, suppliers, unitTypes, variants, onSuccess, onCancel }) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        name: '', sku: '', category_id: '', supplier_id: '', unit_type_id: '',
        purchase_price: '', sell_price: '', description: ''
    });

    const [variantEnabled, setVariantEnabled] = useState(false);
    // Each row: { id, size_value_id, color_value_id, weight_value_id, stock, price_override, sku_suffix, imageFile, imagePreview, existing_image_path }
    const [variantRows, setVariantRows] = useState([]);

    const sizeVariant   = variants?.find(v => v.name.toLowerCase() === 'size');
    const colorVariant  = variants?.find(v => v.name.toLowerCase() === 'color');
    const weightVariant = variants?.find(v => v.id === 3 || v.name.toLowerCase().includes('weight') || v.name.toLowerCase().includes('gram'));

    // ── Reset when product changes ──────────────────────────────────────────
    useEffect(() => {
        setErrors({});

        if (product) {
            setForm({
                name:           product.name           || '',
                sku:            product.sku            || '',
                category_id:    product.category_id    || '',
                supplier_id:    product.supplier_id    || '',
                unit_type_id:   product.unit_type_id   || '',
                purchase_price: product.purchase_price || '',
                sell_price:     product.sell_price     || '',
                description:    product.description    || '',
            });

            const pvs = product.product_variants || [];
            if (pvs.length > 0) {
                setVariantEnabled(true);
                setVariantRows(pvs.map(pv => ({
                    id:                 pv.id || Math.random(),
                    size_value_id:      pv.size_value_id    || '',
                    color_value_id:     pv.color_value_id   || '',
                    weight_value_id:    pv.weight_value_id  || '',
                    stock:              pv.stock             || 0,
                    price_override:     pv.price_override    || '',
                    sku_suffix:         pv.sku_suffix        || '',
                    imageFile:          null,
                    imagePreview:       pv.image_path ? `/storage/${pv.image_path}` : null,
                    existing_image_path: pv.image_path || null,
                })));
            } else {
                setVariantEnabled(false);
                setVariantRows([]);
            }
        } else {
            setForm({ name: '', sku: '', category_id: '', supplier_id: '', unit_type_id: '', purchase_price: '', sell_price: '', description: '' });
            setVariantEnabled(false);
            setVariantRows([]);
        }
    }, [product]);

    // ── Variant helpers ────────────────────────────────────────────────────
    const handleAddRow = () => {
        setVariantRows(prev => [
            ...prev,
            { id: Date.now() + Math.random(), size_value_id: '', color_value_id: '', weight_value_id: '', stock: 0, price_override: '', sku_suffix: '', imageFile: null, imagePreview: null, existing_image_path: null }
        ]);
    };
    const handleRemoveRow = (id) => setVariantRows(prev => prev.filter(r => r.id !== id));
    const handleRowChange = (id, field, value) => setVariantRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const handleRowImage = (id, file) => {
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setVariantRows(prev => prev.map(r => r.id === id ? { ...r, imageFile: file, imagePreview: preview } : r));
    };

    const handleInputChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setErrors({});

        const fd = new FormData();
        Object.keys(form).forEach(k => form[k] !== '' && fd.append(k, form[k]));

        const variantList = variantEnabled
            ? variantRows.map((row, index) => {
                // Attach image file with matching key
                if (row.imageFile) {
                    fd.append(`variant_image_${index}`, row.imageFile);
                }
                return {
                    size_value_id:       row.size_value_id   || null,
                    color_value_id:      row.color_value_id  || null,
                    weight_value_id:     row.weight_value_id || null,
                    stock:               row.stock           || 0,
                    price_override:      row.price_override !== '' && row.price_override !== null && row.price_override !== undefined
                        ? row.price_override : null,
                    sku_suffix:          row.sku_suffix || null,
                    existing_image_path: row.existing_image_path || null,
                };
            })
            : [];
        fd.append('variants', JSON.stringify(variantList));

        try {
            if (product) {
                fd.append('_method', 'PUT');
                await axios.post(`/products/${product.id}`, fd);
                showToast('Product updated');
            } else {
                await axios.post('/products', fd);
                showToast('Product created');
            }
            onSuccess();
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors || {});
                showToast('Please check the highlighted fields.', 'error');
            } else {
                showToast(err.response?.data?.message || 'Error saving product', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pf-page">
            {/* ── Body: two columns ── */}
            <div className="pf-body">

                {/* Left — General Info */}
                <div className="pf-col-info">
                    <p className="pf-section-title">General Information</p>

                    <div className="pf-field">
                        <label>Product Name *</label>
                        <input
                            name="name" required
                            value={form.name}
                            onChange={handleInputChange}
                            placeholder="e.g. Premium Polo Shirt"
                            className={errors.name ? 'pf-has-error' : ''}
                        />
                        {errors.name && <span className="pf-error">{errors.name[0]}</span>}
                    </div>

                    <div className="pf-field">
                        <label>Base SKU *</label>
                        <input
                            name="sku" required
                            value={form.sku}
                            onChange={handleInputChange}
                            placeholder="POLO-001"
                            className={errors.sku ? 'pf-has-error' : ''}
                        />
                        {errors.sku && <span className="pf-error">{errors.sku[0]}</span>}
                    </div>

                    <div className="pf-field">
                        <label>Category *</label>
                        <select
                            name="category_id" required
                            value={form.category_id}
                            onChange={handleInputChange}
                            className={errors.category_id ? 'pf-has-error' : ''}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {errors.category_id && <span className="pf-error">{errors.category_id[0]}</span>}
                    </div>

                    <div className="pf-field">
                        <label>Description</label>
                        <textarea
                            name="description"
                            rows={3}
                            value={form.description}
                            onChange={handleInputChange}
                            placeholder="Optional product notes…"
                        />
                    </div>

                    <p className="pf-section-title" style={{ marginTop: '0.5rem' }}>Inventory &amp; Pricing</p>

                    <div className="pf-grid-2">
                        <div className="pf-field">
                            <label>Supplier</label>
                            <select
                                name="supplier_id"
                                value={form.supplier_id}
                                onChange={handleInputChange}
                                className={errors.supplier_id ? 'pf-has-error' : ''}
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="pf-field">
                            <label>Unit Type *</label>
                            <select
                                name="unit_type_id" required
                                value={form.unit_type_id}
                                onChange={handleInputChange}
                                className={errors.unit_type_id ? 'pf-has-error' : ''}
                            >
                                <option value="">Select Unit Type</option>
                                {unitTypes.map(u => <option key={u.id} value={u.id}>{u.purchase_unit} / {u.sell_unit}</option>)}
                            </select>
                            {errors.unit_type_id && <span className="pf-error">{errors.unit_type_id[0]}</span>}
                        </div>
                    </div>

                    <div className="pf-grid-2">
                        <div className="pf-field">
                            <label>Supply Price *</label>
                            <div className="pf-prefix-wrap">
                                <span className="pf-prefix">₱</span>
                                <input
                                    type="number" step="0.01" name="purchase_price" required
                                    value={form.purchase_price}
                                    onChange={handleInputChange}
                                    className={errors.purchase_price ? 'pf-has-error' : ''}
                                    placeholder="0.00"
                                />
                            </div>
                            {errors.purchase_price && <span className="pf-error">{errors.purchase_price[0]}</span>}
                        </div>

                        <div className="pf-field">
                            <label>Retail Price *</label>
                            <div className="pf-prefix-wrap">
                                <span className="pf-prefix">₱</span>
                                <input
                                    type="number" step="0.01" name="sell_price" required
                                    value={form.sell_price}
                                    onChange={handleInputChange}
                                    className={errors.sell_price ? 'pf-has-error' : ''}
                                    placeholder="0.00"
                                />
                            </div>
                            {errors.sell_price && <span className="pf-error">{errors.sell_price[0]}</span>}
                        </div>
                    </div>
                </div>

                {/* Right — Variants */}
                <div className="pf-col-variants">
                    <p className="pf-section-title" style={{ margin: 0 }}>Product Variants</p>

                    {!variantEnabled ? (
                        <div className="pf-no-variants">
                            <div className="pf-no-variants-icon">📦</div>
                            <p>No variants added yet.<br /><strong>Get started by enabling variants.</strong></p>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => { setVariantEnabled(true); handleAddRow(); }}
                            >
                                Enable Variants
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="pf-variant-header">
                                <span className="badge badge--green">Variants Enabled</span>
                                <button
                                    type="button"
                                    className="btn btn--sm btn--danger-soft"
                                    onClick={() => { setVariantEnabled(false); setVariantRows([]); }}
                                >
                                    ✕ Disable
                                </button>
                            </div>

                            <div className="pf-matrix-wrap">
                                <div className="pf-matrix-toolbar">
                                    <span>Variant Combinations</span>
                                    <button
                                        type="button"
                                        className="btn btn--sm btn--ghost"
                                        style={{ padding: '2px 10px', fontSize: '0.75rem', height: 'auto' }}
                                        onClick={handleAddRow}
                                    >
                                        + Add Row
                                    </button>
                                </div>

                                <div className="pf-matrix-scroll">
                                    <table className="pf-matrix-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '70px' }}>Image</th>
                                                <th>Size</th>
                                                <th>Color</th>
                                                <th>Weight/g</th>
                                                <th style={{ width: '80px' }}>Stock *</th>
                                                <th style={{ width: '110px' }}>Price Override</th>
                                                <th style={{ width: '100px' }}>SKU Suffix</th>
                                                <th style={{ width: '36px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variantRows.map((row, index) => (
                                                <tr key={row.id}>
                                                    {/* ── Image cell ── */}
                                                    <td>
                                                        <div
                                                            className="pf-variant-img-cell"
                                                            onClick={() => document.getElementById(`vi-${row.id}`).click()}
                                                            title="Click to upload image"
                                                        >
                                                            {row.imagePreview
                                                                ? <img src={row.imagePreview} alt="variant" className="pf-variant-thumb" />
                                                                : <span className="pf-variant-img-placeholder">📷</span>
                                                            }
                                                        </div>
                                                        <input
                                                            id={`vi-${row.id}`}
                                                            type="file"
                                                            accept="image/*"
                                                            hidden
                                                            onChange={e => handleRowImage(row.id, e.target.files[0])}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pf-matrix-input"
                                                            value={row.size_value_id}
                                                            onChange={e => handleRowChange(row.id, 'size_value_id', e.target.value)}
                                                        >
                                                            <option value="">No Size</option>
                                                            {sizeVariant?.values?.filter(v => !v.category || v.category == form.category_id).map(val => (
                                                                <option key={val.id} value={val.id}>{val.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pf-matrix-input"
                                                            value={row.color_value_id}
                                                            onChange={e => handleRowChange(row.id, 'color_value_id', e.target.value)}
                                                        >
                                                            <option value="">No Color</option>
                                                            {colorVariant?.values?.filter(v => !v.category || v.category == form.category_id).map(val => (
                                                                <option key={val.id} value={val.id}>{val.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pf-matrix-input"
                                                            value={row.weight_value_id}
                                                            onChange={e => handleRowChange(row.id, 'weight_value_id', e.target.value)}
                                                        >
                                                            <option value="">No Weight</option>
                                                            {weightVariant?.values?.filter(v => !v.category || v.category == form.category_id).map(val => (
                                                                <option key={val.id} value={val.id}>{val.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" min="0" required
                                                            className="pf-matrix-input"
                                                            value={row.stock}
                                                            onChange={e => handleRowChange(row.id, 'stock', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" min="0"
                                                            className="pf-matrix-input"
                                                            value={row.price_override}
                                                            onChange={e => handleRowChange(row.id, 'price_override', e.target.value)}
                                                            placeholder={`₱${form.sell_price || '0'}`}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="pf-matrix-input"
                                                            value={row.sku_suffix}
                                                            onChange={e => handleRowChange(row.id, 'sku_suffix', e.target.value)}
                                                            placeholder="-RED-L"
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="pf-rem-row"
                                                            onClick={() => handleRemoveRow(row.id)}
                                                            title="Remove row"
                                                        >✕</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {variantRows.length === 0 && (
                                                <tr>
                                                    <td colSpan="8">
                                                        <div className="pf-matrix-empty">
                                                            No variant rows yet. Click "+ Add Row" to define a combination.
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="pf-footer">
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                    {product ? `Editing: ${product.name}` : 'New Product'}
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn--white" onClick={onCancel} type="button">Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} type="button">
                        {loading ? 'Saving…' : product ? 'Update Product' : 'Save Product'}
                    </button>
                </div>
            </div>
        </div>
    );
}
