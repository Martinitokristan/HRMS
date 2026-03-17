import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import Modal from '../shared/Modal';
import { StatusBadge } from '../shared/Badge';

export default function SupplierViewModal({ isOpen, onClose, supplierId, onEdit }) {
    const { showToast } = useToast();
    const [supplier, setSupplier] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !supplierId) return;
        
        let isMounted = true;
        setLoading(true);
        axios.get(`/suppliers/${supplierId}`)
            .then(res => {
                if (isMounted) {
                    setSupplier(res.data.data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    showToast('Failed to load supplier details', 'error');
                    setLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [isOpen, supplierId]);

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Supplier Details" 
            size="lg"
            footer={
                <div className="d-flex justify-between w-full">
                    <button className="btn btn-ghost" onClick={onClose}>Close</button>
                    {supplier && (
                        <button className="btn btn-primary" onClick={() => onEdit(supplier)}>
                            ✏️ Edit Supplier
                        </button>
                    )}
                </div>
            }
        >
            {loading ? (
                <div className="py-4 text-center"><div className="spinner" /></div>
            ) : supplier ? (
                <div>
                    <div className="grid grid-2 gap-4 mb-5 border-radius-lg p-3 bg-surface2">
                        <div>
                            <div className="text-xs font-bold text-muted uppercase mb-2">Company Info</div>
                            <h3 className="font-bold text-xl mb-2 text-primary">{supplier.name}</h3>
                            <div className="mb-3"><StatusBadge status={supplier.status} /></div>
                            
                            <div className="info-group mb-2">
                                <label className="text-xs font-bold text-muted uppercase d-block">Contact Person</label>
                                <div className="font-semi text-md">{supplier.contact_name || 'N/A'}</div>
                            </div>
                            
                            <div className="info-group mb-2">
                                <label className="text-xs font-bold text-muted uppercase d-block">Contact Details</label>
                                <div className="text-sm font-semi">{supplier.email || '-'}</div>
                                <div className="text-sm font-semi">{supplier.phone || '-'}</div>
                            </div>

                            <div className="info-group">
                                <label className="text-xs font-bold text-muted uppercase d-block">Physical Address</label>
                                <div className="text-sm italic">{supplier.address || 'No address provided'}</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-muted uppercase mb-2">Performance Summary</div>
                            <div className="grid grid-2 gap-2">
                                <div className="p-3 border border-radius-md bg-white text-center">
                                    <div className="text-xs text-muted font-bold uppercase">Products</div>
                                    <div className="text-xl font-bold">{supplier.products?.length || 0}</div>
                                </div>
                                <div className="p-3 border border-radius-md bg-white text-center">
                                    <div className="text-xs text-muted font-bold uppercase">Orders</div>
                                    <div className="text-xl font-bold">{supplier.purchase_orders?.length || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h4 className="text-xs font-bold text-muted uppercase mb-3">Recent Purchase Orders</h4>
                    <div className="table-wrap mb-2 border-radius-lg">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>PO Number</th>
                                    <th>Products</th>
                                    <th>Date</th>
                                    <th className="text-right">Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!supplier.purchase_orders || supplier.purchase_orders.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center text-muted py-4">No purchase orders history found.</td></tr>
                                ) : (
                                    supplier.purchase_orders.slice(0, 5).map(po => {
                                        const productNames = po.items?.map(it => it.product?.name).filter(Boolean) || [];
                                        const displayProducts = productNames.length > 2 
                                            ? `${productNames.slice(0, 2).join(', ')} ...(+${productNames.length - 2})`
                                            : productNames.join(', ') || 'N/A';

                                        return (
                                            <tr key={po.id}>
                                                <td className="font-bold">{po.po_number}</td>
                                                <td>
                                                    <div className="text-xs font-semi max-w-xs">{displayProducts}</div>
                                                </td>
                                                <td className="text-xs">{new Date(po.created_at).toLocaleDateString()}</td>
                                                <td className="text-right font-bold text-accent">
                                                    ₱{Number(po.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td><StatusBadge status={po.status} /></td>
                                            </tr>
                                        );
                                    })
                                ) }
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-muted">Failed to load supplier.</div>
            )}
        </Modal>
    );
}
