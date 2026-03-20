import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';

export default function SupplierForm({ supplier, onSuccess, onCancel }) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: ''
    });

    useEffect(() => {
        if (supplier) {
            setForm({
                name: supplier.name || '',
                contact_name: supplier.contact_name || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || ''
            });
        } else {
            setForm({
                name: '',
                contact_name: '',
                email: '',
                phone: '',
                address: ''
            });
        }
    }, [supplier]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (supplier?.id) {
                await axios.put(`/suppliers/${supplier.id}`, form);
                showToast('Supplier updated successfully');
            } else {
                await axios.post('/suppliers', form);
                showToast('Supplier added successfully');
            }
            onSuccess();
        } catch (error) {
            const msg = error.response?.data?.message || 'Error saving supplier';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-grid">
                <div className="form-group sm:col-span-2">
                    <label>Company Name *</label>
                    <input 
                        type="text" 
                        required 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="e.g. Metro Hardware Supply"
                    />
                </div>
                <div className="form-group">
                    <label>Contact Person</label>
                    <input 
                        type="text" 
                        value={form.contact_name} 
                        onChange={e => setForm({...form, contact_name: e.target.value})} 
                        placeholder="e.g. Juan Dela Cruz"
                    />
                </div>
                <div className="form-group">
                    <label>Email Address</label>
                    <input 
                        type="email" 
                        value={form.email} 
                        onChange={e => setForm({...form, email: e.target.value})} 
                        placeholder="supplier@example.com"
                    />
                </div>
                <div className="form-group">
                    <label>Phone Number</label>
                    <input 
                        type="text" 
                        value={form.phone} 
                        onChange={e => setForm({...form, phone: e.target.value})} 
                        placeholder="0917-000-0000"
                    />
                </div>
                <div className="form-group sm:col-span-2">
                    <label>Office Address</label>
                    <textarea 
                        value={form.address} 
                        onChange={e => setForm({...form, address: e.target.value})} 
                        placeholder="Street, City, Province"
                        rows="3"
                    />
                </div>
            </div>
            <div className="modal__footer">
                <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (supplier ? 'Update Supplier' : 'Add Supplier')}
                </button>
            </div>
        </form>
    );
}
