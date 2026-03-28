import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Package } from 'lucide-react';

export default function SupplierLogin() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const { login } = useSupplierAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await login(form.email, form.password);
            showToast('Login successful!');
            navigate('/supplier/dashboard');
        } catch (err) {
            showToast(err.response?.data?.message || 'Invalid credentials', 'error');
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md">
                    <div className="text-xl font-black text-foreground mb-8 cursor-pointer" onClick={() => navigate('/')}>HRMS</div>
                    <h1 className="text-2xl font-extrabold text-foreground mb-1">Supplier Portal</h1>
                    <p className="text-muted-foreground mb-8">Secure access to the fulfillment network.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <Label>Email Address</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Password</Label>
                            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••" />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Checkbox id="remember-supplier" />
                                <Label htmlFor="remember-supplier" className="text-sm font-normal cursor-pointer">Remember this device</Label>
                            </div>
                            <a href="#" className="text-sm text-primary font-medium no-underline hover:underline">Forgot password?</a>
                        </div>

                        <Button type="submit" className="w-full h-11" disabled={submitting}>
                            {submitting ? 'Authenticating...' : 'Sign In to Dashboard'}
                        </Button>
                    </form>

                    <div className="mt-10 text-center text-sm text-muted-foreground">
                        <p>New partner? <Link to="/supplier/register" className="text-primary font-semibold no-underline hover:underline">Apply for access</Link></p>
                        <p className="mt-2 opacity-70">Looking for <Link to="/login" className="text-primary font-medium no-underline hover:underline">Admin Access</Link>?</p>
                    </div>
                </div>
            </div>

            {/* Right - Branding */}
            <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 text-white bg-gradient-to-br from-slate-900 to-slate-800 relative" style={{ backgroundImage: 'linear-gradient(rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0.9)), url("/images/hero-banner.png")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="max-w-md text-center">
                    <Package className="h-16 w-16 mx-auto mb-6 text-white/80" />
                    <h2 className="text-2xl font-extrabold mb-3">Fulfillment Excellence</h2>
                    <p className="text-white/70 mb-8">Monitor your purchase orders and manage stock availability through our high-performance supplier gateway.</p>
                    <div className="space-y-3 text-left">
                        {[
                            { n: '1', t: 'Receive Digital Purchase Orders' },
                            { n: '2', t: 'Confirm Stock Availability' },
                            { n: '3', t: 'Schedule Warehouse Dispatches' },
                            { n: '4', t: 'Track Automated Settlements' },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">{s.n}</div>
                                <span className="text-sm text-white/80">{s.t}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
