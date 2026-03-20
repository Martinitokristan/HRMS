import React, { useRef } from 'react';
import ReactToPrint from 'react-to-print';

export default function Receipt({ isOpen, onClose, data, type = 'sale' }) {
    const printRef = useRef();

    if (!isOpen || !data) return null;

    const getTitle = () => {
        switch(type) {
            case 'sale': return 'Sales Receipt';
            case 'delivery': return 'Delivery Invoice';
            case 'po': return 'Purchase Order';
            default: return 'Receipt';
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => `₱${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 20, maxWidth: 800,
                width: '100%', maxHeight: '90vh', overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header Actions */}
                <div style={{
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f8fafc'
                }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{getTitle()}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <ReactToPrint
                            trigger={() => (
                                <button className="btn btn--sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🖨️ Print
                                </button>
                            )}
                            content={() => printRef.current}
                        />
                        <button className="btn btn--sm btn--ghost" onClick={onClose}>Close</button>
                    </div>
                </div>

                {/* Printable Receipt */}
                <div ref={printRef} style={{ padding: '2.5rem' }}>
                    {/* Company Header */}
                    <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '3px solid var(--accent)', paddingBottom: '1.5rem' }}>
                        <div style={{ 
                            fontSize: '2.5rem', fontWeight: 900, 
                            background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            marginBottom: '0.5rem'
                        }}>HRMS</div>
                        <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 600 }}>
                            Hardware & Retail Management System
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            123 Main Street, City • Phone: (123) 456-7890
                        </div>
                    </div>

                    {/* Receipt Info */}
                    <div style={{ 
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem',
                        marginBottom: '2rem', padding: '1.25rem', background: '#f8fafc',
                        borderRadius: 12, border: '1px solid #e2e8f0'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                {type === 'sale' ? 'Receipt No.' : type === 'delivery' ? 'Delivery No.' : 'PO Number'}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                {data.receipt_number || data.delivery_number || data.po_number || data.id}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Date</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                                {formatDate(data.created_at || data.order_date || new Date())}
                            </div>
                        </div>
                        {data.customer_name && (
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Customer</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>{data.customer_name}</div>
                            </div>
                        )}
                        {data.rider_name && (
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Rider</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>{data.rider_name}</div>
                            </div>
                        )}
                        {data.supplier_name && (
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Supplier</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>{data.supplier_name}</div>
                            </div>
                        )}
                        {data.status && (
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>{data.status}</div>
                            </div>
                        )}
                    </div>

                    {/* Items Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                        <thead>
                            <tr style={{ background: '#1e293b', color: '#fff' }}>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Item</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Qty</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Price</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.items || []).map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '0.85rem 1rem' }}>
                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.product_name || item.name}</div>
                                        {item.variant && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.variant}</div>}
                                    </td>
                                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.price || item.unit_price)}</td>
                                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                                        {formatCurrency((item.quantity || 0) * (item.price || item.unit_price || 0))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
                        <div style={{ width: 300 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ fontWeight: 600, color: '#64748b' }}>Subtotal:</span>
                                <span style={{ fontWeight: 700 }}>{formatCurrency(data.subtotal || data.total_amount)}</span>
                            </div>
                            {data.tax_amount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 600, color: '#64748b' }}>Tax:</span>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(data.tax_amount)}</span>
                                </div>
                            )}
                            {data.discount_amount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 600, color: '#64748b' }}>Discount:</span>
                                    <span style={{ fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(data.discount_amount)}</span>
                                </div>
                            )}
                            <div style={{ 
                                display: 'flex', justifyContent: 'space-between', 
                                padding: '0.75rem 0', marginTop: '0.5rem',
                                borderTop: '2px solid #1e293b'
                            }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>TOTAL:</span>
                                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--accent)' }}>
                                    {formatCurrency(data.total_amount || data.grand_total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ 
                        textAlign: 'center', paddingTop: '1.5rem', 
                        borderTop: '2px dashed #cbd5e1', color: '#64748b',
                        fontSize: '0.85rem'
                    }}>
                        <p style={{ margin: '0.25rem 0', fontWeight: 600 }}>Thank you for your business!</p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.75rem' }}>
                            For inquiries, contact us at support@hrms.com
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
