import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip — A lightweight, accessible tooltip component.
 *
 * Props:
 *   label       (string)   — Text displayed inside the tooltip
 *   position    ('top' | 'bottom' | 'left' | 'right') — Preferred side. Default: 'bottom'
 *   delay       (number)   — Hover delay in ms before showing. Default: 300
 *   children    (ReactNode)— The trigger element(s)
 *   className   (string)   — Extra classes on wrapper
 *   disabled    (boolean)  — Skip rendering the tooltip entirely
 *   offset      (number)   — Gap between trigger and tooltip in px. Default: 6
 */
export default function Tooltip({
    label,
    position = 'bottom',
    delay = 300,
    children,
    className = '',
    disabled = false,
    offset = 6,
}) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState(null);
    const timerRef = useRef(null);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => setVisible(true), delay);
    }, [delay]);

    const hide = useCallback(() => {
        clearTimeout(timerRef.current);
        setVisible(false);
        setCoords(null);
    }, []);

    const updatePosition = useCallback(() => {
        if (!visible || !triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tipRect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let best = position;

        if (best === 'top' && triggerRect.top - tipRect.height - offset < 0) {
            best = 'bottom';
        } else if (best === 'bottom' && triggerRect.bottom + tipRect.height + offset > vh) {
            best = 'top';
        } else if (best === 'left' && triggerRect.left - tipRect.width - offset < 0) {
            best = 'right';
        } else if (best === 'right' && triggerRect.right + tipRect.width + offset > vw) {
            best = 'left';
        }

        let top = 0;
        let left = 0;

        switch (best) {
            case 'top':
                top = triggerRect.top - tipRect.height - offset;
                left = triggerRect.left + (triggerRect.width / 2) - (tipRect.width / 2);
                break;
            case 'bottom':
                top = triggerRect.bottom + offset;
                left = triggerRect.left + (triggerRect.width / 2) - (tipRect.width / 2);
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height / 2) - (tipRect.height / 2);
                left = triggerRect.left - tipRect.width - offset;
                break;
            case 'right':
                top = triggerRect.top + (triggerRect.height / 2) - (tipRect.height / 2);
                left = triggerRect.right + offset;
                break;
        }

        // Bounds checks
        if (left < offset) left = offset;
        if (left + tipRect.width + offset > vw) left = vw - tipRect.width - offset;
        if (top < offset) top = offset;
        if (top + tipRect.height + offset > vh) top = vh - tipRect.height - offset;

        setCoords({ top, left });
    }, [position, offset, visible]);

    useEffect(() => {
        if (visible) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [visible, updatePosition]);

    // Clean up timer on unmount
    useEffect(() => () => clearTimeout(timerRef.current), []);

    if (disabled || !label) return <>{children}</>;

    return (
        <div
            ref={triggerRef}
            className={`relative inline-flex ${className}`}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {children}
            {visible && createPortal(
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    style={{
                        position: 'fixed',
                        top: coords ? `${coords.top}px` : '-9999px',
                        left: coords ? `${coords.left}px` : '-9999px',
                        zIndex: 999999,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        backgroundColor: '#1a1a1a',
                        color: '#ffffff',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        lineHeight: 1.3,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                        letterSpacing: '0.01em',
                        opacity: coords ? 1 : 0,
                        transition: 'opacity 0.15s ease-in-out'
                    }}
                >
                    {label}
                </div>,
                document.body
            )}
        </div>
    );
}
