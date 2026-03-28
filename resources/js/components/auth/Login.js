import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import { ShieldCheck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

export default function Login() {
    const { login: userLogin } = useAuth();
    const { login: supplierLogin } = useSupplierAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await userLogin(email, password, null);
            if (user.role === 'rider')         navigate('/rider',     { replace: true });
            else if (user.role === 'customer') navigate('/shop',      { replace: true });
            else                               navigate('/dashboard', { replace: true });
            return;
        } catch (userErr) {
            const status = userErr.response?.status;
            if (!status || (status !== 401 && status !== 422 && status !== 403)) {
                setError('Network error. Please try again.');
                setLoading(false);
                return;
            }
        }

        try {
            await supplierLogin(email, password);
            navigate('/supplier/dashboard', { replace: true });
        } catch (supplierErr) {
            setError('Invalid email or password. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left - Form */}
            <div className="flex flex-1 items-center justify-center px-6 py-12 bg-card">
                <div className="w-full max-w-[420px]">
                    <div className="flex items-center gap-2 cursor-pointer mb-10" onClick={() => navigate('/')}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                            <span className="text-sm font-black text-primary-foreground">H</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-foreground">
                            HRMS
                        </span>
                    </div>

                    <h1 className="text-[26px] font-black text-foreground tracking-tight mb-2">Unified Access Portal</h1>
                    <p className="text-sm text-muted-foreground mb-8">Enter your credentials to manage your hardware operations.</p>

                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder=""
                                autoComplete="email"
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                className="h-11"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Checkbox id="remember" />
                                <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">Remember me</Label>
                            </div>
                            <a href="#" className="text-sm font-semibold text-primary hover:underline">Security Help?</a>
                        </div>

                        <Button type="submit" disabled={loading} className="w-full h-12 text-[15px] font-bold shadow-md shadow-primary/20">
                            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying Identity...</> : 'Sign In to Instance'}
                        </Button>
                    </form>

                    <div className="mt-8 text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Need a hardware account? <Link to="/register" className="font-bold text-primary hover:underline">Register here</Link>
                        </p>
                        <Separator />
                        <p className="text-sm text-muted-foreground">
                            Supplier Partner? <Link to="/supplier/register" className="font-bold text-primary hover:underline">Join our Network</Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right - Promo */}
            <div className="hidden lg:flex flex-col items-center justify-center w-[480px] xl:w-[520px] p-12 text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' }}
            >
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, #FF6B35, transparent 60%)' }} />
                <div className="relative z-10 text-center max-w-sm">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 mx-auto mb-8">
                        <ShieldCheck className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-black mb-3">Industrial Intelligence</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        Access the core engine to streamline your inventory, sales, and logistics workflows.
                    </p>
                    <div className="space-y-3 text-left">
                        {['Multi-Role Permissions', 'End-to-End Fulfillment', 'Live Data & Analytics'].map((feat, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.06] border border-white/10 px-4 py-3">
                                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                                <span className="text-sm font-semibold">{feat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
