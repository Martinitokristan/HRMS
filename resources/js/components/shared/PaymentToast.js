import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Smartphone, X, CheckCircle } from 'lucide-react';

/**
 * PaymentToast — A premium GCash payment received toast notification.
 * 
 * Usage:
 *   const { showPaymentToast } = usePaymentToast();
 *   showPaymentToast({ customerName, amount, phone, items, orderNumber });
 * 
 * Or imperatively:
 *   PaymentToast.show({ customerName, amount, phone, items, orderNumber });
 */

// ─── Singleton queue & renderer ───────────────────────────────────────────────
let _addToast = null;

function PaymentToastContainer() {
    const [toasts, setToasts] = useState([]);

    // Expose the "add" function globally
    _addToast = useCallback((data) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, ...data }]);
        return id;
    }, []);

    const remove = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                pointerEvents: 'none',
            }}
        >
            {toasts.map(toast => (
                <SingleToast key={toast.id} data={toast} onDone={() => remove(toast.id)} />
            ))}
        </div>,
        document.body
    );
}

function SingleToast({ data, onDone }) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef(null);
    const duration = data.duration || 4000;

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setVisible(true));

        // Auto-dismiss
        timerRef.current = setTimeout(() => {
            setExiting(true);
            setTimeout(onDone, 400);
        }, duration);

        return () => clearTimeout(timerRef.current);
    }, []);

    const handleClose = () => {
        clearTimeout(timerRef.current);
        setExiting(true);
        setTimeout(onDone, 400);
    };

    const { customerName, amount, phone, items, orderNumber } = data;

    // Build item summary string
    const itemSummary = Array.isArray(items) && items.length > 0
        ? items.map(i => `${i.quantity || i.qty || 1}x ${i.name || i.product_name || 'Item'}`).join(', ')
        : null;

    const totalPcs = Array.isArray(items)
        ? items.reduce((sum, i) => sum + (i.quantity || i.qty || 1), 0)
        : null;

    return (
        <div
            style={{
                pointerEvents: 'auto',
                width: 380,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12)',
                transform: visible && !exiting
                    ? 'translateY(0) scale(1)'
                    : exiting
                        ? 'translateY(-120%) scale(0.9)'
                        : 'translateY(-120%) scale(0.9)',
                opacity: visible && !exiting ? 1 : 0,
                transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                background: 'linear-gradient(135deg, #0066FF 0%, #007DFE 50%, #0095FF 100%)',
                position: 'relative',
            }}
        >
            {/* Animated shimmer overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                animation: 'paymentToastShimmer 2s ease-in-out infinite',
                pointerEvents: 'none',
            }} />

            {/* Close button */}
            <button
                onClick={handleClose}
                style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    border: 'none',
                    background: 'rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    zIndex: 2,
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            >
                <X size={14} />
            </button>

            <div style={{ padding: '16px 18px', position: 'relative', zIndex: 1 }}>
                {/* Header row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                }}>
                    <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Smartphone size={20} color="#fff" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}>
                            <CheckCircle size={14} color="#4ADE80" />
                            <span style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#fff',
                                letterSpacing: '0.02em',
                            }}>
                                GCash Payment Received
                            </span>
                        </div>
                        {orderNumber && (
                            <span style={{
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.6)',
                                fontWeight: 500,
                            }}>
                                Order #{orderNumber}
                            </span>
                        )}
                    </div>
                </div>

                {/* Details card */}
                <div style={{
                    background: 'rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    backdropFilter: 'blur(8px)',
                }}>
                    {/* Amount row */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: itemSummary || customerName || phone ? 8 : 0,
                        paddingBottom: itemSummary || customerName || phone ? 8 : 0,
                        borderBottom: itemSummary || customerName || phone ? '1px solid rgba(255,255,255,0.12)' : 'none',
                    }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                            Amount
                        </span>
                        <span style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: '#fff',
                            letterSpacing: '-0.02em',
                        }}>
                            ₱{typeof amount === 'number' ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : amount}
                        </span>
                    </div>

                    {/* Item(s) row */}
                    {itemSummary && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 6,
                        }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, flexShrink: 0, marginRight: 8 }}>
                                Items ({totalPcs} pc{totalPcs > 1 ? 's' : ''})
                            </span>
                            <span style={{
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.9)',
                                fontWeight: 600,
                                textAlign: 'right',
                                lineHeight: 1.4,
                                maxWidth: '65%',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                            }}>
                                {itemSummary}
                            </span>
                        </div>
                    )}

                    {/* Customer name */}
                    {customerName && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: phone ? 6 : 0,
                        }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                                Customer
                            </span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                                {customerName}
                            </span>
                        </div>
                    )}

                    {/* Phone */}
                    {phone && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                                GCash No.
                            </span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontFamily: 'monospace' }}>
                                {phone}
                            </span>
                        </div>
                    )}
                </div>

                {/* Bottom progress bar */}
                <div style={{
                    marginTop: 10,
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.15)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.5)',
                        animation: `paymentToastProgress ${duration}ms linear forwards`,
                    }} />
                </div>
            </div>

            {/* Inject keyframes */}
            <style>{`
                @keyframes paymentToastShimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                @keyframes paymentToastProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Imperative show function.
 * Call PaymentToast.show({ customerName, amount, phone, items, orderNumber })
 */
PaymentToastContainer.show = function (data) {
    if (_addToast) {
        _addToast(data);
    } else {
        // Container hasn't mounted yet, queue for next tick
        setTimeout(() => _addToast?.(data), 100);
    }
};

/**
 * React hook for showing payment toasts.
 * Returns { showPaymentToast }
 */
export function usePaymentToast() {
    return {
        showPaymentToast: (data) => PaymentToastContainer.show(data),
    };
}

export default PaymentToastContainer;
