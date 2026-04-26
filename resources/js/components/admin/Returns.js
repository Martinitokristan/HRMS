import React, { useState, useEffect, useCallback } from "react";
import api from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { STALE_KEYS, markStale } from "../../store/dataStore";
import { GCashIcon, CODIcon } from "@/components/icons/PaymentIcons";
import { formatPHP } from "@/lib/utils";
import {
    RotateCcw,
    Search,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
    Package,
    ImageIcon,
    ChevronLeft,
    AlertTriangle,
    DollarSign,
    User,
    FileText,
    ArrowRight,
    Copy,
    ExternalLink,
} from "lucide-react";

const STATUS_CONFIG = {
    pending: {
        label: "Pending",
        color: "bg-amber-100 text-amber-800 border-amber-200",
    },
    approved: {
        label: "Approved",
        color: "bg-blue-100 text-blue-800 border-blue-200",
    },
    rejected: {
        label: "Rejected",
        color: "bg-red-100 text-red-800 border-red-200",
    },
    completed: {
        label: "Completed",
        color: "bg-green-100 text-green-800 border-green-200",
    },
};

const REASON_LABELS = {
    defective: "Defective Product",
    wrong_item: "Wrong Item Received",
    damaged: "Damaged in Transit",
    not_as_described: "Not as Described",
    missing_parts: "Missing Parts",
    other: "Other",
};

