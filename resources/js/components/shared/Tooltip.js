import React, { useState, useRef, useEffect, useCallback } from 'react';

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
    const [adjustedPos, setAdjustedPos] = useState(position);
    const timerRef = useRef(null);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => setVisible(true), delay);
    }, [delay]);

    const hide = useCallback(() => {
        clearTimeout(timerRef.current);
        setVisible(false);
    }, []);

    // Adjust position if tooltip would clip viewport
    useEffect(() => {
        if (!visible || !triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tipRect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let best = position;

        if (position === 'top' && triggerRect.top - tipRect.height - offset < 0) {
            best = 'bottom';
        } else if (position === 'bottom' && triggerRect.bottom + tipRect.height + offset > vh) {
            best = 'top';
        } else if (position === 'left' && triggerRect.left - tipRect.width - offset < 0) {
            best = 'right';
        } else if (position === 'right' && triggerRect.right + tipRect.width + offset > vw) {
            best = 'left';
        }

        setAdjustedPos(best);
    }, [visible, position, offset]);

    // Clean up timer on unmount
    useEffect(() => () => clearTimeout(timerRef.current), []);

    if (disabled || !label) return <>{children}</>;

    const positionStyles = {
        top: {
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: `${offset}px`,
        },
        bottom: {
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: `${offset}px`,
        },
        left: {
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginRight: `${offset}px`,
        },
        right: {
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: `${offset}px`,
        },
    };

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
            {visible && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        ...positionStyles[adjustedPos],
                        zIndex: 9999,
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
                    }}
                >
                    {label}
                </div>
            )}
        </div>
    );
}
