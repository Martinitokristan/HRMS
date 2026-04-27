import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, User, Building2, AlertCircle, CheckCircle, Mail, RefreshCw, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useFormValidation } from '../../hooks/useFormValidation';
import { PhAddressFields } from '../shared/PhAddressFields';

// Keeps the field strictly in the "09XXXXXXXXX" shape. Accepts pastes like
// "+63 917 123 4567" or "639171234567" and converts them to "09171234567".
const normalizePhone = (raw) => {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.length > 0 && !digits.startsWith('0')) digits = '0' + digits;
    return digits.substring(0, 11);
};

export default function SupplierRegister() {
    const [formData, setFormData] = useState({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        province: '',
        municipality: '',
        barangay: '',
        address: '',
        password: '',
        password_confirmation: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

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
            newValue = normalizePhone(value);
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
                phone: formData.phone
            };
            const response = await api.post('/supplier/auth/register', dataToSubmit);
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
            const response = await api.post('/supplier/auth/resend-verification', { email: formData.email });
            setResendMsg(response.data.message);
        } catch (err) {
            setResendError(err.response?.data?.message || 'Failed to resend email.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Success Modal */}
            {!!successMsg && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: '90vw', maxWidth: 400, padding: '32px 28px 24px', position: 'relative', borderTop: '3px solid #F97316', textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <button
                            type="button"
                            onClick={() => navigate('/supplier/login')}
                            style={{ position: 'absolute', top: 12, right: 14, fontSize: 18, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                        >×</button>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF4ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Mail style={{ width: 22, height: 22, color: '#F97316' }} />
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Verify Your Email</div>
                        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
                            We've sent a verification link to <strong style={{ color: '#111827', fontWeight: 600 }}>{formData.email}</strong><br />
                            Check your inbox and click the link to activate your supplier account.
                        </div>
                        {resendMsg && (
                            <Alert className="bg-green-50 text-green-800 border-green-200 mb-3 text-left">
                                <AlertDescription>{resendMsg}</AlertDescription>
                            </Alert>
                        )}
                        {resendError && (
                            <Alert variant="destructive" className="mb-3 text-left">
                                <AlertDescription>{resendError}</AlertDescription>
                            </Alert>
                        )}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendLoading}
                            style={{ width: '100%', height: 42, background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: resendLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: resendLoading ? 0.75 : 1, transition: 'background 0.15s' }}
                            onMouseEnter={e => { if (!resendLoading) e.currentTarget.style.background = '#EA6C0A'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F97316'; }}
                        >
                            {resendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw style={{ width: 14, height: 14 }} />}
                            Resend Verification Link
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/supplier/login')}
                            style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', fontSize: 13, color: '#6B7280', cursor: 'pointer', padding: '6px 0' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.textDecoration = 'none'; }}
                        >
                            Return to Supplier Login
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex items-center justify-center p-8 overflow-y-auto">
                <div className="w-full max-w-lg">
                    <button
                        type="button"
                        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                        className="fixed top-6 left-6 z-50 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur hover:bg-white hover:text-gray-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div className="flex items-center gap-2.5 cursor-pointer mb-8" onClick={() => navigate('/')}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F97316] shadow-lg shadow-orange-200">
                            <span className="text-sm font-black text-white">H</span>
                        </div>
                        <div>
                            <span className="text-xl font-black text-gray-900">HRMS</span>
                            <span className="block text-[10px] text-gray-400 font-medium -mt-0.5 tracking-widest uppercase">Hardware Store</span>
                        </div>
                    </div>
                    <h1 className="text-[26px] font-black text-gray-900 tracking-tight mb-1">Supplier Registration</h1>
                    <p className="text-gray-500 mb-8">
                        Create your supplier account to manage catalog and purchase orders with HRMS.
                    </p>

                    {errors.form && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.form}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <Building2 className="h-4 w-4" /> Company Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Company Name *</Label>
                                    <Input name="name" type="text" value={formData.name} onChange={handleChange} required placeholder="Legal business name" className={errors.name ? 'border-red-500' : ''} />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <PhAddressFields
                                        province={formData.province}
                                        municipality={formData.municipality}
                                        barangay={formData.barangay}
                                        address={formData.address}
                                        onProvinceChange={name => setFormData(prev => ({ ...prev, province: name, municipality: '', barangay: '' }))}
                                        onMunicipalityChange={name => setFormData(prev => ({ ...prev, municipality: name, barangay: '' }))}
                                        onBarangayChange={name => setFormData(prev => ({ ...prev, barangay: name }))}
                                        onAddressChange={name => setFormData(prev => ({ ...prev, address: name }))}
                                        errors={{ province: errors.province, municipality: errors.municipality, barangay: errors.barangay, address: errors.address }}
                                        disabled={loading}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <User className="h-4 w-4" /> Primary Contact
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                                            <Input
                                                name="phone"
                                                type="tel"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required
                                                placeholder="09XXXXXXXXX"
                                                maxLength={11}
                                                inputMode="numeric"
                                                pattern="09[0-9]{9}"
                                                autoComplete="tel"
                                                className={`${errors.phone ? 'border-red-500' : ''}`}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Must be 11 digits starting with 09 (e.g. 09171234567).</p>
                                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Password *</Label>
                                        <div className="relative">
                                            <Input name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} onKeyDown={handleKeyDown} required placeholder="Min 8 chars, 1 letter, 1 number" className={`pr-11 ${errors.password ? 'border-red-500' : ''}`} />
                                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {capsWarning && <p className="text-xs text-orange-500 my-1 font-semibold">Caps Lock is on!</p>}
                                        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm Password *</Label>
                                        <div className="relative">
                                            <Input name="password_confirmation" type={showConfirm ? 'text' : 'password'} value={formData.password_confirmation} onChange={handleChange} required placeholder="Repeat password" className={`pr-11 ${errors.password_confirmation ? 'border-red-500' : ''}`} />
                                            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {errors.password_confirmation && <p className="text-sm text-red-500">{errors.password_confirmation}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={loading} className="w-full h-12 text-[15px] font-bold bg-[#F97316] hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25">
                            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</> : 'Create Supplier Account'}
                        </Button>

                        <div className="text-center text-sm text-muted-foreground">
                            Already a partner? <Link to="/login?role=supplier" className="text-primary font-semibold no-underline hover:underline">Sign In</Link>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    );
}
