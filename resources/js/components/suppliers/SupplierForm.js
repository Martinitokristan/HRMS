import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { sileo } from 'sileo';
import { X } from 'lucide-react';

const inputClass = [
    'w-full h-[36px] px-[10px] text-[13px] text-[#111827]',
    'border border-[#d1d5db] rounded-[6px] bg-[#f9fafb]',
    'focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]',
    'transition-shadow',
].join(' ');

const labelClass = 'block text-[11px] font-medium text-[#6b7280] uppercase tracking-[0.04em] mb-1';

export default function SupplierForm({ isOpen, supplier, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        status: 'active',
        address: '',
    });

    useEffect(() => {
        if (supplier) {
            setForm({
                name: supplier.name || '',
                contact_name: supplier.contact_name || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                status: supplier.status || 'active',
                address: supplier.address || '',
            });
        } else {
            setForm({ name: '', contact_name: '', email: '', phone: '', status: 'active', address: '' });
        }
    }, [supplier]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (supplier?.id) {
                await api.put(`/suppliers/${supplier.id}`, form);
                sileo.success('Supplier updated successfully');
            } else {
                await api.post('/suppliers', form);
                sileo.success('Supplier added successfully');
            }
            onSuccess();
        } catch (error) {
            const msg = error.response?.data?.message || 'Error saving supplier';
            sileo.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const title = supplier ? 'Edit Supplier' : 'Add New Supplier';
    const submitLabel = loading ? 'Saving...' : (supplier ? 'Update Supplier' : 'Add Supplier');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={onCancel}
        >
            <div
                className="relative w-full max-w-[520px] bg-white rounded-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <span className="text-[15px] font-semibold text-[#111827]">{title}</span>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-[#6b7280] hover:text-[#111] transition-colors rounded p-0.5"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="border-t border-[#e5e7eb] mb-4" />

                {/* Form Body */}
                <form onSubmit={handleSubmit}>
                    <div className="px-6 grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Company Name — full width */}
                        <div className="col-span-2">
                            <label className={labelClass}>Company Name *</label>
                            <input
                                type="text"
                                required
                                className={inputClass}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Metro Hardware Supply"
                            />
                        </div>
                        {/* Contact Person */}
                        <div>
                            <label className={labelClass}>Contact Person</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.contact_name}
                                onChange={e => setForm({ ...form, contact_name: e.target.value })}
                                placeholder="e.g. Juan Dela Cruz"
                            />
                        </div>
                        {/* Email Address */}
                        <div>
                            <label className={labelClass}>Email Address</label>
                            <input
                                type="email"
                                className={inputClass}
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                placeholder="supplier@example.com"
                            />
                        </div>
                        {/* Phone Number */}
                        <div>
                            <label className={labelClass}>Phone Number</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                placeholder="0917-000-0000"
                            />
                        </div>
                        {/* Status */}
                        <div>
                            <label className={labelClass}>Status</label>
                            <select
                                className={inputClass}
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending Approval</option>
                            </select>
                        </div>
                        {/* Office Address — full width, single-line */}
                        <div className="col-span-2">
                            <label className={labelClass}>Office Address</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.address}
                                onChange={e => setForm({ ...form, address: e.target.value })}
                                placeholder="Street, City, Province"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 pt-[14px] pb-5 mt-4 border-t border-[#e5e7eb] flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="h-[34px] px-4 text-[13px] font-medium rounded-[6px] border border-[#d1d5db] text-[#374151] bg-white hover:bg-[#f3f4f6] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="h-[34px] px-4 text-[13px] font-medium rounded-[6px] bg-[#f97316] text-white hover:bg-[#ea6c0a] transition-colors disabled:opacity-60"
                        >
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
