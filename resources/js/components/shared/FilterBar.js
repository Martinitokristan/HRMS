import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FilterBar({ search, onSearchChange, filters = [], className, children }) {
    return (
        <div className={cn(
            'flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white px-5 py-3.5 shadow-sm mb-5',
            className
        )}>
            {search !== undefined && (
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className={cn(
                            'w-full rounded-lg border-[1.5px] border-[#94a3b8] bg-white pl-9 pr-3.5 py-2 text-sm',
                            'placeholder:text-muted-foreground',
                            'focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/25',
                            'transition-all duration-200'
                        )}
                    />
                </div>
            )}

            {filters.map((filter, index) => (
                <select
                    key={index}
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className={cn(
                        'rounded-lg border-[1.5px] border-[#94a3b8] bg-white px-3.5 py-2 text-sm cursor-pointer',
                        'focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/25',
                        'min-w-[150px] transition-all duration-200'
                    )}
                >
                    {filter.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ))}

            {children}
        </div>
    );
}
