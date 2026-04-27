import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import Modal from "../shared/Modal";
import { StatusBadge } from "../shared/Badge";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GCashIcon, CODIcon } from "@/components/icons/PaymentIcons";
import { formatPHP } from "@/lib/utils";

export default function DeliveryViewModal({ isOpen, onClose, deliveryId }) {
    const { showToast } = useToast();
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !deliveryId) return;

        let isMounted = true;
        setLoading(true);
        api.get(`/deliveries/${deliveryId}`)
            .then((res) => {
                if (isMounted) {
                    setDelivery(res.data.data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    showToast("Failed to load delivery details", "error");
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, deliveryId]);

    if (!isOpen) return null;

    const formatCurrency = formatPHP;
    const formatTime = (date) => (date ? new Date(date).toLocaleString() : "-");

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Delivery ${delivery?.tracking_number || ""}`}
            size="md"
        >
            {loading ? (
                <div className="py-4 text-center">
                    <div className="spinner" />
                </div>
            ) : delivery ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg p-4 bg-muted/30 border border-border">
                        <div className="space-y-3">
                            <div>
                                <div className="text-xs font-bold text-muted-foreground uppercase mb-1">
                                    Customer Info
                                </div>
                                <h3 className="font-bold text-lg text-primary">
                                    {delivery.sale?.customer?.name ||
                                        "Walk-in Customer"}
                                </h3>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                                    Contact Phone
                                </label>
                                <div className="font-medium text-sm text-foreground">
                                    {delivery.sale?.customer?.phone || "N/A"}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                                    Delivery Address
                                </label>
                                <div className="text-sm font-medium italic text-muted-foreground">
                                    {delivery.address || "No address provided"}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-muted-foreground uppercase mb-1">
                                Delivery Status
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Status:
                                </span>
                                <StatusBadge status={delivery.status} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Assigned Rider:
                                </span>
                                <span className="font-bold text-primary text-sm">
                                    {delivery.rider
                                        ? delivery.rider.name
                                        : "Unassigned"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Order Reference:
                                </span>
                                <span className="font-bold text-sm text-foreground">
                                    #{delivery.sale?.order_number}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                <span className="text-sm font-bold text-muted-foreground">
                                    Amount Due:
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-primary">
                                        {formatCurrency(
                                            delivery.sale?.total_amount,
                                        )}
                                    </span>
                                    {delivery.sale?.payment_method === "cod" && (
                                        <Badge
                                            variant="outline"
                                            className="bg-green-50 text-green-800 border-green-200 hover:bg-green-100 gap-1"
                                        >
                                            <CODIcon size={12} />
                                            COD
                                        </Badge>
                                    )}
                                    {delivery.sale?.payment_method === "gcash" && (
                                        <Badge
                                            variant="outline"
                                            className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 gap-1"
                                        >
                                            <GCashIcon size={12} />
                                            GCash
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-1">
                            Order Items
                        </h4>
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-center">
                                            Qty
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Subtotal
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!delivery.sale?.items ||
                                    delivery.sale.items.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={3}
                                                className="text-center text-muted-foreground py-4"
                                            >
                                                No items found in this order.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        delivery.sale.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    {item.product?.name ||
                                                        "Unknown Product"}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {parseInt(item.quantity)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(
                                                        item.subtotal,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-1">
                            Delivery Timeline
                        </h4>
                        <div className="bg-muted/30 p-4 rounded-lg border border-border">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                                        Ordered At
                                    </label>
                                    <div className="font-bold text-sm text-foreground">
                                        {formatTime(delivery.created_at)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                                        Picked Up At
                                    </label>
                                    <div className="font-bold text-sm text-blue-600">
                                        {delivery.pickup_at
                                            ? formatTime(delivery.pickup_at)
                                            : delivery.status !== "pending"
                                              ? "Processing..."
                                              : "Awaiting Pickup"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                                        Delivered At
                                    </label>
                                    <div className="font-bold text-sm text-green-600">
                                        {formatTime(delivery.delivered_at)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-muted-foreground">
                    Failed to load delivery details.
                </div>
            )}
        </Modal>
    );
}
