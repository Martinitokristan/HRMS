import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils";
import {
    CheckCircle,
    XCircle,
    Search,
    RefreshCw,
    AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { GCashIcon } from "@/components/icons/PaymentIcons";

export default function GCashLogs() {
    const { refreshTrigger } = useSilentRefresh("admin_orders");
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filter, setFilter] = useState("all"); // 'all', 'matched', 'unmatched'

    // Clean doubled SMS body and highlight amount
    const cleanSmsBody = (text) => {
        if (!text) return text;
        let cleaned = text;
        const idx = cleaned.indexOf("You have received PHP");
        if (idx > 0) {
            cleaned = cleaned.substring(idx);
        }

        // Highlight the amount (e.g. PHP 1.46)
        const parts = cleaned.split(/(PHP\s*[0-9,]+\.[0-9]{2})/i);
        return parts.map((part, index) => {
            if (part.toUpperCase().startsWith("PHP")) {
                return (
                    <span key={index} className="font-bold underline">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const url = new URL(
                "/api/admin/gcash-logs",
                window.location.origin,
            ); // Assuming we can use full path or just let interceptor handle it
            // the route we added is /api/gcash-logs
            let queryPath = `/gcash-logs?page=${page}`;
            if (filter === "matched") queryPath += "&matched=true";
            if (filter === "unmatched") queryPath += "&matched=false";

            const res = await api.get(queryPath);
            const data =
                res.data?.data !== undefined ? res.data.data : res.data;
            setLogs(Array.isArray(data) ? data : []);
            setTotalPages(res.data?.last_page || 1);
        } catch (err) {
            console.error("Failed to fetch GCash logs", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, filter, refreshTrigger]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <GCashIcon size={24} />
                        GCash Payments Log
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Monitor incoming GCash SMS webhooks and algorithm
                        matching status.
                    </p>
                </div>

                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                    <button
                        onClick={() => {
                            setFilter("all");
                            setPage(1);
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === "all" ? "bg-[#007DFE] text-white" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        All Logs
                    </button>
                    <button
                        onClick={() => {
                            setFilter("matched");
                            setPage(1);
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === "matched" ? "bg-[#10B981] text-white" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        Matched
                    </button>
                    <button
                        onClick={() => {
                            setFilter("unmatched");
                            setPage(1);
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === "unmatched" ? "bg-[#EF4444] text-white" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        Unmatched
                    </button>
                    <button
                        onClick={() => fetchLogs()}
                        className="px-3 py-1.5 ml-2 text-slate-400 hover:text-slate-600"
                        title="Refresh"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${loading ? "animate-spin text-[#007DFE]" : ""}`}
                        />
                    </button>
                </div>
            </div>

            <Card className="min-w-full inline-block align-middle">
                {Array.isArray(logs) && logs.length > 0 && (
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-end gap-2">
                        <p className="text-sm text-slate-600 mr-auto hidden md:block">
                            Showing page{" "}
                            <span className="font-medium">{page}</span> of{" "}
                            <span className="font-medium">{totalPages}</span>
                        </p>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                                >
                                    Date & Time
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    GCash Notification Message
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    Parsed Amount
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    Algorithm Match
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    Order Ref
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading &&
                            (!Array.isArray(logs) || logs.length === 0) ? (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className="px-6 py-12 text-center text-slate-500"
                                    >
                                        <div className="flex justify-center mb-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#007DFE]"></div>
                                        </div>
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : !Array.isArray(logs) || logs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className="px-6 py-12 text-center text-slate-500 bg-slate-50/50"
                                    >
                                        <div className="flex flex-col items-center">
                                            <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                                            <p>
                                                No GCash transaction logs found.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-slate-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {format(
                                                new Date(log.created_at),
                                                "MMM d, yyyy h:mm a",
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-700 min-w-[300px]">
                                            <div className="bg-slate-100 p-2 rounded text-xs break-words break-all border border-slate-200 max-w-sm">
                                                {log.sms_body ? (
                                                    cleanSmsBody(log.sms_body)
                                                ) : (
                                                    <span className="text-slate-400 italic">
                                                        No message
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {log.parsed_amount ? (
                                                <span className="font-mono text-foreground">
                                                    {formatPHP(log.parsed_amount)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">
                                                    Unparsed
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {log.matched ? (
                                                <Badge className="bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 font-medium whitespace-nowrap">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Matched
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 font-medium whitespace-nowrap">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Unmatched
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {log.sale ? (
                                                <a
                                                    href={`/dashboard?order=${log.sale.order_number}`}
                                                    className="text-[#007DFE] hover:underline"
                                                >
                                                    #{log.sale.order_number}
                                                </a>
                                            ) : (
                                                <span className="text-slate-400">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
