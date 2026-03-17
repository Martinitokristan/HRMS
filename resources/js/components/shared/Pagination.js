import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const PaginationBtn = ({ active, disabled, onClick, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-semibold transition-all duration-200',
            active
                ? 'border-[#FF6B35] bg-[#FF6B35] text-white shadow-sm'
                : 'border-border bg-white text-muted-foreground hover:bg-secondary hover:text-foreground',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
        )}
    >
        {children}
    </button>
);

export default function Pagination({ total, perPage = 15, page, onChange }) {
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return null;

    const renderButtons = () => {
        let buttons = [];
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, page + 2);
        if (page <= 3) endPage = Math.min(5, totalPages);
        if (page >= totalPages - 2) startPage = Math.max(1, totalPages - 4);

        if (startPage > 1) {
            buttons.push(<PaginationBtn key="1" onClick={() => onChange(1)}>1</PaginationBtn>);
            if (startPage > 2) buttons.push(
                <span key="e1" className="flex h-8 w-6 items-center justify-center text-muted-foreground text-sm">…</span>
            );
        }
        for (let i = startPage; i <= endPage; i++) {
            buttons.push(
                <PaginationBtn key={i} active={page === i} onClick={() => onChange(i)}>{i}</PaginationBtn>
            );
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) buttons.push(
                <span key="e2" className="flex h-8 w-6 items-center justify-center text-muted-foreground text-sm">…</span>
            );
            buttons.push(<PaginationBtn key={totalPages} onClick={() => onChange(totalPages)}>{totalPages}</PaginationBtn>);
        }
        return buttons;
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
            <p className="text-[13px] text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{((page - 1) * perPage) + 1}</span> to{' '}
                <span className="font-semibold text-foreground">{Math.min(page * perPage, total)}</span> of{' '}
                <span className="font-semibold text-foreground">{total}</span>
            </p>
            <div className="flex items-center gap-1">
                <PaginationBtn disabled={page === 1} onClick={() => onChange(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                </PaginationBtn>
                {renderButtons()}
                <PaginationBtn disabled={page === totalPages} onClick={() => onChange(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                </PaginationBtn>
            </div>
        </div>
    );
}
