import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2 } from 'lucide-react';

export default function SupplierRegister() {
    const [form, setForm] = useState({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        password_confirmation: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.password_confirmation) {
            showToast('Passwords do not match', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/supplier/auth/register', form);
            showToast('Registration successful! Please check your email for verification.', 'success');
            navigate('/login?role=supplier');
        } catch (err) {
            showToast(err.response?.data?.message || 'Registration failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
                <div className="w-full max-w-lg">
                    <div className="text-xl font-black text-foreground mb-6 cursor-pointer" onClick={() => navigate('/')}>HRMS <span className="text-primary">Pro</span></div>
                    <h1 className="text-2xl font-extrabold text-foreground mb-1">Supplier Partner Program</h1>
                    <p className="text-muted-foreground mb-8">Enter your company details to join our network of trusted suppliers.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Company Section */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">🏢 Company Information</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Company / Business Name *</Label>
                                    <Input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Legal business name" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Business Address</Label>
                                    <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Warehouse or Office location" rows={3} />
                                </div>
                            </div>
                        </div>

                        {/* Contact Section */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">👤 Primary Contact</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Full Name *</Label>
                                    <Input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required placeholder="Primary account manager" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Email *</Label>
                                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="business@email.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Phone Number</Label>
                                        <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 000 0000" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Password *</Label>
                                        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength="8" placeholder="Min. 8 characters" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm Password *</Label>
                                        <Input type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} required placeholder="Repeat password" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11" disabled={submitting}>
                            {submitting ? 'Registering Company...' : 'Initialize Supplier Partnership'}
                        </Button>

                        <div className="text-center text-sm text-muted-foreground">
                            Already a partner? <Link to="/login?role=supplier" className="text-primary font-semibold no-underline hover:underline">Sign In</Link>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right - Branding */}
            <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 text-white" style={{ backgroundImage: 'linear-gradient(rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0.9)), url("/images/hero-banner.png")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="max-w-md text-center">
                    <div className="text-6xl mb-6">🏭</div>
                    <h2 className="text-2xl font-extrabold mb-3">Grow with HRMS Pro</h2>
                    <p className="text-white/70 mb-8">Join thousands of hardware suppliers streamlining their fulfillment through our automated retail engine.</p>
                    <div className="space-y-3 text-left">
                        {[
                            'Direct Purchase Order Integration',
                            'Real-time Inventory Syncing',
                            'Automated Payment Reconciliation',
                            'Advanced Analytics & Demand Forecasting',
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                                <span className="text-sm text-white/80">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
