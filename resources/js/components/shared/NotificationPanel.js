import React, { useState } from 'react';
import axios from 'axios';
import { Bell, Trash2, CheckCheck, X, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Shared NotificationPanel for all roles (admin, supplier, customer, rider)
 * 
 * Props:
 * - notifications: array of notification objects
 * - setNotifications: setter
 * - unreadCount: number
 * - setUnreadCount: setter
 * - isOpen: boolean
 * - onClose: function
 * - apiPrefix: string — e.g. '/notifications', '/customer/notifications', '/riders/me/notifications'
 * - renderMessage: function(notification) => string — extract message text
 * - renderLabel: function(notification) => string — extract label text  
 * - isRead: function(notification) => boolean — check if read
 * - onNotificationClick: function(notification) — optional, fires on click
 * - onRefresh: function — refetch notifications
 */
export default function NotificationPanel({
    notifications = [],
    setNotifications,
    unreadCount = 0,
    setUnreadCount,
    isOpen,
    onClose,
    apiPrefix = '/notifications',
    renderMessage = (n) => n.data?.message || n.message || 'New notification',
    renderLabel = (n) => n.data?.supplier_name || n.data?.title || 'HRMS',
    isRead = (n) => n.read_at || n.is_read,
    onNotificationClick,
    onRefresh,
    markReadUrl,
}) {
    const [deleteMode, setDeleteMode] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [deleting, setDeleting] = useState(false);

    if (!isOpen) return null;

    const timeAgo = (date) => {
        if (!date) return 'Just now';
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === notifications.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(notifications.map(n => n.id)));
        }
    };

    const markAllRead = async () => {
        try {
            const readUrl = markReadUrl || `${apiPrefix}/read`;
            await axios.post(readUrl);
            if (onRefresh) onRefresh();
            setUnreadCount(0);
        } catch (e) {
            setUnreadCount(0);
        }
    };

    const handleDeleteSelected = async () => {
        if (selected.size === 0) return;
        setDeleting(true);
        try {
            await axios.post(`${apiPrefix}/delete-batch`, { ids: Array.from(selected) });
            setNotifications(prev => prev.filter(n => !selected.has(n.id)));
            setSelected(new Set());
            setDeleteMode(false);
            if (onRefresh) onRefresh();
        } catch (e) { }
        setDeleting(false);
    };

    const handleDeleteAll = async () => {
        setDeleting(true);
        try {
            await axios.post(`${apiPrefix}/delete-all`);
            setNotifications([]);
            setSelected(new Set());
            setDeleteMode(false);
            setUnreadCount(0);
            if (onRefresh) onRefresh();
        } catch (e) { }
        setDeleting(false);
    };

    const exitDeleteMode = () => {
        setDeleteMode(false);
        setSelected(new Set());
    };

    return (
        <>
            <div className="fixed inset-0 z-[299]" onClick={onClose} />
            <div className="absolute right-0 top-[calc(100%+8px)] z-[300] flex w-[360px] max-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_10px_40px_rgba(0,0,0,0.12)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-white">
                    <h3 className="font-bold text-foreground text-[15px]">Notifications</h3>
                    <div className="flex items-center gap-1.5">
                        {deleteMode ? (
                            <>
                                <button
                                    onClick={toggleSelectAll}
                                    className="text-[11px] font-semibold text-blue-600 hover:underline px-1.5 py-0.5"
                                >
                                    {selected.size === notifications.length ? 'Deselect All' : 'Select All'}
                                </button>
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={selected.size === 0 || deleting}
                                    className="text-[11px] font-semibold text-red-600 hover:underline px-1.5 py-0.5 disabled:opacity-40 disabled:no-underline"
                                >
                                    Delete ({selected.size})
                                </button>
                                <button
                                    onClick={handleDeleteAll}
                                    disabled={notifications.length === 0 || deleting}
                                    className="text-[11px] font-semibold text-red-600 hover:underline px-1.5 py-0.5 disabled:opacity-40"
                                >
                                    Delete All
                                </button>
                                <button
                                    onClick={exitDeleteMode}
                                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                                >
                                    <X className="h-3.5 w-3.5 text-gray-500" />
                                </button>
                            </>
                        ) : (
                            <>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-[11px] font-semibold text-[#FF6B35] hover:underline px-1.5 py-0.5 flex items-center gap-1"
                                    >
                                        <CheckCheck className="h-3 w-3" /> Mark all read
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={() => setDeleteMode(true)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50 transition-colors group"
                                        title="Delete notifications"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-gray-400 group-hover:text-red-500 transition-colors" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Notification List */}
                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm font-medium">No notifications yet</p>
                        </div>
                    ) : notifications.map((n, i) => (
                        <div
                            key={n.id || i}
                            className={cn(
                                'relative border-b border-border/60 px-4 py-3.5 transition-all hover:bg-secondary/50 cursor-pointer',
                                !isRead(n) && 'bg-[#EFF6FF]',
                                deleteMode && selected.has(n.id) && 'bg-red-50/70'
                            )}
                            onClick={() => {
                                if (deleteMode) {
                                    toggleSelect(n.id);
                                } else {
                                    onNotificationClick?.(n);
                                }
                            }}
                        >
                            <div className="flex items-start gap-3">
                                {/* Checkbox in delete mode */}
                                {deleteMode && (
                                    <div className="flex items-center pt-1">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(n.id)}
                                            onChange={() => toggleSelect(n.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer accent-red-500"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-[#FF6B35] tracking-wider uppercase">
                                            {renderLabel(n)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {n.created_at ? timeAgo(n.created_at) : 'Just now'}
                                        </span>
                                    </div>
                                    <p className={cn('text-[13px] text-foreground leading-snug', !isRead(n) && 'font-semibold')}>
                                        {renderMessage(n)}
                                    </p>
                                </div>
                                {/* Unread dot */}
                                {!deleteMode && !isRead(n) && (
                                    <div className="flex items-center pt-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
