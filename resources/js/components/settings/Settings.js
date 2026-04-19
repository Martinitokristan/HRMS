import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Smartphone, QrCode, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const TABS = [
    { id: 'general', label: 'General', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id: 'payments', label: 'Payments', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { id: 'security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2zm10-10V7a4 4 0 00-8 0v4h8z' }
];

export default function Settings() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const [showPayload, setShowPayload] = useState(false);
    const [copied, setCopied] = useState(false);
    const [addingPayload, setAddingPayload] = useState(false);
    const [newPayload, setNewPayload] = useState('');
    const [addingLoading, setAddingLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const res = await api.get('/settings');
                if (!isMounted) return;
                const data = res.data?.data !== undefined ? res.data.data : res.data;
                setSettings(data?.settings || {});
            } catch (err) {
                if (isMounted) showToast('Failed to load settings', 'error');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [refreshTrigger]);

    const handleChange = (key, value) => {
        setSettings({
            ...settings,
            [activeTab]: {
                ...(settings[activeTab] || {}),
                [key]: value
            }
        });
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.put('/settings', {
                group: activeTab,
                settings: settings[activeTab] || {}
            });
            showToast('Settings saved');
            triggerRefresh();
        } catch (e) {
            showToast('Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const maskPayload = (str) => {
        if (!str || str.length < 12) return str;
        return str.slice(0, 8) + '••••••••••••••••' + str.slice(-4);
    };

    const handleCopyPayload = () => {
        const val = settings.payments?.gcash_payload || '';
        navigator.clipboard.writeText(val).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleSavePayload = async () => {
        if (!newPayload.trim()) return;
        setAddingLoading(true);
        try {
            await api.put('/settings', { group: 'payments', settings: { gcash_payload: newPayload.trim() } });
            showToast('GCash payload saved');
            setAddingPayload(false);
            setNewPayload('');
            triggerRefresh();
        } catch (e) {
            showToast('Failed to save payload', 'error');
        } finally {
            setAddingLoading(false);
        }
    };

    const handleDeletePayload = async () => {
        if (!confirm('Remove the GCash payload? GCash payments will be hidden from checkout until a new payload is added.')) return;
        try {
            await api.put('/settings', { group: 'payments', settings: { gcash_payload: '' } });
            showToast('GCash payload removed');
            triggerRefresh();
        } catch (e) {
            showToast('Failed to remove payload', 'error');
        }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><div className="spinner" /></div>;

    const renderIcon = (d) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={d} />
        </svg>
    );

    return (
        <div className="flex gap-6">
            <Card className="w-[200px] shrink-0 p-2 h-fit sticky top-4">
                <div className="space-y-0.5">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {renderIcon(tab.icon)}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </Card>

            <div className="flex-1 min-w-0">

                {/* ── GENERAL ── */}
                {activeTab === 'general' && (
                    <>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">General Settings</h2>
                            <p className="text-sm text-muted-foreground">Store information, branding, and business details</p>
                        </div>
                        <Card className="p-5 mb-6 flex items-center gap-5">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold shrink-0">{settings.general?.store_name?.charAt(0) || 'H'}</div>
                            <div>
                                <h4 className="font-semibold text-foreground">Store Logo</h4>
                                <p className="text-sm text-muted-foreground mb-2">PNG or JPG, max 2MB. Recommended size: 256×256px</p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">Upload Logo</Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remove</Button>
                                </div>
                            </div>
                        </Card>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Business Information</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <Label>Store Name</Label>
                                <Input type="text" value={settings.general?.store_name || ''} onChange={e => handleChange('store_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Number</Label>
                                <Input type="text" value={settings.general?.contact_number || ''} onChange={e => handleChange('contact_number', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Business Email</Label>
                                <Input type="email" value={settings.general?.contact_email || ''} onChange={e => handleChange('contact_email', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tax Rate (%)</Label>
                                <Input type="number" value={settings.general?.tax_rate || '12'} onChange={e => handleChange('tax_rate', e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Complete Store Address</Label>
                                <Textarea rows={3} value={settings.general?.store_address || ''} onChange={e => handleChange('store_address', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 border-t border-border">
                            <Button onClick={handleSaveSettings} disabled={saving}>Save Changes</Button>
                        </div>
                    </>
                )}

                {/* ── NOTIFICATIONS ── */}
                {activeTab === 'notifications' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Notification Settings</h2>
                            <p className="text-sm text-muted-foreground">Control how and when the system sends alerts to admins and customers</p>
                        </div>
                        <div className="space-y-1 mb-6">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Inventory Alerts</div>
                            {[
                                { k: 'low_stock_alerts', t: 'Low Stock Reorder Alerts', d: 'Notify admin when product stock falls below reorder threshold' },
                                { k: 'out_of_stock_alerts', t: 'Out of Stock Alerts', d: 'Immediate alert when any product reaches zero stock after a sale' }
                            ].map(item => (
                                <Card key={item.k} className="p-4 flex items-center justify-between gap-4">
                                    <div><h5 className="text-sm font-semibold text-foreground">{item.t}</h5><p className="text-[12px] text-muted-foreground">{item.d}</p></div>
                                    <Switch checked={settings.notifications?.[item.k] === '1'} onCheckedChange={checked => handleChange(item.k, checked ? '1' : '0')} />
                                </Card>
                            ))}
                            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mt-5 mb-3">Order & Return Alerts</div>
                            {[
                                { k: 'return_approved_notify', t: 'Return Approved Notification (Customer)', d: 'Notify customer via in-app notification when their return request is approved' },
                                { k: 'gcash_confirmed_sms', t: 'GCash Payment Confirmed SMS (Customer)', d: 'Send SMS to customer when their GCash payment is verified and order is confirmed' },
                                { k: 'gcash_payment_toast', t: 'GCash Payment Received Toast (Admin)', d: 'Show a pop-up toast notification on the admin dashboard when a GCash payment is received' }
                            ].map(item => (
                                <Card key={item.k} className="p-4 flex items-center justify-between gap-4">
                                    <div><h5 className="text-sm font-semibold text-foreground">{item.t}</h5><p className="text-[12px] text-muted-foreground">{item.d}</p></div>
                                    <Switch checked={settings.notifications?.[item.k] === '1'} onCheckedChange={checked => handleChange(item.k, checked ? '1' : '0')} />
                                </Card>
                            ))}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">SMS Channel</div>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-semibold text-foreground flex items-center gap-2"><Smartphone className="h-4 w-4" /> SMS Notifications</h5>
                                    <p className="text-[12px] text-muted-foreground mt-0.5">Master toggle — when disabled, no SMS messages will be sent by the system (GCash confirmation, expiry reminders, etc.)</p>
                                </div>
                                <Switch checked={settings.notifications?.sms_enabled === '1'} onCheckedChange={checked => handleChange('sms_enabled', checked ? '1' : '0')} />
                            </div>
                        </Card>
                        <div className="flex justify-end pt-4 border-t border-border mt-6">
                            <Button onClick={handleSaveSettings} disabled={saving}>Save Preferences</Button>
                        </div>
                    </div>
                )}

                {/* ── PAYMENTS ── */}
                {activeTab === 'payments' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Payment Settings</h2>
                            <p className="text-sm text-muted-foreground">Configure GCash QR code for customer checkout payments</p>
                        </div>

                        {settings.payments?.gcash_payload ? (
                            <div className="space-y-4">
                                <Card className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <QrCode className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-semibold text-foreground">GCash QR Payload</span>
                                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 bg-green-50">Active</Badge>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{user?.name || 'Admin'}</p>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    readOnly
                                                    value={showPayload ? settings.payments.gcash_payload : maskPayload(settings.payments.gcash_payload)}
                                                    className="font-mono text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0 cursor-default text-foreground"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowPayload(p => !p)}
                                                title={showPayload ? 'Hide payload' : 'Show payload'}
                                            >
                                                {showPayload ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                onClick={handleCopyPayload}
                                                title="Copy payload"
                                            >
                                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                onClick={handleDeletePayload}
                                                title="Remove payload"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-2">
                                        Read-only to prevent accidental edits. Remove and re-add to change the payload.
                                    </p>
                                </Card>

                                <Card className="p-4 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <QRCodeCanvas value={settings.payments.gcash_payload} size={140} level="M" includeMargin={true} />
                                        <span className="text-[11px] text-muted-foreground font-medium">Static QR preview</span>
                                    </div>
                                </Card>
                            </div>
                        ) : addingPayload ? (
                            <Card className="p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <QrCode className="h-4 w-4 text-primary" />
                                    <h4 className="font-semibold text-foreground">Add GCash QR Payload</h4>
                                </div>
                                <p className="text-[12px] text-muted-foreground mb-4">
                                    Open GCash → Show QR → scan with a QR reader app to copy the raw payload string, then paste it below.
                                </p>
                                <div className="space-y-3">
                                    <Textarea
                                        rows={5}
                                        placeholder="Paste your GCash QR payload string here (e.g. 000201010211...)"
                                        value={newPayload}
                                        onChange={e => setNewPayload(e.target.value)}
                                        className="font-mono text-xs"
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="outline" onClick={() => { setAddingPayload(false); setNewPayload(''); }}>Cancel</Button>
                                        <Button onClick={handleSavePayload} disabled={!newPayload.trim() || addingLoading}>
                                            {addingLoading ? 'Saving...' : 'Save Payload'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="p-10 flex flex-col items-center justify-center text-center border-dashed">
                                <QrCode className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                <h4 className="font-semibold text-foreground mb-1">No GCash payload configured</h4>
                                <p className="text-sm text-muted-foreground mb-5">
                                    Add your GCash QR payload string to enable GCash payments at checkout.
                                </p>
                                <Button onClick={() => setAddingPayload(true)} className="gap-2">
                                    <Plus className="h-4 w-4" /> Add GCash Payload
                                </Button>
                            </Card>
                        )}
                    </div>
                )}

                {/* ── SECURITY ── */}
                {activeTab === 'security' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Security Configuration</h2>
                            <p className="text-sm text-muted-foreground">Manage system security, authentication, and access control</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <Label>Session Timeout (minutes)</Label>
                                <Input type="number" value={settings.security?.session_timeout || '120'} onChange={e => handleChange('session_timeout', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Login Attempts</Label>
                                <Input type="number" value={settings.security?.max_login_attempts || '5'} onChange={e => handleChange('max_login_attempts', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1 mb-6">
                            {[
                                { k: 'two_factor', t: 'Enforce Two-Factor Authentication', d: 'Require 2FA for all administrative accounts' }
                            ].map(item => (
                                <Card key={item.k} className="p-4 flex items-center justify-between gap-4">
                                    <div><h5 className="text-sm font-semibold text-foreground">{item.t}</h5><p className="text-[12px] text-muted-foreground">{item.d}</p></div>
                                    <Switch checked={settings.security?.[item.k] === '1'} onCheckedChange={checked => handleChange(item.k, checked ? '1' : '0')} />
                                </Card>
                            ))}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-border">
                            <Button onClick={handleSaveSettings} disabled={saving}>Update Security Policy</Button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}