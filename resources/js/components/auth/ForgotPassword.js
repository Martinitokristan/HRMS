import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '../../lib/api';

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/forgot-password', { email });
            navigate('/login', {
                replace: true,
                state: { message: 'Password reset link sent. Check your email.' },
            });
        } catch (err) {
            const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
            setError(msg);
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

                    <h1 className="text-[26px] font-black text-foreground tracking-tight mb-2">Reset Your Password</h1>
                    <p className="text-sm text-muted-foreground mb-8">Enter your email address and we'll send you a link to reset your password.</p>

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

                        <Button type="submit" disabled={loading} className="w-full h-12 text-[15px] font-bold shadow-md shadow-primary/20">
                            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending Reset Link...</> : 'Send Reset Link'}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Remember your password? <Link to="/login" className="font-bold text-primary hover:underline">Back to Login</Link>
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
                        <KeyRound className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-black mb-3">Account Recovery</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        Don't worry — it happens to the best of us. We'll have you back in your account in no time.
                    </p>
                    <div className="space-y-3 text-left">
                        {['Enter your registered email', 'Check inbox for reset link', 'Set a new secure password'].map((step, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.06] border border-white/10 px-4 py-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 shrink-0">
                                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                                </div>
                                <span className="text-sm font-semibold">{step}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
