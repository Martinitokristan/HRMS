import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

const ToastContext = createContext(null);

const toastConfig = {
    success: {
        icon: CheckCircle,
        bg: 'bg-white border-l-[#22C55E]',
        iconClass: 'text-[#22C55E]',
    },
    error: {
        icon: XCircle,
        bg: 'bg-white border-l-[#EF4444]',
        iconClass: 'text-[#EF4444]',
    },
    info: {
        icon: Info,
        bg: 'bg-white border-l-[#3B82F6]',
        iconClass: 'text-[#3B82F6]',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-white border-l-[#F59E0B]',
        iconClass: 'text-[#F59E0B]',
    },
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3500);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const toast = {
        success: (msg) => showToast(msg, 'success'),
        error: (msg) => showToast(msg, 'error'),
        info: (msg) => showToast(msg, 'info'),
        warning: (msg) => showToast(msg, 'warning'),
    };

    return (
        <ToastContext.Provider value={{ showToast, toast }}>
            {children}
            <div className="fixed bottom-5 right-5 z-[600] flex flex-col gap-2.5 w-[340px] max-w-[calc(100vw-2rem)]">
                {toasts.map(t => {
                    const cfg = toastConfig[t.type] || toastConfig.success;
                    const Icon = cfg.icon;
                    return (
                        <div
                            key={t.id}
                            className={cn(
                                'flex items-start gap-3 rounded-xl border border-border border-l-4 p-4 shadow-modal',
                                'animate-slide-in-right',
                                cfg.bg
                            )}
                        >
                            <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', cfg.iconClass)} />
                            <p className="flex-1 text-sm font-medium text-foreground leading-snug">{t.message}</p>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
