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
                            // Extract amount and order number from message
                            const amountMatch = n.message?.match(/₱([\d,]+\.?\d*)/);
                            const orderMatch = n.message?.match(/order #(\S+)/);
                            PaymentToastContainer.show({
                                amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
                                orderNumber: orderMatch ? orderMatch[1] : null,
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
