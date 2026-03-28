import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, User, Building2, AlertCircle, CheckCircle, Mail, RefreshCw, Loader2 } from 'lucide-react';
import { useFormValidation } from '../../hooks/useFormValidation';

export default function SupplierRegister() {
    const [formData, setFormData] = useState({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        password_confirmation: ''
    });
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [successMsg, setSuccessMsg] = useState('');
    const [capsWarning, setCapsWarning] = useState(false);

    const { errors, validateName, validateContactName, validatePhone, validatePassword, setError, clearError, clearAllErrors } = useFormValidation();

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;
        if (name === 'phone') {
            newValue = value.replace(/\D/g, '').substring(0, 10);
        }
        setFormData({ ...formData, [name]: newValue });
        
        let error = null;
        if (name === 'name') error = validateName(newValue);
        if (name === 'contact_name') error = validateContactName(newValue);
        if (name === 'phone') error = validatePhone(newValue);
        if (name === 'password') error = validatePassword(newValue);
        
        if (error) {
            setError(name, error);
        } else {
            clearError(name);
        }

        if (name === 'password_confirmation') {
            if (newValue !== formData.password) setError('password_confirmation', 'Passwords do not match');
            else clearError('password_confirmation');
        }
        if (name === 'password' && formData.password_confirmation) {
            if (newValue !== formData.password_confirmation) setError('password_confirmation', 'Passwords do not match');
            else clearError('password_confirmation');
        }
    };

    const handleKeyDown = (e) => {
        if (e.getModifierState('CapsLock')) {
            setCapsWarning(true);
        } else {
            setCapsWarning(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setSuccessMsg('');

        const nameErr = validateName(formData.name);
        const contactNameErr = validateContactName(formData.contact_name);
        const phoneErr = validatePhone(formData.phone);
        const passErr = validatePassword(formData.password);

        if (nameErr) setError('name', nameErr);
        if (contactNameErr) setError('contact_name', contactNameErr);
        if (phoneErr) setError('phone', phoneErr);
        if (passErr) setError('password', passErr);

        if (formData.password !== formData.password_confirmation) {
            setError('password_confirmation', 'Passwords do not match');
        }

        if (nameErr || contactNameErr || phoneErr || passErr || formData.password !== formData.password_confirmation) {
            return;
        }

        setLoading(true);

        try {
            const dataToSubmit = {
                ...formData,
                phone: `63${formData.phone}`
            };
            const response = await axios.post('/supplier/auth/register', dataToSubmit);
            setSuccessMsg('Supplier account created successfully! Please check your email to verify your account.');
            showToast('Registration successful!', 'success');
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to register';
            showToast(errorMsg, 'error');
            setError('form', errorMsg);
            if (error.response?.data?.errors) {
                Object.keys(error.response.data.errors).forEach(key => {
                    setError(key, error.response.data.errors[key][0]);
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const [resendLoading, setResendLoading] = useState(false);
    const [resendMsg, setResendMsg] = useState('');
    const [resendError, setResendError] = useState('');

    const handleResend = async () => {
        setResendLoading(true);
        setResendMsg('');
        setResendError('');
        try {
            const response = await axios.post('/supplier/auth/resend-verification', { email: formData.email });
            setResendMsg(response.data.message);
        } catch (err) {
            setResendError(err.response?.data?.message || 'Failed to resend email.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Success Modal */}
            <Dialog open={!!successMsg} onOpenChange={(open) => { if (!open) navigate('/supplier/login') }}>
                <DialogContent className="sm:max-w-md border-primary/20 shadow-2xl overflow-hidden p-0">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400" />
                    <DialogHeader className="text-center pt-8 px-6">
                        <div className="mx-auto w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
                            <Mail className="w-8 h-8" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-foreground">Verify Your Email</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-[15px] leading-relaxed pt-2">
                            We've sent a verification link to <br/>
                            <span className="font-bold text-foreground">{formData.email}</span>. <br/>
                            Check your inbox and click the link to activate your supplier account.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-6 space-y-4">
                        {resendMsg && (
                            <Alert className="bg-green-50 text-green-800 border-green-200">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <AlertDescription>{resendMsg}</AlertDescription>
                            </Alert>
                        )}
                        {resendError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{resendError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleResend}
                                disabled={resendLoading}
                                className="w-full h-11 font-bold shadow-md"
                            >
                                {resendLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Resend Verification Link
                            </Button>
                            <Button variant="ghost" className="w-full h-11" onClick={() => navigate('/supplier/login')}>
                                Return to Supplier Login
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
                <div className="w-full max-w-lg">
                    <div className="text-xl font-black text-foreground mb-6 cursor-pointer" onClick={() => navigate('/')}>HRMS</div>
                    <h1 className="text-2xl font-extrabold text-foreground mb-1">Supplier Partner Program</h1>
                    <p className="text-muted-foreground mb-8">
                        Create your supplier account to start providing products to HRMS.
                    </p>

                    {errors.form && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.form}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Company Section */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Company Information</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Company Name *</Label>
                                    <Input name="name" type="text" value={formData.name} onChange={handleChange} required placeholder="Legal business name" className={errors.name ? 'border-red-500' : ''} />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Business Address</Label>
                                    <Textarea name="address" value={formData.address} onChange={handleChange} placeholder="Warehouse or Office location" rows={3} />
                                </div>
                            </div>
                        </div>

                        {/* Contact Section */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><User className="h-4 w-4" /> Primary Contact</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Full Name *</Label>
                                    <Input name="contact_name" type="text" value={formData.contact_name} onChange={handleChange} required placeholder="Primary account manager" className={errors.contact_name ? 'border-red-500' : ''} />
                                    {errors.contact_name && <p className="text-sm text-red-500">{errors.contact_name}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Email *</Label>
                                        <Input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="" className={errors.email ? 'border-red-500' : ''} />
                                        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Phone Number *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">+63</span>
                                            <Input name="phone" type="tel" value={formData.phone} onChange={handleChange} required placeholder="9XXXXXXXXX" className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`} />
                                        </div>
                                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Password *</Label>
                                        <Input name="password" type="password" value={formData.password} onChange={handleChange} onKeyDown={handleKeyDown} required placeholder="Min 8 chars, 1 letter, 1 number" className={errors.password ? 'border-red-500' : ''} />
                                        {capsWarning && <p className="text-xs text-orange-500 my-1 font-semibold">Caps Lock is on!</p>}
                                        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm Password *</Label>
                                        <Input name="password_confirmation" type="password" value={formData.password_confirmation} onChange={handleChange} required placeholder="Repeat password" className={errors.password_confirmation ? 'border-red-500' : ''} />
                                        {errors.password_confirmation && <p className="text-sm text-red-500">{errors.password_confirmation}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11" disabled={loading}>
                            {loading ? 'Registering Company...' : 'Initialize Supplier Partnership'}
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
                    <h2 className="text-2xl font-extrabold mb-3">Grow with HRMS</h2>
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
