import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import FilterBar from "../shared/FilterBar";
import Pagination from "../shared/Pagination";
import Modal from "../shared/Modal";
import { StatusBadge } from "../shared/Badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableFooter,
} from "@/components/ui/table";
import {
    AlertCircle,
    CheckCircle2,
    XCircle,
    Loader2,
    Package,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { STALE_KEYS, markStale } from "../../store/dataStore";
import ConfirmModal from "../shared/ConfirmModal";
import PoReceiptModal from "../shared/PoReceiptModal";

export default function PurchaseTab({ mode = "completed" }) {
    const { showToast } = useToast();
    const { settings } = useAuth();
    const isRequestMode = mode === "requests";
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_PURCHASES);

    const [pos, setPos] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(pos.data.length === 0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [viewPo, setViewPo] = useState(null);
    const [receiptPo, setReceiptPo] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: "",
        message: "",
        onConfirm: null,
        variant: "default",
    });
    const showConfirm = (title, message, onConfirm, variant = "default") => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({
            show: false,
            title: "",
            message: "",
            onConfirm: null,
            variant: "default",
        });
    };

    const fetchPos = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get("/purchase-orders", {
                params: {
                    page,
                    search,
                    status: statusFilter,
                    tab: mode,
                },
            });
            const paginatedData = res.data.data;
            setPos({
                data: paginatedData.data ? paginatedData.data : paginatedData,
                total: paginatedData.total || paginatedData.length || 0,
            });
        } catch (err) {
            // never wipe existing data on background error
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchPos(pos.data.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, statusFilter, refreshTrigger, mode]);

    const handleAction = async (poId, action) => {
        setActionLoading(true);
        try {
            await api.post(`/purchase-orders/${poId}/${action}`);
            showToast(`PO ${action}d successfully`);

            // Re-fetch quietly
            markStale(
                STALE_KEYS.ADMIN_PURCHASES,
                STALE_KEYS.ADMIN_INVENTORY,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.SUPPLIER_ORDERS,
            );
            fetchPos(true);

            setViewPo(null);
            closeConfirm();
        } catch (err) {
            showToast(
                err.response?.data?.message || `Failed to ${action} PO`,
                "error",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const confirmAction = (poId, action) => {
        const confirmMsg =
            action === "approve"
                ? "Approve and send this PO to the supplier?"
                : action === "decline"
                  ? "Are you sure you want to decline/cancel this PO?"
                  : "Mark as received? This will automatically increase your inventory stock for all items in this PO.";

        showConfirm(
            "Confirm Action",
            confirmMsg,
            () => handleAction(poId, action),
            action === "decline" ? "destructive" : "default",
        );
    };

    return (
        <div>
            <div className="mb-4">
                <FilterBar
                    search={search}
                    onSearchChange={(v) => {
                        setSearch(v);
                        setPage(1);
                    }}
                    filters={[
                        {
                            value: statusFilter,
                            onChange: (v) => {
                                setStatusFilter(v);
                                setPage(1);
                            },
                            options: isRequestMode
                                ? [
                                      {
                                          value: "",
                                          label: "All Active Requests",
                                      },
                                      {
                                          value: "pending",
                                          label: "Draft (Pending admin)",
                                      },
                                      {
                                          value: "pending_supplier",
                                          label: "Sent to Supplier",
                                      },
                                      { value: "accepted", label: "Accepted" },
                                  ]
                                : [
                                      { value: "", label: "All Finalized" },
                                      {
                                          value: "supplier_delivered",
                                          label: "Delivered (Awaiting Receipt)",
                                      },
                                      {
                                          value: "received",
                                          label: "Received (Completed)",
                                      },
                                      { value: "rejected", label: "Rejected" },
                                      { value: "cancelled", label: "Declined" },
                                  ],
                        },
                    ]}
                />
            </div>

            <div className="flex justify-end mb-3">
                <Pagination
                    page={page}
                    total={pos.total}
                    perPage={15}
                    onChange={setPage}
                />
            </div>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">
                                PO Number
                            </TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">
                                Date
                            </TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">
                                Supplier
                            </TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-right">
                                Total Cost
                            </TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">
                                Items
                            </TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">
                                Status
                            </TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="text-center py-10"
                                >
                                    <div className="spinner mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : pos.data.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="text-center py-10 text-muted-foreground"
                                >
                                    {isRequestMode
                                        ? "No active request orders found"
                                        : "No finalized purchase orders found"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            pos.data.map((po) => (
                                <TableRow key={po.id}>
                                    <TableCell className="px-4 py-3 font-semibold text-primary">
                                        {po.po_number}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-muted-foreground">
                                        {new Date(
                                            po.created_at,
                                        ).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="font-semibold text-foreground">
                                            {po.supplier?.name}
                                        </div>
                                        <div className="text-[12px] text-muted-foreground">
                                            {po.supplier?.email}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right font-mono text-foreground">
                                        {formatPHP(po.total_cost)}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 max-w-[220px] text-left align-middle">
                                        {Array.isArray(po.items) && po.items.length > 0 ? (
                                            <div className="text-sm">
                                                <div className="font-medium text-foreground truncate" title={po.items[0].product?.name || po.items[0].supplier_product?.name || ''}>
                                                    {po.items[0].product?.name || po.items[0].supplier_product?.name || 'Unknown'}
                                                </div>
                                                {po.items.length > 1 && (
                                                    <div className="text-xs text-muted-foreground">
                                                        +{po.items.length - 1} more item{po.items.length - 1 === 1 ? '' : 's'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <StatusBadge status={po.status} />
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        {po.status === "received" ? (
                                            <Button
                                                size="sm"
                                                className="bg-primary hover:bg-primary/90 text-white"
                                                onClick={() => setReceiptPo(po)}
                                            >
                                                View Receipt
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setViewPo(po)}
                                            >
                                                Review
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Modal
                isOpen={!!viewPo}
                onClose={() => setViewPo(null)}
                title={`Purchase Order - ${viewPo?.po_number}`}
                size="xl"
            >
                {viewPo && (
                    <div className="space-y-5">
                        {/* Header info */}
                        <Card className="bg-secondary/50 p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                                        <Package className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Logistics Partner
                                        </div>
                                        <div className="font-bold text-lg text-foreground tracking-tight">
                                            {viewPo.supplier?.name}
                                        </div>
                                        <div className="text-sm font-semibold text-primary">
                                            {viewPo.supplier?.email}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                        Status
                                    </div>
                                    <StatusBadge status={viewPo.status} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                        Authorizing Agent
                                    </div>
                                    <div className="font-bold text-foreground">
                                        {viewPo.creator?.name || "System"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                        Creation Date
                                    </div>
                                    <div className="font-semibold text-foreground">
                                        {new Date(
                                            viewPo.created_at,
                                        ).toLocaleString([], {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}
                                    </div>
                                </div>
                                {viewPo.expected_date && (
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                            Target Fulfillment
                                        </div>
                                        <div className="font-bold text-primary">
                                            {new Date(
                                                viewPo.expected_date,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Items table */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-foreground">
                                    Itemized Purchase Inventory
                                </h3>
                                <Badge
                                    variant="secondary"
                                    className="uppercase"
                                >
                                    {viewPo.items?.length || 0} Lines
                                </Badge>
                            </div>
                            <Card className="overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">
                                                Product / Barcode
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center">
                                                Qty
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-right">
                                                Unit Rate
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-right">
                                                Total Amount
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewPo.items?.map((i) => {
                                            const productName =
                                                i.product?.name ||
                                                i.supplier_product?.name ||
                                                "Loading Name...";
                                            const barcode =
                                                i.product?.barcode ||
                                                i.supplier_product?.barcode ||
                                                "N/A";
                                            return (
                                                <TableRow key={i.id}>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="font-bold text-foreground mb-0.5">
                                                            {productName}
                                                        </div>
                                                        <Badge
                                                            variant="outline"
                                                            className="font-mono text-[11px]"
                                                        >
                                                            Barcode: {barcode}
                                                        </Badge>
                                                        {i.product_variant ? (
                                                            <div className="text-[11px] text-primary font-bold mt-1">
                                                                {[
                                                                    i
                                                                        .product_variant
                                                                        .size_value
                                                                        ?.label,
                                                                    i
                                                                        .product_variant
                                                                        .color_value
                                                                        ?.label,
                                                                    i
                                                                        .product_variant
                                                                        .weight_value
                                                                        ?.label,
                                                                ]
                                                                    .filter(
                                                                        Boolean,
                                                                    )
                                                                    .join(
                                                                        " / ",
                                                                    )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                                Base product
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-center font-bold text-lg text-foreground">
                                                        {parseInt(i.quantity)}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground font-semibold">
                                                        {formatPHP(i.unit_cost)}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right font-mono text-foreground">
                                                        {formatPHP(i.subtotal)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell
                                                colSpan={3}
                                                className="px-4 py-4 text-right font-bold text-muted-foreground"
                                            >
                                                Purchase Order Value:
                                            </TableCell>
                                            <TableCell className="px-4 py-4 text-right font-mono font-bold text-xl text-foreground">
                                                {formatPHP(viewPo.total_cost)}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </Card>
                        </div>

                        {/* Rejection reason */}
                        {viewPo.status === "rejected" &&
                            viewPo.rejection_reason && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1">
                                            Supplier Rejection Reason
                                        </div>
                                        <div className="text-sm">
                                            {viewPo.rejection_reason}
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                                System Integrity Verified
                            </span>
                            <div className="flex gap-2">
                                {viewPo.status === "pending" && (
                                    <>
                                        <Button
                                            disabled={actionLoading}
                                            onClick={() =>
                                                confirmAction(
                                                    viewPo.id,
                                                    "approve",
                                                )
                                            }
                                            className="shadow-md shadow-primary/20"
                                        >
                                            Authorize PO
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="border-destructive/30 text-destructive hover:bg-destructive/5"
                                            disabled={actionLoading}
                                            onClick={() =>
                                                confirmAction(
                                                    viewPo.id,
                                                    "decline",
                                                )
                                            }
                                        >
                                            Decline Request
                                        </Button>
                                    </>
                                )}

                                {viewPo.status === "supplier_delivered" && (
                                    <Button
                                        disabled={actionLoading}
                                        onClick={() =>
                                            confirmAction(viewPo.id, "receive")
                                        }
                                        className="shadow-md shadow-primary/20"
                                    >
                                        Confirm & Add to Stock
                                    </Button>
                                )}

                                {["pending_supplier", "accepted"].includes(
                                    viewPo.status,
                                ) && (
                                    <Badge
                                        variant="outline"
                                        className="gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                                    >
                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                        Awaiting Fulfillment
                                    </Badge>
                                )}

                                {viewPo.status === "received" && (
                                    <Badge
                                        variant="outline"
                                        className="gap-2 px-4 py-2.5 text-[11px] font-bold uppercase border-success/30 bg-success-light text-success-foreground"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Inventory Synchronized
                                    </Badge>
                                )}

                                {viewPo.status === "cancelled" && (
                                    <Badge
                                        variant="outline"
                                        className="gap-2 px-4 py-2.5 text-[11px] font-bold uppercase border-destructive/30 bg-destructive/5 text-destructive"
                                    >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Request Voided
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />

            {receiptPo && (
                <PoReceiptModal
                    po={receiptPo}
                    settings={settings}
                    onClose={() => setReceiptPo(null)}
                />
            )}
        </div>
    );
}
