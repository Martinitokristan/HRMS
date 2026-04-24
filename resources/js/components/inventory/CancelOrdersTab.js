import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import FilterBar from "../shared/FilterBar";
import Pagination from "../shared/Pagination";
import ConfirmModal from "../shared/ConfirmModal";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { STALE_KEYS, markStale } from "../../store/dataStore";
import { Badge } from "@/components/ui/badge";

export default function CancelOrdersTab() {
    const { showToast } = useToast();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_ORDERS);

    const formatQty = (qty) => {
        const n = typeof qty === "number" ? qty : parseFloat(qty);
        if (Number.isNaN(n)) return qty;
        return Number.isInteger(n) ? `${n}` : `${n}`;
    };

    const [requests, setRequests] = useState({
        data: [],
        total: 0,
        current_page: 1,
        last_page: 1,
    });
    const [loading, setLoading] = useState(requests.data.length === 0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

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

    const fetchRequests = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get("/sales/cancellations", {
                params: { page, search },
            });
            const paginated = res.data.data;
            setRequests({
                data: paginated.data || [],
                total: paginated.total || 0,
                current_page: paginated.current_page || 1,
                last_page: paginated.last_page || 1,
            });
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchRequests(requests.data.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, refreshTrigger]);

    const performAction = async (saleId, action) => {
        try {
            const res = await api.post(
                `/sales/${saleId}/cancellation/${action}`,
            );
            showToast(
                res.data.message || `Cancellation ${action}d successfully`,
            );
            markStale(
                STALE_KEYS.ADMIN_ORDERS,
                STALE_KEYS.ADMIN_INVENTORY,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.CUSTOMER_ORDERS,
            );
            fetchRequests(true);
            closeConfirm();
        } catch (err) {
            showToast(
                err.response?.data?.message ||
                    `Failed to ${action} cancellation`,
                "error",
            );
        }
    };

    const handleApprove = (sale) => {
        showConfirm(
            "Approve Cancellation",
            `Are you sure you want to approve the cancellation of order #${sale.order_number}? Stock will be restored to inventory.`,
            () => performAction(sale.id, "approve"),
            "destructive",
        );
    };

    const handleReject = (sale) => {
        showConfirm(
            "Reject Cancellation",
            `Are you sure you want to reject this cancellation request for order #${sale.order_number}? The order will remain active.`,
            () => performAction(sale.id, "reject"),
            "default",
        );
    };

    if (loading && requests.data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center">
                <div className="loader" />
            </div>
        );
    }

    return (
        <Card className="p-6">
            <FilterBar
                search={search}
                setSearch={setSearch}
                placeholder="Search cancellations..."
            />

            <div className="mt-4 mb-3 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                    Total {requests.total} cancellation request(s)
                </div>
                <Pagination
                    page={page}
                    total={requests.total}
                    perPage={15}
                    onChange={setPage}
                />
            </div>

            <div className="overflow-x-auto min-h-[400px]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.data.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="text-center py-6 text-muted-foreground min-h-[200px]"
                                >
                                    No pending cancellation requests found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.data.map((req) => (
                                <TableRow key={req.id}>
                                    <TableCell className="font-semibold">
                                        {req.order_number}
                                    </TableCell>
                                    <TableCell>
                                        {req.customer?.name || "Unknown"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {req.items
                                                ?.slice(0, 2)
                                                .map((item, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-sm truncate max-w-[200px]"
                                                        title={
                                                            item.product?.name
                                                        }
                                                    >
                                                        {formatQty(item.quantity)}pcs{" "}
                                                        {item.product?.name}
                                                    </span>
                                                ))}
                                            {req.items?.length > 2 && (
                                                <span className="text-xs text-muted-foreground">
                                                    +{req.items.length - 2}{" "}
                                                    more...
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className="capitalize"
                                        >
                                            {(
                                                req.cancellation_request?.reason || ""
                                            ).replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <p
                                            className="text-xs max-w-[200px] truncate"
                                            title={req.cancellation_request?.notes}
                                        >
                                            {req.cancellation_request?.notes || "-"}
                                        </p>
                                    </TableCell>
                                    <TableCell
                                        className="text-right font-semibold text-primary"
                                    >
                                        ₱
                                        {parseFloat(
                                            req.total_amount,
                                        ).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleApprove(req)
                                                }
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            >
                                                <Check className="h-4 w-4 mr-1" />
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleReject(req)
                                                }
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                Reject
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {confirmModal.show && (
                <ConfirmModal
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={closeConfirm}
                    variant={confirmModal.variant}
                />
            )}
        </Card>
    );
}
