import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

const PaginationBtn = ({ active, disabled, onClick, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-semibold transition-all duration-200",
            active
                ? "border-[#FF6B35] bg-[#FF6B35] text-white shadow-sm"
                : "border-border bg-white text-muted-foreground hover:bg-secondary hover:text-foreground",
            disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        )}
    >
        {children}
    </button>
);

export default function Pagination({ total, perPage = 15, page, onChange }) {
    const safeTotal = Number.isFinite(Number(total))
        ? Math.max(0, Number(total))
        : 0;
    const safePerPage = Number.isFinite(Number(perPage))
        ? Math.max(1, Number(perPage))
        : 15;
    const totalPages = Math.max(1, Math.ceil(safeTotal / safePerPage));
    const safePage = Number.isFinite(Number(page))
        ? Math.min(Math.max(1, Number(page)), totalPages)
        : 1;
    const currentPageCount =
        safeTotal === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(
                      safePerPage,
                      safeTotal - (safePage - 1) * safePerPage,
                  ),
              );

    if (safeTotal === 0 || totalPages <= 1) return null;

    const renderButtons = () => {
        let buttons = [];
        let startPage = Math.max(1, safePage - 2);
        let endPage = Math.min(totalPages, safePage + 2);
        if (safePage <= 3) endPage = Math.min(5, totalPages);
        if (safePage >= totalPages - 2) startPage = Math.max(1, totalPages - 4);

        if (startPage > 1) {
            buttons.push(
                <PaginationBtn key="1" onClick={() => onChange(1)}>
                    1
                </PaginationBtn>,
            );
            if (startPage > 2)
                buttons.push(
                    <span
                        key="e1"
                        className="flex h-8 w-6 items-center justify-center text-muted-foreground text-sm"
                    >
                        …
                    </span>,
                );
        }
        for (let i = startPage; i <= endPage; i++) {
            buttons.push(
                <PaginationBtn
                    key={i}
                    active={safePage === i}
                    onClick={() => onChange(i)}
                >
                    {i}
                </PaginationBtn>,
            );
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1)
                buttons.push(
                    <span
                        key="e2"
                        className="flex h-8 w-6 items-center justify-center text-muted-foreground text-sm"
                    >
                        …
                    </span>,
                );
            buttons.push(
                <PaginationBtn
                    key={totalPages}
                    onClick={() => onChange(totalPages)}
                >
                    {totalPages}
                </PaginationBtn>,
            );
        }
        return buttons;
    };

    return (
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                    {currentPageCount}
                </span>{" "}
                out of{" "}
                <span className="font-semibold text-foreground">
                    {safeTotal}
                </span>{" "}
            </p>
            <div className="flex items-center gap-1">
                <span className="mr-1 whitespace-nowrap rounded-md border border-border bg-white px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                    Page <span className="text-foreground">{safePage}</span> of{" "}
                    <span className="text-foreground">{totalPages}</span>
                </span>
                <button
                    disabled={safePage === 1}
                    onClick={() => onChange(safePage - 1)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[12px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Prev</span>
                </button>
                {renderButtons()}
                <button
                    disabled={safePage === totalPages}
                    onClick={() => onChange(safePage + 1)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[12px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
