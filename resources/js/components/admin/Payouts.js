import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Banknote, Wallet, CheckCircle2, AlertTriangle, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Wave 6 — Admin Cash Remittance + Rider Payouts.
 * Single-page tabbed UI matching the look-and-feel of CancelOrdersTab.
 */

const peso = (v) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(v || 0));

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseIso(str) {
    if (!str) return new Date();
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * iPhone-style calendar popover. Click the trigger to open, pick a day,
 * the picker closes and calls onChange(isoDate).
 */
function IphoneDatePicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState(() => parseIso(value)); // month being viewed
    const [mode, setMode] = useState('days'); // 'days' | 'months' | 'years'
    const wrapperRef = useRef(null);

    // close on outside click / escape
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // sync cursor when value changes from parent
    useEffect(() => { setCursor(parseIso(value)); }, [value]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const selected = parseIso(value);

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    // Build a 6-row x 7-col grid for stable height
    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
        cells.push({ day: daysInPrev - startWeekday + i + 1, otherMonth: -1 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, otherMonth: 0 });
    }
    while (cells.length < 42) {
        cells.push({ day: cells.length - daysInMonth - startWeekday + 1, otherMonth: 1 });
    }

    const navMonth = (delta) => setCursor(new Date(year, month + delta, 1));

    const pick = (cell) => {
        const d = new Date(year + (cell.otherMonth === 1 && month === 11 ? 1 : 0)
                            + (cell.otherMonth === -1 && month === 0 ? -1 : 0),
                          (month + cell.otherMonth + 12) % 12,
                          cell.day);
        onChange(toIsoDate(d));
        setOpen(false);
    };

    const display = (() => {
        const d = parseIso(value);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${m}/${day}/${d.getFullYear()}`;
    })();

    const isSameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    return (
        <div className="relative inline-block" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:bg-gray-50 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <span>{display}</span>
                <CalendarIcon className="h-4 w-4 text-blue-500" />
            </button>

            {open && (
                <div className="absolute z-50 mt-2 left-0 w-[300px] rounded-2xl border border-gray-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-4 animate-in fade-in zoom-in-95 duration-150 origin-top-left">
                    {/* Header — adapts to mode.
                        days  : "April 2026 ›"  → tap to enter month picker
                        months: "2026 ▾"        → tap to enter year picker
                        years : centered "Select Year"
                    */}
                    <div className="flex items-center justify-between mb-2">
                        {mode === 'years' ? (
                            <div className="flex-1 text-center text-[15px] font-bold text-gray-900">Select Year</div>
                        ) : mode === 'months' ? (
                            /* Months mode: centered year, year text itself is the trigger
                               into years mode. No chevrons. */
                            <button
                                type="button"
                                onClick={() => setMode('years')}
                                className="flex-1 text-center text-[15px] font-bold text-gray-900 hover:text-blue-500 active:scale-95 transition py-1"
                            >
                                {year}
                            </button>
                        ) : (
                            /* Days mode: month/year on the left, prev/next-month chevrons on the right */
                            <>
                                <button
                                    type="button"
                                    onClick={() => setMode('months')}
                                    className="inline-flex items-center gap-1 text-[15px] font-bold text-gray-900 hover:text-blue-500 active:scale-95 transition"
                                >
                                    {MONTHS[month]} {year}
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => navMonth(-1)}
                                        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-blue-500 hover:bg-blue-50 active:scale-95 transition"
                                        aria-label="Previous month"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navMonth(1)}
                                        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-blue-500 hover:bg-blue-50 active:scale-95 transition"
                                        aria-label="Next month"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {mode === 'days' ? (
                        <>
                            {/* Weekday row */}
                            <div className="grid grid-cols-7 mb-1">
                                {WEEKDAYS.map(w => (
                                    <div key={w} className="text-[11px] font-semibold text-gray-400 text-center py-1.5 uppercase tracking-wide">
                                        {w}
                                    </div>
                                ))}
                            </div>

                            {/* Day grid */}
                            <div className="grid grid-cols-7 gap-y-1">
                                {cells.map((cell, idx) => {
                                    const cellDate = new Date(
                                        year + (cell.otherMonth === 1 && month === 11 ? 1 : 0)
                                             + (cell.otherMonth === -1 && month === 0 ? -1 : 0),
                                        (month + cell.otherMonth + 12) % 12,
                                        cell.day
                                    );
                                    const isSelected = isSameDay(cellDate, selected);
                                    const isToday = isSameDay(cellDate, today);
                                    const dim = cell.otherMonth !== 0;

                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => pick(cell)}
                                            className={[
                                                'mx-auto h-9 w-9 rounded-full text-[14px] font-semibold transition-all duration-150 flex items-center justify-center',
                                                isSelected
                                                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 scale-105'
                                                    : isToday
                                                        ? 'text-blue-500 ring-1 ring-inset ring-blue-200 bg-blue-50/40'
                                                        : dim
                                                            ? 'text-gray-300 hover:bg-gray-50'
                                                            : 'text-gray-800 hover:bg-gray-100 active:scale-95',
                                            ].join(' ')}
                                        >
                                            {cell.day}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : mode === 'months' ? (
                        /* Month grid 4×3 — tap a month to drop back to day mode */
                        <div className="grid grid-cols-4 gap-2">
                            {MONTHS.map((name, idx) => {
                                const active = idx === month;
                                const isCurrent = idx === today.getMonth() && year === today.getFullYear();
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => {
                                            setCursor(new Date(year, idx, 1));
                                            setMode('days');
                                        }}
                                        className={[
                                            'h-11 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95',
                                            active
                                                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                                                : isCurrent
                                                    ? 'text-blue-500 ring-1 ring-inset ring-blue-200 bg-blue-50/40'
                                                    : 'text-gray-700 hover:bg-gray-100',
                                        ].join(' ')}
                                    >
                                        {name.slice(0, 3)}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        /* Year grid — vertical scroll, 4 cols, descending from today */
                        <div className="max-h-[260px] overflow-y-auto pr-1 -mr-1 scrollbar-thin">
                            <div className="grid grid-cols-4 gap-y-3 gap-x-2 py-1">
                                {Array.from({ length: 60 }, (_, i) => today.getFullYear() - i).map(y => {
                                    const active = y === year;
                                    const isCurrent = y === today.getFullYear();
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            onClick={() => {
                                                setCursor(new Date(y, month, 1));
                                                setMode('months');
                                            }}
                                            className={[
                                                'h-10 mx-auto px-3 min-w-[68px] rounded-full text-[15px] font-bold transition-all duration-150 active:scale-95 flex items-center justify-center',
                                                active
                                                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                                                    : isCurrent
                                                        ? 'text-blue-500'
                                                        : 'text-gray-800 hover:bg-gray-100',
                                            ].join(' ')}
                                        >
                                            {y}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => {
                                onChange(toIsoDate(new Date()));
                                setMode('days');
                                setOpen(false);
                            }}
                            className="text-[13px] font-semibold text-blue-500 hover:text-blue-600 active:scale-95 transition"
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('days'); setOpen(false); }}
                            className="text-[13px] font-semibold text-gray-500 hover:text-gray-700 active:scale-95 transition"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function CashRemittanceTab() {
    const { showToast } = useToast();
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [marking, setMarking] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/admin/cash-remittance', { params: { date } });
            setRows(r.data?.data || []);
        } catch (e) {
            showToast('Failed to load remittance', 'error');
        } finally {
            setLoading(false);
        }
    }, [date, showToast]);

    useEffect(() => { load(); }, [load]);

    const markRemitted = async (riderId) => {
        setMarking(riderId);
        try {
            await api.post(`/admin/cash-remittance/${riderId}/${date}/mark-remitted`);
            showToast('Cash remittance recorded', 'success');
            await load();
        } catch (e) {
            showToast('Failed to mark remitted', 'error');
        } finally {
            setMarking(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-foreground">Date</label>
                <IphoneDatePicker value={date} onChange={setDate} />
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
                </Button>
            </div>

            <div className="rounded-xl border border-border bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Rider</th>
                            <th className="px-4 py-3 text-right font-semibold">Deliveries</th>
                            <th className="px-4 py-3 text-right font-semibold">Expected</th>
                            <th className="px-4 py-3 text-right font-semibold">Remitted</th>
                            <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                            <th className="px-4 py-3 text-right font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.length === 0 && !loading && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No COD deliveries on this date.</td></tr>
                        )}
                        {rows.map(r => (
                            <tr key={r.rider_id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-bold text-foreground">{r.rider_name || `Rider #${r.rider_id}`}</td>
                                <td className="px-4 py-3 text-right">{r.count}</td>
                                <td className="px-4 py-3 text-right font-mono">{peso(r.expected)}</td>
                                <td className="px-4 py-3 text-right font-mono text-green-600">{peso(r.remitted)}</td>
                                <td className="px-4 py-3 text-right font-mono">
                                    {r.outstanding > 0
                                        ? <span className="text-red-600 font-bold">{peso(r.outstanding)}</span>
                                        : <span className="text-muted-foreground">{peso(0)}</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {r.outstanding > 0 ? (
                                        <Button
                                            size="sm"
                                            onClick={() => markRemitted(r.rider_id)}
                                            disabled={marking === r.rider_id}
                                            className="gap-1"
                                        >
                                            {marking === r.rider_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                            Mark Remitted
                                        </Button>
                                    ) : (
                                        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Settled</Badge>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RiderPayoutsTab() {
    const { showToast } = useToast();
    const [status, setStatus] = useState('eligible');
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/admin/payouts', { params: { status } });
            setGroups(r.data?.data || []);
        } catch (e) {
            showToast('Failed to load payouts', 'error');
        } finally {
            setLoading(false);
        }
    }, [status, showToast]);

    useEffect(() => { load(); }, [load]);

    const markPaid = async (riderId, deliveryIds) => {
        if (!deliveryIds?.length) return;
        setBusy(`pay-${riderId}`);
        try {
            await api.post('/admin/payouts/mark-paid', { rider_id: riderId, delivery_ids: deliveryIds });
            showToast('Payout marked as paid', 'success');
            await load();
        } catch (e) {
            showToast('Failed to mark paid', 'error');
        } finally {
            setBusy(null);
        }
    };

    const release = async (deliveryId, decision) => {
        setBusy(`hold-${deliveryId}`);
        try {
            await api.post('/admin/payouts/release-hold', { delivery_id: deliveryId, decision });
            showToast(decision === 'release' ? 'Released to eligible' : 'Rejected', 'success');
            await load();
        } catch (e) {
            showToast('Failed to update hold', 'error');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-4">
            <Tabs value={status}>
                <TabsList>
                    <TabsTrigger value="eligible" onClick={() => setStatus('eligible')} className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Eligible</TabsTrigger>
                    <TabsTrigger value="held"     onClick={() => setStatus('held')}     className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Held</TabsTrigger>
                    <TabsTrigger value="paid"     onClick={() => setStatus('paid')}     className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="space-y-4">
                {groups.length === 0 && !loading && (
                    <div className="rounded-xl border border-border bg-white p-10 text-center text-muted-foreground">
                        No {status} payouts.
                    </div>
                )}
                {groups.map(g => (
                    <div key={g.rider_id} className="rounded-xl border border-border bg-white overflow-hidden">
                        <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-border">
                            <div>
                                <div className="font-bold text-foreground">{g.rider_name || `Rider #${g.rider_id}`}</div>
                                <div className="text-xs text-muted-foreground">{g.count} delivery{g.count === 1 ? '' : 's'} • {peso(g.total_fee)}</div>
                            </div>
                            {status === 'eligible' && (
                                <Button
                                    size="sm"
                                    onClick={() => markPaid(g.rider_id, g.rows.map(r => r.id))}
                                    disabled={busy === `pay-${g.rider_id}`}
                                    className="gap-1"
                                >
                                    {busy === `pay-${g.rider_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                                    Mark Paid ({peso(g.total_fee)})
                                </Button>
                            )}
                        </div>
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-white">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Tracking</th>
                                    <th className="px-4 py-2 text-left font-semibold">Delivered</th>
                                    <th className="px-4 py-2 text-left font-semibold">Method</th>
                                    <th className="px-4 py-2 text-right font-semibold">Fee</th>
                                    <th className="px-4 py-2 text-left font-semibold">Flags</th>
                                    {status === 'held' && <th className="px-4 py-2 text-right font-semibold">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {g.rows.map(row => (
                                    <tr key={row.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2 font-mono text-xs">{row.tracking_number || `#${row.id}`}</td>
                                        <td className="px-4 py-2">{row.delivered_at ? new Date(row.delivered_at).toLocaleString() : '—'}</td>
                                        <td className="px-4 py-2 uppercase text-xs">{row.payment_method || '—'}</td>
                                        <td className="px-4 py-2 text-right font-mono">{peso(row.delivery_fee)}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex gap-1.5">
                                                {row.geofence_flagged && (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        Geofence {row.geofence_distance != null ? `${row.geofence_distance}m` : ''}
                                                    </Badge>
                                                )}
                                                {row.customer_disputed && <Badge variant="destructive" className="text-[10px]">Disputed</Badge>}
                                                {!row.geofence_flagged && !row.customer_disputed && <span className="text-xs text-muted-foreground">—</span>}
                                            </div>
                                            {row.customer_dispute_reason && (
                                                <div className="text-[11px] text-muted-foreground mt-1 max-w-md">"{row.customer_dispute_reason}"</div>
                                            )}
                                        </td>
                                        {status === 'held' && (
                                            <td className="px-4 py-2 text-right space-x-1">
                                                <Button size="sm" variant="outline" disabled={busy === `hold-${row.id}`} onClick={() => release(row.id, 'release')}>Release</Button>
                                                <Button size="sm" variant="destructive" disabled={busy === `hold-${row.id}`} onClick={() => release(row.id, 'reject')}>Reject</Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Payouts({ tab = 'remittance' }) {
    return (
        <div className="relative">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-5">Rider Cash & Payouts</h2>

            <Tabs value={tab} className="mb-6 relative z-0">
                <TabsList>
                    <TabsTrigger value="remittance" onClick={() => window.history.replaceState(null, '', '/payouts')} className="gap-2">
                        <Banknote className="h-4 w-4" /> Cash Remittance
                    </TabsTrigger>
                    <TabsTrigger value="payouts" onClick={() => window.history.replaceState(null, '', '/payouts/riders')} className="gap-2">
                        <Wallet className="h-4 w-4" /> Rider Payouts
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="relative z-0">
                {tab === 'remittance' && <CashRemittanceTab />}
                {tab === 'payouts'    && <RiderPayoutsTab />}
            </div>
        </div>
    );
}
