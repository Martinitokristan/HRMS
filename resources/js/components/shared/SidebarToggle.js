import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Tooltip from './Tooltip';
import { cn } from '../../lib/utils';

/**
 * SidebarToggle — A reusable component for collapsing/expanding sidebars.
 * 
 * Props:
 *   isCollapsed (boolean)  — Current state of the sidebar
 *   onToggle    (function) — Callback when the button is clicked
 *   className   (string)   — Optional extra tailwind classes for the button
 *   size        (number)   — Icon size. Default: 18
 */
export default function SidebarToggle({ 
    isCollapsed, 
    onToggle, 
    className = "", 
    size = 18 
}) {
    return (
        <Tooltip 
            label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} 
            position="right" 
            delay={200}
        >
            <button
                onClick={onToggle}
                aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                className={cn(
                    "hidden lg:flex group items-center justify-center p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-[#374151] transition-colors relative",
                    className
                )}
            >
                <div className="relative" style={{ width: size, height: size }}>
                    <PanelLeftClose 
                        size={size} 
                        className={cn(
                            "absolute inset-0 transition-all duration-200",
                            isCollapsed ? "opacity-0 scale-95" : "opacity-100 scale-100"
                        )} 
                    />
                    <PanelLeftOpen 
                        size={size} 
                        className={cn(
                            "absolute inset-0 transition-all duration-200",
                            isCollapsed ? "opacity-100 scale-100" : "opacity-0 scale-95"
                        )} 
                    />
                </div>
            </button>
        </Tooltip>
    );
}
