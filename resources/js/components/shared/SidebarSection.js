import React from 'react';
import { cn } from '../../lib/utils';

/**
 * SidebarSection — A reusable component for sidebar section labels.
 * 
 * Props:
 *   label       (string)   — The text to display
 *   isCollapsed (boolean)  — Current state of the sidebar
 *   className   (string)   — Optional extra classes
 */
export default function SidebarSection({ 
    label, 
    isCollapsed, 
    className = "" 
}) {
    if (!label) return null;

    return (
        <div className={cn(
            "transition-all duration-300",
            isCollapsed ? "py-3 flex flex-col items-center" : "px-5 pt-3 pb-1",
            className
        )}>
            <p className={cn(
                "font-bold uppercase tracking-[0.15em] text-white/25 truncate transition-all duration-300",
                isCollapsed ? "text-[8px] px-1 w-full text-center" : "text-[10px]"
            )}>
                {label}
            </p>
            {isCollapsed && (
                <div className="h-px w-6 bg-white/10 mt-1.5 transition-all duration-300" />
            )}
        </div>
    );
}