export default function Returns() {
    const { showToast } = useToast();
    const [returns, setReturns] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [adminNotes, setAdminNotes] = useState("");
    const [refundMethod, setRefundMethod] = useState("original_payment");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});

    // Background Sync
    const returnsRefresh = useSilentRefresh(STALE_KEYS.ADMIN_RETURNS);

    const fetchReturns = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/returns", {
                params: {
                    search: search || undefined,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    page,
                },
            });
            setReturns(res.data.data?.data || res.data.data || []);
            setPagination(
                res.data.data !== undefined ? res.data.data : res.data,
            );
            setStats(res.data.stats || {});
        } catch (err) {
            showToast("Failed to load returns", "error");
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, page]);

    useEffect(() => {
        fetchReturns();
    }, [fetchReturns, returnsRefresh.refreshTrigger]);

    const handleApprove = async (id) => {
        if (!refundMethod) {
            showToast("Please select a refund method", "error");
            return;
        }
        setActionLoading(true);
        try {
            const res = await api.post(`/returns/${id}/approve`, {
                refund_method: refundMethod,
                admin_notes: adminNotes || null,
            });
            showToast(res.data.message || "Return approved");
            setSelectedReturn(res.data.data);

            // Notify Admin and Customer — inventory NOT changed yet (stock moves on Complete)
            markStale(
                STALE_KEYS.ADMIN_RETURNS,
                STALE_KEYS.CUSTOMER_RETURNS,
            );
        } catch (err) {
            showToast(
                err.response?.data?.message || "Failed to approve",
                "error",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (id) => {
        if (!adminNotes.trim()) {
            showToast("Please provide a reason for rejection", "error");
            return;
        }
        setActionLoading(true);
        try {
            const res = await api.post(`/returns/${id}/reject`, {
                admin_notes: adminNotes,
            });
            showToast(res.data.message || "Return rejected");
            setSelectedReturn(res.data.data);
            markStale(STALE_KEYS.ADMIN_RETURNS, STALE_KEYS.CUSTOMER_RETURNS);
        } catch (err) {
            showToast(
                err.response?.data?.message || "Failed to reject",
                "error",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleComplete = async (id) => {
        setActionLoading(true);
        try {
            const res = await api.post(`/returns/${id}/complete`);
            showToast(res.data.message || "Refund processed");
            setSelectedReturn(res.data.data);
            // Stock is now restored — mark inventory and dashboard as stale
            markStale(
                STALE_KEYS.ADMIN_RETURNS,
                STALE_KEYS.CUSTOMER_RETURNS,
                STALE_KEYS.ADMIN_INVENTORY,
                STALE_KEYS.ADMIN_DASHBOARD,
            );
        } catch (err) {
            showToast(
                err.response?.data?.message || "Failed to complete",
                "error",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const openDetail = async (id) => {
        try {
            const res = await api.get(`/returns/${id}`);
            setSelectedReturn(res.data.data);
            setAdminNotes(res.data.data.admin_notes || "");
            setRefundMethod(res.data.data.refund_method || "original_payment");
        } catch (err) {
            showToast("Failed to load return details", "error");
        }
    };

    // Detail View
    if (selectedReturn) {
        const r = selectedReturn;
        const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReturn(null)}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <h2 className="text-xl font-bold">
                        Return #{r.return_number}
                    </h2>
                    <Badge className={sc.color}>{sc.label}</Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Return
                                    Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">
                                            Order
                                        </span>
                                        <p className="font-bold">
                                            {r.sale?.order_number}
                                        </p>
                                        {Array.isArray(r.sale?.items) && r.sale.items.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {r.sale.items[0].product?.name || 'Item'}
                                                {r.sale.items.length > 1 && ` +${r.sale.items.length - 1} more`}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Customer
                                        </span>
                                        <p className="font-bold">
                                            {r.requested_by_user?.name ||
                                                r.sale?.customer?.name ||
                                                "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Reason
                                        </span>
                                        <p className="font-bold">
                                            {REASON_LABELS[r.reason] ||
                                                r.reason}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Refund Amount
                                        </span>
                                        <p className="font-mono font-bold text-foreground">
                                            {formatPHP(r.refund_amount)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Requested
                                        </span>
                                        <p className="font-bold">
                                            {new Date(
                                                r.created_at,
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            Refund Method
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {r.refund_method === "original_payment" && r.sale?.payment_method === "gcash" ? (
                                                <GCashIcon size={16} />
                                            ) : r.refund_method === "original_payment" && r.sale?.payment_method === "cod" ? (
                                                <CODIcon size={16} />
                                            ) : r.refund_method === "cash" ? (
                                                <CODIcon size={16} />
                                            ) : null}
                                            <p className="font-bold capitalize">
                                                {(r.refund_method || "—").replace(
                                                    "_",
                                                    " ",
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {r.reason_details && (
                                    <div className="bg-secondary/50 rounded-lg p-3">
                                        <span className="text-xs font-bold text-muted-foreground uppercase">
                                            Customer Notes
                                        </span>
                                        <p className="text-sm mt-1">
                                            {r.reason_details}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Return Items */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-4 w-4" /> Items to
                                    Return
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {(r.items || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">No items recorded for this return.</p>
                                    ) : (
                                        (r.items || []).map((item, idx) => {
                                            const productName = item.sale_item?.product?.name || 'Unknown product';
                                            const variant     = item.sale_item?.product_variant;
                                            const variantText = variant ? [variant.color, variant.size, variant.storage, variant.variant_name].filter(Boolean).join(' / ') : '';
                                            const unitPrice   = Number(item.sale_item?.unit_price || 0);
                                            const qty         = Number(item.quantity_returned || 0);
                                            const lineTotal   = unitPrice * qty;
                                            return (
                                                <div key={item.id || idx} className="flex justify-between items-start p-3 bg-secondary/30 rounded-lg">
                                                    <div>
                                                        <p className="font-bold text-sm">
                                                            {productName}
                                                            {variantText && (
                                                                <span className="text-muted-foreground ml-1 text-xs">({variantText})</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Qty: {qty} × {formatPHP(unitPrice)}
                                                        </p>
                                                        {item.condition && (
                                                            <p className="text-xs text-muted-foreground">
                                                                Condition: {item.condition}
                                                            </p>
                                                        )}
                                                        {item.item_reason && (
                                                            <p className="text-xs text-muted-foreground italic">
                                                                "{item.item_reason}"
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="font-mono font-bold text-sm whitespace-nowrap text-foreground">
                                                        {formatPHP(lineTotal)}
                                                    </p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Proof Images */}
                        {r.images && r.images.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" /> Proof
                                        Images
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-3">
                                        {r.images.map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={`/storage/${img}`}
                                                alt={`Proof ${idx + 1}`}
                                                className="rounded-lg border object-cover aspect-square w-full cursor-pointer hover:opacity-80 transition"
                                                onClick={() =>
                                                    window.open(
                                                        `/storage/${img}`,
                                                        "_blank",
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Action Panel */}
                    <div className="space-y-4">
                        {r.status === "pending" && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">
                                        Actions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <label className="text-sm font-bold mb-1.5 block">
                                            Refund Method
                                        </label>
                                        <select
                                            value={refundMethod}
                                            onChange={(e) =>
                                                setRefundMethod(e.target.value)
                                            }
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="original_payment">
                                                Original Payment
                                            </option>
                                            <option value="store_credit">
                                                Store Credit
                                            </option>
                                            <option value="cash">Cash</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold mb-1.5 block">
                                            Admin Notes
                                        </label>
                                        <Textarea
                                            value={adminNotes}
                                            onChange={(e) =>
                                                setAdminNotes(e.target.value)
                                            }
                                            placeholder="Add notes (required for rejection)..."
                                            rows={3}
                                            className="resize-none"
                                        />
                                    </div>
                                    <Separator />
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            className="w-full"
                                            onClick={() => handleApprove(r.id)}
                                            disabled={actionLoading}
                                        >
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            {actionLoading
                                                ? "Processing..."
                                                : "Approve Return"}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            onClick={() => handleReject(r.id)}
                                            disabled={
                                                actionLoading ||
                                                !adminNotes.trim()
                                            }
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            {actionLoading
                                                ? "Processing..."
                                                : "Reject Return"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {r.status === "approved" && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">
                                        Process Refund
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-sm text-blue-800 font-medium">
                                            Return approved. Stock will be
                                            restored once you click &ldquo;Mark
                                            Refund Complete&rdquo; below.
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-mono font-bold text-foreground">
                                            {formatPHP(r.refund_amount)}
                                        </p>
                                        <p className="text-xs text-muted-foreground capitalize">
                                            via{" "}
                                            {(r.refund_method || "").replace(
                                                "_",
                                                " ",
                                            )}
                                        </p>
                                    </div>

                                    {r.refund_method === "original_payment" &&
                                        r.sale?.payment_method === "gcash" &&
                                        r.sale?.payment_phone_number && (
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                                                <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
                                                    <GCashIcon size={16} />
                                                    GCash Refund Details
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-xs text-green-700 font-medium">
                                                            Customer Name
                                                        </p>
                                                        <p className="text-sm font-bold text-green-900">
                                                            {r.sale?.customer
                                                                ?.name || "—"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-green-700 font-medium">
                                                            GCash Number
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-green-900 font-mono">
                                                                {
                                                                    r.sale
                                                                        .payment_phone_number
                                                                }
                                                            </p>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(
                                                                        r.sale
                                                                            .payment_phone_number,
                                                                    );
                                                                    showToast(
                                                                        "Number copied to clipboard",
                                                                        "success",
                                                                    );
                                                                }}
                                                                className="text-green-600 hover:text-green-800 transition-colors p-1 rounded"
                                                                title="Copy number"
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/Android|iPhone|iPad|iPod|Mobile/i.test(
                                                    navigator.userAgent,
                                                ) ? (
                                                    <button
                                                        onClick={() => {
                                                            if (
                                                                /Android/i.test(
                                                                    navigator.userAgent,
                                                                )
                                                            ) {
                                                                window.location.href =
                                                                    "intent://#Intent;scheme=gcash;package=com.globe.gcash.android;end";
                                                            } else {
                                                                window.location.href =
                                                                    "gcash://";
                                                            }
                                                        }}
                                                        className="flex items-center justify-center gap-2 w-full bg-[#007DFE] hover:bg-[#0066CC] text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors"
                                                    >
                                                        <GCashIcon size={16} />
                                                        Open GCash App
                                                    </button>
                                                ) : (
                                                    <p className="text-xs text-green-700 bg-green-100 rounded-lg p-2 text-center">
                                                        Open your GCash app →
                                                        Send Money → type the
                                                        number above
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                    <Button
                                        className="w-full"
                                        onClick={() => handleComplete(r.id)}
                                        disabled={actionLoading}
                                    >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        {actionLoading
                                            ? "Processing..."
                                            : "Mark Refund Complete"}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {r.status === "completed" && (
                            <Card className="border-green-200">
                                <CardContent className="pt-6 text-center space-y-2">
                                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                                    <p className="font-bold text-green-700">
                                        Refund Completed
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatPHP(r.refund_amount)}{" "}
                                        refunded on{" "}
                                        {new Date(
                                            r.completed_at,
                                        ).toLocaleDateString()}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {r.status === "rejected" && (
                            <Card className="border-red-200">
                                <CardContent className="pt-6 text-center space-y-2">
                                    <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                                    <p className="font-bold text-red-700">
                                        Return Rejected
                                    </p>
                                    {r.admin_notes && (
                                        <p className="text-sm text-muted-foreground">
                                            "{r.admin_notes}"
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Timeline */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    Timeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <TimelineItem
                                        label="Requested"
                                        date={r.created_at}
                                        active
                                    />
                                    {r.approved_at && (
                                        <TimelineItem
                                            label="Approved"
                                            date={r.approved_at}
                                            active
                                        />
                                    )}
                                    {r.rejected_at && (
                                        <TimelineItem
                                            label="Rejected"
                                            date={r.rejected_at}
                                            active
                                            isError
                                        />
                                    )}
                                    {r.completed_at && (
                                        <TimelineItem
                                            label="Refund Processed"
                                            date={r.completed_at}
                                            active
                                        />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    // List View
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <RotateCcw className="h-6 w-6" /> Returns Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage customer return requests and process refunds
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    {
                        label: "Total",
                        value: stats.total || 0,
                        icon: RotateCcw,
                        color: "text-foreground",
                    },
                    {
                        label: "Pending",
                        value: stats.pending || 0,
                        icon: Clock,
                        color: "text-amber-600",
                    },
                    {
                        label: "Approved",
                        value: stats.approved || 0,
                        icon: CheckCircle2,
                        color: "text-blue-600",
                    },
                    {
                        label: "Rejected",
                        value: stats.rejected || 0,
                        icon: XCircle,
                        color: "text-red-600",
                    },
                    {
                        label: "Completed",
                        value: stats.completed || 0,
                        icon: DollarSign,
                        color: "text-green-600",
                    },
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="p-4">
                        <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${color}`} />
                            <div>
                                <p className="text-2xl font-black">{value}</p>
                                <p className="text-xs text-muted-foreground">
                                    {label}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search return number, order number, customer..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="pl-9"
                        />
                    </div>
                    <Tabs
                        value={statusFilter}
                        onValueChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                    >
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="approved">Approved</TabsTrigger>
                            <TabsTrigger value="rejected">Rejected</TabsTrigger>
                            <TabsTrigger value="completed">
                                Completed
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </Card>

            {/* Returns List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            ) : returns.length === 0 ? (
                <Card className="p-12 text-center">
                    <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="font-bold text-lg mb-1">No returns found</p>
                    <p className="text-muted-foreground text-sm">
                        Return requests from customers will appear here.
                    </p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {returns.length > 0 && (
                        <div className="flex justify-end gap-2 pb-1">
                            <span className="hidden md:flex items-center px-3 text-sm text-muted-foreground mr-auto">
                                Page {page} of {pagination.last_page || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= (pagination.last_page || 1)}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}

                    {returns.map((r) => {
                        const sc =
                            STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                        return (
                            <Card
                                key={r.id}
                                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => openDetail(r.id)}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                            <RotateCcw className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm">
                                                    {r.return_number}
                                                </span>
                                                <Badge
                                                    className={
                                                        sc.color + " text-xs"
                                                    }
                                                >
                                                    {sc.label}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                Order {r.sale?.order_number}{" "}
                                                &middot;{" "}
                                                {r.sale?.customer?.name ||
                                                    "Customer"}{" "}
                                                &middot;{" "}
                                                {REASON_LABELS[r.reason] ||
                                                    r.reason}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {r.refund_method === "original_payment" && r.sale?.payment_method === "gcash" && <GCashIcon size={14} />}
                                            {r.refund_method === "original_payment" && r.sale?.payment_method === "cod" && <CODIcon size={14} />}
                                            {r.refund_method === "cash" && <CODIcon size={14} />}
                                            <p className="font-mono font-bold text-sm text-foreground">
                                                {formatPHP(r.refund_amount)}
                                            </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(
                                                r.created_at,
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function TimelineItem({ label, date, active, isError }) {
    return (
        <div className="flex items-center gap-3">
            <div
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${active ? (isError ? "bg-red-500" : "bg-primary") : "bg-border"}`}
            />
            <div className="flex-1">
                <p
                    className={`text-sm font-medium ${isError ? "text-red-600" : ""}`}
                >
                    {label}
                </p>
                {date && (
                    <p className="text-xs text-muted-foreground">
                        {new Date(date).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
}
