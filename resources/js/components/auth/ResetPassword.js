import React, { useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '../../lib/api';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const emailParam = searchParams.get('email') || '';

    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const strength = useMemo(() => ({
        minLength: password.length >= 8,
        hasLetter: /[a-zA-Z]/.test(password),
        hasNumber: /\d/.test(password),
        matches: password.length > 0 && password === passwordConfirmation,
    }), [password, passwordConfirmation]);

    const canSubmit = strength.minLength && strength.hasLetter && strength.hasNumber && strength.matches;

    if (!token || !type) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-card px-6">
                <div className="w-full max-w-[420px] text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-6">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-black text-foreground mb-2">Invalid Reset Link</h1>
                    <p className="text-sm text-muted-foreground mb-6">This password reset link is invalid or incomplete. Please request a new one.</p>
                    <Link to="/forgot-password">
                        <Button className="w-full h-12 text-[15px] font-bold">Request New Reset Link</Button>
                    </Link>
                    <p className="mt-4 text-sm text-muted-foreground">
                        <Link to="/login" className="font-bold text-primary hover:underline">Back to Login</Link>
                    </p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/reset-password', {
                token,
                email: emailParam,
                password,
                password_confirmation: passwordConfirmation,
            });
            navigate('/login', {
                replace: true,
                state: { message: 'Password reset successfully. Please log in with your new password.' },
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    const Requirement = ({ met, text }) => (
        <div className="flex items-center gap-2">
            {met
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />}
            <span className={`text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>{text}</span>
        </div>
    );

    return (
        <div className="flex min-h-screen">
            {/* Left - Form */}
            <div className="flex flex-1 items-center justify-center px-6 py-12 bg-card">
                <div className="w-full max-w-[420px]">
                    <div className="flex items-center gap-2 cursor-pointer mb-10" onClick={() => navigate('/')}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                            <span className="text-sm font-black text-primary-foreground">H</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-foreground">HRMS</span>
                    </div>

                    <h1 className="text-[26px] font-black text-foreground tracking-tight mb-2">Set New Password</h1>
                    <p className="text-sm text-muted-foreground mb-8">Choose a strong password for your account.</p>

                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {error}
                                {error.includes('expired') && (
                                    <Link to="/forgot-password" className="block mt-2 font-bold text-primary hover:underline">
                                        Request a new reset link
                                    </Link>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-11 pr-10"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirm Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirm"
                                    type={showConfirm ? 'text' : 'password'}
                                    required
                                    value={passwordConfirmation}
                                    onChange={e => setPasswordConfirmation(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-11 pr-10"
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {password.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50">
                                <Requirement met={strength.minLength} text="Min 8 characters" />
                                <Requirement met={strength.hasLetter} text="Contains letter" />
                                <Requirement met={strength.hasNumber} text="Contains number" />
                                <Requirement met={strength.matches} text="Passwords match" />
                            </div>
                        )}

                        <Button type="submit" disabled={loading || !canSubmit}
                            className="w-full h-12 text-[15px] font-bold shadow-md shadow-primary/20">
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting Password...</>
                                : 'Reset Password'}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            <Link to="/login" className="font-bold text-primary hover:underline">Back to Login</Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right - Promo */}
            <div className="hidden lg:flex flex-col items-center justify-center w-[480px] xl:w-[520px] p-12 text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' }}>
                <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, #FF6B35, transparent 60%)' }} />
                <div className="relative z-10 text-center max-w-sm">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 mx-auto mb-8">
                        <KeyRound className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-black mb-3">Secure Your Account</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        Choose a strong password that includes letters and numbers to keep your account safe.
                    </p>
                    <div className="space-y-3 text-left">
                        {['At least 8 characters long', 'Mix of letters and numbers', 'Different from previous passwords'].map((tip, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.06] border border-white/10 px-4 py-3">
                                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                                <span className="text-sm font-semibold">{tip}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
