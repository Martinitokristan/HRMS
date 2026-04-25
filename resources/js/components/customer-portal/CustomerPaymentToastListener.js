import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import PaymentToastContainer from '../shared/PaymentToast';

export default function CustomerPaymentToastListener() {
    const { user } = useAuth();
    const seenPaymentIds = useRef(new Set());
    const initialFetchDone = useRef(false);

    useEffect(() => {
        if (!user || user.role !== 'customer') return;

        const fetchNotifications = async () => {
            try {
                const r = await api.get('/customer/notifications');
                const notis = r.data?.data || [];

                // Detect new payment_confirmed notifications and fire toast
                const paymentNotis = notis.filter(n => n.type === 'payment_confirmed');

                if (!initialFetchDone.current) {
                    // First fetch — just record existing IDs, don't toast
                    paymentNotis.forEach(n => seenPaymentIds.current.add(n.id));
                    initialFetchDone.current = true;
                } else {
                    // Subsequent fetches — toast for any new ones
                    paymentNotis.forEach(n => {
                        if (!seenPaymentIds.current.has(n.id)) {
                            seenPaymentIds.current.add(n.id);

                            const meta = n.meta && typeof n.meta === 'object' ? n.meta : {};

                            // Prefer structured meta; fall back to regex parse for legacy notifications
                            let amount = meta.amount;
                            let orderNumber = meta.order_number;
                            const items = Array.isArray(meta.items) ? meta.items : undefined;

                            if (amount == null) {
                                const m = n.message?.match(/₱([\d,]+\.?\d*)/);
                                if (m) amount = parseFloat(m[1].replace(/,/g, ''));
                            }
                            if (!orderNumber) {
                                const om = n.message?.match(/order #(\S+)/);
                                if (om) orderNumber = om[1];
                            }

                            PaymentToastContainer.show({
                                amount: amount ?? null,
                                orderNumber: orderNumber ?? null,
                                items,
                                // intentionally do NOT pass customerName — keeps the existing customer-side title
                                // ("Your GCash payment was successfully received") and "From HRMS" fallback.
                            });
                        }
                    });
                }
            } catch (e) { }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        return () => clearInterval(interval);
    }, [user?.id, user?.role]);

    return <PaymentToastContainer />;
}
