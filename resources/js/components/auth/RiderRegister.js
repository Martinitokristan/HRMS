import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mail, RefreshCw, Loader2, CheckCircle, AlertCircle, Upload, Bike, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useFormValidation } from '../../hooks/useFormValidation';
import { PhAddressFields } from '../shared/PhAddressFields';

export default function RiderRegister() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        vehicle_type: 'Motorcycle',
        vehicle_model: '',
        plate_number: '',
        license_number: '',
        province: '',
        municipality: '',
        barangay: '',
        address: '',
        valid_id_type: 'Drivers License',
        id_number: '',
        emergency_contact: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [idFile, setIdFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [successMsg, setSuccessMsg] = useState('');
    const [capsWarning, setCapsWarning] = useState(false);
    
    const { errors, validateName, validatePhone, validatePassword, validateIdFile, setError, clearError, clearAllErrors } = useFormValidation();

    const handleChange = (field, value) => {
        let newValue = value;
        if (field === 'phone') {
            newValue = value.replace(/\D/g, '').substring(0, 10);
        }
        setForm({ ...form, [field]: newValue });
        
        // Real-time validation
        let error = null;
        if (field === 'name') error = validateName(newValue);
        if (field === 'phone') error = validatePhone(newValue);
        if (field === 'password') error = validatePassword(newValue);
        
        if (error) {
            setError(field, error);
        } else {
            clearError(field);
        }

        if (field === 'password_confirmation') {
            if (newValue !== form.password) setError('password_confirmation', 'Passwords do not match');
            else clearError('password_confirmation');
        }
        if (field === 'password' && form.password_confirmation) {
            if (newValue !== form.password_confirmation) setError('password_confirmation', 'Passwords do not match');
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setIdFile(file);
        clearError('valid_id_file');
        
        const fileError = validateIdFile(file);
        if (fileError) {
            setError('valid_id_file', fileError);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setSuccessMsg('');
        
        const nameErr = validateName(form.name);
        const phoneErr = validatePhone(form.phone);
        const passErr = validatePassword(form.password);
        const idErr = validateIdFile(idFile);
        
        if (nameErr) setError('name', nameErr);
        if (phoneErr) setError('phone', phoneErr);
        if (passErr) setError('password', passErr);
        if (idErr) setError('valid_id_file', idErr);
        
        if (form.password !== form.password_confirmation) {
            setError('password_confirmation', 'Passwords do not match');
        }

        if (nameErr || phoneErr || passErr || idErr || form.password !== form.password_confirmation) {
            showToast('Please fix the validation errors.', 'error');
            return;
        }

        const formData = new FormData();
        Object.keys(form).forEach(key => {
            if (key === 'phone') {
                formData.append(key, `63${form[key]}`);
            } else {
                formData.append(key, form[key]);
            }
        });
        formData.append('role', 'rider');
        if (idFile) formData.append('valid_id_file', idFile);

        setSubmitting(true);
        try {
            await api.post('/auth/register', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccessMsg('Application submitted! Please check your email to verify your account.');
            showToast('Application submitted successfully!', 'success');
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Registration failed';
            showToast(errorMsg, 'error');
            setError('form', errorMsg);
            if (err.response?.data?.errors) {
                Object.keys(err.response.data.errors).forEach(key => {
                    setError(key, err.response.data.errors[key][0]);
                });
            }
        } finally {
            setSubmitting(false);
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
            const response = await api.post('/auth/resend-verification', { email: form.email });
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
                            onClick={() => navigate('/login')}
                            style={{ position: 'absolute', top: 12, right: 14, fontSize: 18, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                        >×</button>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF4ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Mail style={{ width: 22, height: 22, color: '#F97316' }} />
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Verify Your Email</div>
                        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
                            We've sent a verification link to <strong style={{ color: '#111827', fontWeight: 600 }}>{form.email}</strong><br />
                            Check your inbox and click the link to activate your rider application.
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
                            onClick={() => navigate('/login')}
                            style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', fontSize: 13, color: '#6B7280', cursor: 'pointer', padding: '6px 0' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.textDecoration = 'none'; }}
                        >
                            Return to Login
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
                    <h1 className="text-[28px] font-black text-gray-900 tracking-tight mb-1">Rider Registration</h1>
                    <p className="text-base text-gray-500 mb-8">Create your rider account to apply for delivery assignments.</p>

                    {errors.form && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.form}</AlertDescription>
                        </Alert>
                    )}

                    {successMsg && (
                        <Alert className="mb-6 bg-green-50 text-green-800 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <AlertDescription>{successMsg}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                    👤 Driver Profile
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-base font-medium">Full Legal Name *</Label>
                                    <Input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required placeholder="Enter your full name" className={`h-12 text-base ${errors.name ? 'border-red-500' : ''}`} />
                                    {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Email Address *</Label>
                                        <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required placeholder="" className={`h-12 text-base ${errors.email ? 'border-red-500' : ''}`} />
                                        {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Phone Number *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground font-medium" style={{pointerEvents:'none'}}>+63</span>
                                            <Input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required placeholder="9XXXXXXXXX" className={`h-12 pl-12 text-base ${errors.phone ? 'border-red-500' : ''}`} />
                                        </div>
                                        {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <PhAddressFields
                                        province={form.province}
                                        municipality={form.municipality}
                                        barangay={form.barangay}
                                        address={form.address}
                                        onProvinceChange={name => setForm(f => ({ ...f, province: name, municipality: '', barangay: '' }))}
                                        onMunicipalityChange={name => setForm(f => ({ ...f, municipality: name, barangay: '' }))}
                                        onBarangayChange={name => handleChange('barangay', name)}
                                        onAddressChange={name => handleChange('address', name)}
                                        errors={{ province: errors.province, municipality: errors.municipality, barangay: errors.barangay, address: errors.address }}
                                        disabled={submitting}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">System Password *</Label>
                                        <div className="relative">
                                            <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => handleChange('password', e.target.value)} onKeyDown={handleKeyDown} required placeholder="Min 8 chars, 1 letter, 1 number" className={`h-12 text-base pr-11 ${errors.password ? 'border-red-500' : ''}`} />
                                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                        {capsWarning && <p className="text-sm text-orange-500 my-1 font-semibold">⚠ Caps Lock is on!</p>}
                                        {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Confirm Password *</Label>
                                        <div className="relative">
                                            <Input type={showConfirm ? 'text' : 'password'} value={form.password_confirmation} onChange={(e) => handleChange('password_confirmation', e.target.value)} required placeholder="Repeat password" className={`h-12 text-base pr-11 ${errors.password_confirmation ? 'border-red-500' : ''}`} />
                                            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                        {errors.password_confirmation && <p className="text-sm text-red-500 mt-1">{errors.password_confirmation}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                    🚛 Logistics Equipment
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Vehicle Category</Label>
                                        <select className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.vehicle_type} onChange={(e) => setForm({...form, vehicle_type: e.target.value})}>
                                            <option value="Motorcycle">Motorcycle</option>
                                            <option value="Bicycle">Bicycle</option>
                                            <option value="Car">Car</option>
                                            <option value="Van/Truck">Van/Truck</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Vehicle Model</Label>
                                        <Input type="text" value={form.vehicle_model} onChange={(e) => setForm({...form, vehicle_model: e.target.value})} required placeholder="Honda TMX 155" className="h-12 text-base" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Plate Number</Label>
                                        <Input type="text" value={form.plate_number} onChange={(e) => setForm({...form, plate_number: e.target.value})} required placeholder="ABC-1234" className="h-12 text-base" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Emergency Contact</Label>
                                        <Input type="tel" value={form.emergency_contact} onChange={(e) => setForm({...form, emergency_contact: e.target.value})} required placeholder="09XXXXXXXXX" className="h-12 text-base" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-base font-medium">Driver's License Number</Label>
                                    <Input type="text" value={form.license_number} onChange={(e) => setForm({...form, license_number: e.target.value})} required placeholder="NXX-XX-XXXXXX" className="h-12 text-base" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">Verification ID Type</Label>
                                        <select className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.valid_id_type} onChange={(e) => setForm({...form, valid_id_type: e.target.value})}>
                                            <option value="Drivers License">Drivers License</option>
                                            <option value="UMID">UMID</option>
                                            <option value="SSS">SSS</option>
                                            <option value="Passport">Passport</option>
                                            <option value="National ID">National ID</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-base font-medium">ID Number</Label>
                                        <Input type="text" value={form.id_number} onChange={(e) => setForm({...form, id_number: e.target.value})} required placeholder="ID Number" className="h-12 text-base" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-base font-medium">ID Image Upload</Label>
                                    <div className="relative">
                                        <Input type="file" onChange={handleFileChange} required accept="image/jpeg,image/png,image/jpg" className={`text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 ${errors.valid_id_file ? 'border-red-500' : ''}`} />
                                    </div>
                                    {errors.valid_id_file && <p className="text-sm text-red-500">{errors.valid_id_file}</p>}
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={submitting} className="w-full h-12 text-[15px] font-bold bg-[#F97316] hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25">
                            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</> : 'Create Rider Account'}
                        </Button>

                        <div className="text-center text-base text-muted-foreground">
                            Already have a rider account? <Link to="/login" className="text-primary font-semibold no-underline hover:underline">Rider Sign In</Link>
                        </div>
                    </form>
                </div>
            </div>
            
        </div>
    );
}
