import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import Modal from '../shared/Modal';

export default function ProductModal({ isOpen, onClose, product, categories, suppliers, unitTypes, variants, onSuccess }) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        name: '', sku: '', category_id: '', supplier_id: '', unit_type_id: '',
        purchase_price: '', sell_price: '', description: ''
    });

    // Variant state (List approach)
    const [variantEnabled, setVariantEnabled] = useState(false);
    
    // Each row represents exactly one stock entry (one specific size + color combination)
    // Structure: { id: Date.now(), size_value_id: '', color_value_id: '', weight_value_id: '', stock: 0, price_override: '', sku_suffix: '' }
    const [variantRows, setVariantRows] = useState([]);

    const sizeVariant = variants?.find(v => v.name.toLowerCase() === 'size');
    const colorVariant = variants?.find(v => v.name.toLowerCase() === 'color');
    const weightVariant = variants?.find(v => v.id === 3 || v.name.toLowerCase().includes('weight') || v.name.toLowerCase().includes('gram'));

    // ─── Reset on open ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        setImageFile(null);
        setErrors({});

        if (product) {
            setForm({
                name: product.name || '',
                sku: product.sku || '',
                category_id: product.category_id || '',
                supplier_id: product.supplier_id || '',
                unit_type_id: product.unit_type_id || '',
                purchase_price: product.purchase_price || '',
                sell_price: product.sell_price || '',
                description: product.description || ''
            });
            setImagePreview(product.image_path ? `/storage/${product.image_path}` : null);

            const pvs = product.product_variants || [];
            if (pvs.length > 0) {
                setVariantEnabled(true);
                const rows = pvs.map(pv => ({
                    id: pv.id || Math.random(),
                    size_value_id: pv.size_value_id || '',
                    color_value_id: pv.color_value_id || '',
                    weight_value_id: pv.weight_value_id || '',
                    stock: pv.stock || 0,
                    price_override: pv.price_override || '',
                    sku_suffix: pv.sku_suffix || ''
                }));
                setVariantRows(rows);
            } else {
                setVariantEnabled(false);
                setVariantRows([]);
            }
        } else {
            setForm({ name: '', sku: '', category_id: '', supplier_id: '', unit_type_id: '', purchase_price: '', sell_price: '', description: '' });
            setImagePreview(null);
            setVariantEnabled(false);
            setVariantRows([]);
        }
    }, [isOpen, product]);

    const handleAddRow = () => {
        setVariantRows(prev => [
            ...prev,
            { id: Date.now() + Math.random(), size_value_id: '', color_value_id: '', stock: 0, price_override: '', sku_suffix: '' }
        ]);
    };

    const handleRemoveRow = (id) => {
        setVariantRows(prev => prev.filter(r => r.id !== id));
    };

    const handleRowChange = (id, field, value) => {
        setVariantRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleInputChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setErrors({});
        
        const fd = new FormData();
        Object.keys(form).forEach(k => form[k] !== '' && fd.append(k, form[k]));
        if (imageFile) fd.append('image', imageFile);

        // Build variants list
        const variantList = variantEnabled
            ? variantRows.map(row => ({
                size_value_id: row.size_value_id || null,
                color_value_id: row.color_value_id || null,
                weight_value_id: row.weight_value_id || null,
                stock: row.stock || 0,
                price_override: row.price_override !== '' && row.price_override !== null && row.price_override !== undefined
                    ? row.price_override
                    : null,
                sku_suffix: row.sku_suffix || null,
            }))
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

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={product ? 'Edit Product' : 'Add New Product'}
            size="fullscreen"
            footer={
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <button className="btn btn--white" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving…' : product ? 'Update Product' : 'Save Product'}
                    </button>
                </div>
            }
        >
            <div className="pm-wrap">
                {/* ── Left column: image + basic info ── */}
                <div className="pm-left">
                    <div className="pm-img-zone" onClick={() => document.getElementById('pm-img-input').click()}>
                        {imagePreview
                            ? <img src={imagePreview} alt="preview" className="pm-img-preview" />
                            : <div className="pm-img-placeholder"><span>📷</span><small>Click to upload image</small></div>}
                        <input id="pm-img-input" type="file" accept="image/*" hidden onChange={handleFileChange} />
                    </div>

                    <div className="pm-section-label">Basic Info</div>

                    <div className="pm-field">
                        <label>Product Name *</label>
                        <input name="name" required value={form.name} onChange={handleInputChange} placeholder="e.g. Premium Polo Shirt" className={errors.name ? 'has-error' : ''} />
                        {errors.name && <small className="error-text">{errors.name[0]}</small>}
                    </div>
                    <div className="pm-field">
                        <label>Base SKU *</label>
                        <input name="sku" required value={form.sku} onChange={handleInputChange} placeholder="POLO-001" className={errors.sku ? 'has-error' : ''} />
                        {errors.sku && <small className="error-text">{errors.sku[0]}</small>}
                    </div>
                    <div className="pm-field">
                        <label>Category *</label>
                        <select name="category_id" required value={form.category_id} onChange={handleInputChange} className={errors.category_id ? 'has-error' : ''}>
                            <option value="">Select…</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {errors.category_id && <small className="error-text">{errors.category_id[0]}</small>}
                    </div>
                    <div className="pm-field">
                        <label>Supplier</label>
                        <select name="supplier_id" value={form.supplier_id} onChange={handleInputChange} className={errors.supplier_id ? 'has-error' : ''}>
                            <option value="">Select…</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {errors.supplier_id && <small className="error-text">{errors.supplier_id[0]}</small>}
                    </div>
                    <div className="pm-field">
                        <label>Unit Type *</label>
                        <select name="unit_type_id" required value={form.unit_type_id} onChange={handleInputChange} className={errors.unit_type_id ? 'has-error' : ''}>
                            <option value="">Select…</option>
                            {unitTypes.map(u => <option key={u.id} value={u.id}>{u.purchase_unit} / {u.sell_unit}</option>)}
                        </select>
                        {errors.unit_type_id && <small className="error-text">{errors.unit_type_id[0]}</small>}
                    </div>
                    <div className="pm-row2">
                        <div className="pm-field">
                            <label>Supply Price *</label>
                            <input type="number" step="0.01" name="purchase_price" required value={form.purchase_price} onChange={handleInputChange} className={errors.purchase_price ? 'has-error' : ''} />
                            {errors.purchase_price && <small className="error-text">{errors.purchase_price[0]}</small>}
                        </div>
                        <div className="pm-field">
                            <label>Retail Price *</label>
                            <input type="number" step="0.01" name="sell_price" required value={form.sell_price} onChange={handleInputChange} className={errors.sell_price ? 'has-error' : ''} />
                            {errors.sell_price && <small className="error-text">{errors.sell_price[0]}</small>}
                        </div>
                    </div>
                    <div className="pm-field">
                        <label>Description</label>
                        <textarea name="description" rows={3} value={form.description} onChange={handleInputChange} placeholder="Optional product notes…" />
                    </div>
                </div>

                {/* ── Right column: variants ── */}
                <div className="pm-right">
                    <div className="pm-section-label">Product Variants</div>

                    {!variantEnabled ? (
                        <div className="pm-no-variants">
                            <div className="pm-no-variants-icon">🎛️</div>
                            <p>This product has <strong>no variants</strong> (single stock).</p>
                            <button type="button" className="btn btn-primary btn--sm" onClick={() => { setVariantEnabled(true); handleAddRow(); }}>
                                + Enable Variants (Sizes &amp; Colors)
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="pm-variant-header">
                                <span className="badge badge--green">Variants Enabled</span>
                                <button type="button" className="btn btn--sm btn--danger-soft" onClick={() => { setVariantEnabled(false); setVariantRows([]); }}>
                                    ✕ Disable
                                </button>
                            </div>

                            <div className="pm-matrix-wrap">
                                <div className="pm-matrix-label">
                                    Variant Combinations
                                    <button type="button" className="btn btn--sm btn--ghost" onClick={handleAddRow} style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto' }}>
                                        + Add Row
                                    </button>
                                </div>
                                <div className="pm-matrix-scroll">
                                    <table className="pm-matrix-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '18%' }}>Size</th>
                                                <th style={{ width: '18%' }}>Color</th>
                                                <th style={{ width: '18%' }}>Weight/Grams</th>
                                                <th style={{ width: '12%' }}>Stock *</th>
                                                <th style={{ width: '15%' }}>Price Over.</th>
                                                <th style={{ width: '14%' }}>SKU Suf.</th>
                                                <th style={{ width: '5%' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variantRows.map((row, index) => (
                                                <tr key={row.id}>
                                                    <td>
                                                        <select
                                                            className="pm-matrix-input"
                                                            value={row.size_value_id}
                                                            onChange={e => handleRowChange(row.id, 'size_value_id', e.target.value)}
                                                        >
                                                            <option value="">No Size</option>
                                                            {sizeVariant?.values?.filter(val => !val.category || val.category == form.category_id).map(val => (
                                                                <option key={val.id} value={val.id}>{val.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pm-matrix-input"
                                                            value={row.color_value_id}
                                                            onChange={e => handleRowChange(row.id, 'color_value_id', e.target.value)}
                                                        >
                                                            <option value="">No Color</option>
                                                            {colorVariant?.values?.filter(val => !val.category || val.category == form.category_id).map(val => (
                                                                <option key={val.id} value={val.id}>{val.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pm-matrix-input"
                                                            value={row.weight_value_id}
                                                            onChange={e => handleRowChange(row.id, 'weight_value_id', e.target.value)}
                                                        >
                                                            <option value="">No Weight</option>
                                                            {weightVariant?.values?.filter(val => !val.category || val.category == form.category_id).map(val => (
                                                                <option key={val.id} value={val.id}>{val.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" min="0" required
                                                            className="pm-matrix-input"
                                                            value={row.stock}
                                                            onChange={e => handleRowChange(row.id, 'stock', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" min="0"
                                                            className="pm-matrix-input"
                                                            value={row.price_override}
                                                            onChange={e => handleRowChange(row.id, 'price_override', e.target.value)}
                                                            placeholder={`₱${form.sell_price || '0'}`}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="pm-matrix-input"
                                                            value={row.sku_suffix}
                                                            onChange={e => handleRowChange(row.id, 'sku_suffix', e.target.value)}
                                                            placeholder="-RED-44"
                                                        />
                                                    </td>
                                                    <td>
                                                        <button 
                                                            type="button" 
                                                            className="pm-rem-row" 
                                                            onClick={() => handleRemoveRow(row.id)}
                                                            title="Remove combination"
                                                        >✕</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {variantRows.length === 0 && (
                                                <tr>
                                                    <td colSpan="6">
                                                        <div className="pm-matrix-hint" style={{ margin: '15px' }}>
                                                            No variants added yet. Click "+ Add Row" to define a combination.
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

            <style>{`
                .pm-wrap {
                    display: grid;
                    grid-template-columns: 360px 1fr;
                    gap: 0;
                    height: 100%;
                }
                .pm-left {
                    padding: 24px;
                    border-right: 1px solid var(--border);
                    overflow-y: auto;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .pm-right {
                    padding: 24px;
                    overflow-y: auto;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    background: #fafbfc;
                }
                .pm-section-label {
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--text3);
                    margin-bottom: 2px;
                }
                .pm-img-zone {
                    width: 100%;
                    min-height: 200px;
                    flex-shrink: 0;
                    border: 2px dashed var(--border);
                    border-radius: 12px;
                    overflow: hidden;
                    cursor: pointer;
                    background: #f8f9fa;
                    display: grid;
                    place-items: center;
                    transition: border-color 0.2s;
                    margin-bottom: 6px;
                }
                .pm-img-zone:hover { border-color: var(--accent); }
                .pm-img-preview { width: 100%; height: 100%; object-fit: cover; }
                .pm-img-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text3); }
                .pm-img-placeholder span { font-size: 2rem; }
                .pm-img-placeholder small { font-size: 0.75rem; }
                .pm-field { display: flex; flex-direction: column; gap: 3px; }
                .pm-field label { font-size: 0.75rem; font-weight: 700; color: var(--text2); }
                .pm-field input, .pm-field select, .pm-field textarea {
                    padding: 7px 10px; border: 1px solid var(--border); border-radius: 7px; font-size: 0.875rem; width: 100%; box-sizing: border-box;
                }
                .pm-field input:focus, .pm-field select:focus, .pm-field textarea:focus {
                    border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px rgba(255,140,0,0.12);
                }
                .pm-field input.has-error, .pm-field select.has-error {
                    border-color: #dc2626; background: #fef2f2;
                }
                .error-text { color: #dc2626; font-size: 0.7rem; font-weight: 600; margin-top: 2px; }
                .pm-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

                /* Variants right panel */
                .pm-no-variants {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    text-align: center;
                    color: var(--text2);
                    border: 2px dashed var(--border);
                    border-radius: 12px;
                    padding: 40px 20px;
                }
                .pm-no-variants-icon { font-size: 2.5rem; }
                .pm-variant-header {
                    display: flex; align-items: center; justify-content: space-between;
                    background: #e9f7ef; border-radius: 8px; padding: 8px 12px;
                }
                .btn--danger-soft {
                    background: #fee2e2; color: #dc2626; border: none;
                    padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;
                }

                /* Matrix */
                .pm-matrix-wrap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: #fff; }
                .pm-matrix-label {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 8px 12px; background: #f8fbff;
                    font-size: 0.75rem; font-weight: 700; color: var(--text2);
                    border-bottom: 1px solid var(--border);
                }
                .pm-matrix-scroll { overflow-x: auto; }
                .pm-matrix-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
                .pm-matrix-table th {
                    padding: 8px 10px; text-align: left; font-size: 0.7rem; text-transform: uppercase;
                    font-weight: 700; color: var(--text3); border-bottom: 1px solid var(--border);
                    white-space: nowrap;
                }
                .pm-matrix-table td { padding: 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                .pm-matrix-table tr:last-child td { border-bottom: none; }
                .pm-matrix-input {
                    width: 100%; padding: 6px 8px;
                    border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;
                }
                .pm-matrix-input:focus { border-color: var(--accent); outline: none; }
                .pm-matrix-hint {
                    background: #fffbeb; border: 1px dashed #fcd34d; border-radius: 10px;
                    padding: 16px; text-align: center; color: #92400e; font-size: 0.85rem;
                }
                .pm-rem-row {
                    background: #fee2e2; color: #dc2626; border: none; cursor: pointer;
                    width: 24px; height: 24px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;
                    font-size: 0.8rem; transition: background 0.15s; font-weight: bold;
                }
                .pm-rem-row:hover { background: #fca5a5; }

                @media (max-width: 700px) {
                    .pm-wrap { grid-template-columns: 1fr; }
                    .pm-left { border-right: none; border-bottom: 1px solid var(--border); max-height: none; }
                    .pm-right { max-height: none; }
                }
            `}</style>
        </Modal>
    );
}
