import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mail, RefreshCw, Loader2, CheckCircle, AlertCircle, Upload, Bike } from 'lucide-react';
import { useFormValidation } from '../../hooks/useFormValidation';

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
        address: '',
        valid_id_type: 'Drivers License',
        id_number: '',
        emergency_contact: '',
    });
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
        <div className="min-h-screen flex">
            {/* Success Modal */}
            <Dialog open={!!successMsg} onOpenChange={(open) => { if (!open) navigate('/login') }}>
                <DialogContent className="sm:max-w-md border-primary/20 shadow-2xl overflow-hidden p-0">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400" />
                    <DialogHeader className="text-center pt-8 px-6">
                        <div className="mx-auto w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
                            <Mail className="w-8 h-8" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-foreground">Verify Your Email</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-[15px] leading-relaxed pt-2">
                            We've sent a verification link to <br/>
                            <span className="font-bold text-foreground">{form.email}</span>. <br/>
                            Check your inbox and click the link to activate your rider application.
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
                            <Button variant="ghost" className="w-full h-11" onClick={() => navigate('/login')}>
                                Return to Login
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Left - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
                <div className="w-full max-w-lg">
                    <div className="text-xl font-black text-foreground mb-6 cursor-pointer" onClick={() => navigate('/')}>HRMS</div>
                    <h1 className="text-2xl font-extrabold text-foreground mb-1">Rider Fleet Application</h1>
                    <p className="text-muted-foreground mb-8">Apply to become a professional logistics partner.</p>

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
                        {/* Driver Profile */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">👤 Driver Profile</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Full Legal Name *</Label>
                                    <Input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required placeholder="Enter your full name" className={errors.name ? 'border-red-500' : ''} />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Email Address *</Label>
                                        <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required placeholder="" className={errors.email ? 'border-red-500' : ''} />
                                        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Phone Number *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-sm text-muted-foreground">+63</span>
                                            <Input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required placeholder="9XXXXXXXXX" className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`} />
                                        </div>
                                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Current Residential Address *</Label>
                                    <Textarea value={form.address} onChange={(e) => handleChange('address', e.target.value)} required placeholder="Complete home address" rows={2} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>System Password *</Label>
                                        <Input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} onKeyDown={handleKeyDown} required placeholder="Min 8 chars, 1 letter, 1 number" className={errors.password ? 'border-red-500' : ''} />
                                        {capsWarning && <p className="text-xs text-orange-500 my-1 font-semibold">Caps Lock is on!</p>}
                                        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm Password *</Label>
                                        <Input type="password" value={form.password_confirmation} onChange={(e) => handleChange('password_confirmation', e.target.value)} required placeholder="Repeat password" className={errors.password_confirmation ? 'border-red-500' : ''} />
                                        {errors.password_confirmation && <p className="text-sm text-red-500">{errors.password_confirmation}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Logistics Equipment */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">🚛 Logistics Equipment</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Vehicle Category</Label>
                                        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.vehicle_type} onChange={(e) => setForm({...form, vehicle_type: e.target.value})}>
                                            <option value="Motorcycle">Motorcycle</option>
                                            <option value="Bicycle">Bicycle</option>
                                            <option value="Car">Car</option>
                                            <option value="Van/Truck">Van/Truck</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Vehicle Model</Label>
                                        <Input type="text" value={form.vehicle_model} onChange={(e) => setForm({...form, vehicle_model: e.target.value})} required placeholder="Honda TMX 155" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Plate Number</Label>
                                        <Input type="text" value={form.plate_number} onChange={(e) => setForm({...form, plate_number: e.target.value})} required placeholder="ABC-1234" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Emergency Contact</Label>
                                        <Input type="tel" value={form.emergency_contact} onChange={(e) => setForm({...form, emergency_contact: e.target.value})} required placeholder="09XXXXXXXXX" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Driver's License Number</Label>
                                    <Input type="text" value={form.license_number} onChange={(e) => setForm({...form, license_number: e.target.value})} required placeholder="NXX-XX-XXXXXX" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Verification ID Type</Label>
                                        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.valid_id_type} onChange={(e) => setForm({...form, valid_id_type: e.target.value})}>
                                            <option value="Drivers License">Drivers License</option>
                                            <option value="UMID">UMID</option>
                                            <option value="SSS">SSS</option>
                                            <option value="Passport">Passport</option>
                                            <option value="National ID">National ID</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>ID Number</Label>
                                        <Input type="text" value={form.id_number} onChange={(e) => setForm({...form, id_number: e.target.value})} required placeholder="ID Number" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>ID Image Upload</Label>
                                    <div className="relative">
                                        <Input type="file" onChange={handleFileChange} required accept="image/jpeg,image/png,image/jpg" className={`text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 ${errors.valid_id_file ? 'border-red-500' : ''}`} />
                                    </div>
                                    {errors.valid_id_file && <p className="text-sm text-red-500">{errors.valid_id_file}</p>}
                                </div>
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11" disabled={submitting}>
                            {submitting ? 'Processing Application...' : 'Submit Professional Application'}
                        </Button>

                        <div className="text-center text-sm text-muted-foreground">
                            Already have a rider account? <Link to="/login" className="text-primary font-semibold no-underline hover:underline">Rider Sign In</Link>
                        </div>
                    </form>
                </div>
            </div>
            
            {/* Right - Branding */}
            <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 text-white" style={{ backgroundImage: 'linear-gradient(rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0.9)), url("/images/hero-banner.png")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="max-w-md text-center">
                    <Bike className="h-16 w-16 mx-auto mb-6 text-white/80" />
                    <h2 className="text-2xl font-extrabold mb-3">Fleet Partnership</h2>
                    <p className="text-white/70 mb-8">Join our professional last-mile delivery fleet. High commission rates and automated route optimization.</p>
                    <div className="space-y-3 text-left">
                        {[
                            { n: '1', t: 'Application:', d: 'Submit your credentials.' },
                            { n: '2', t: 'Verification:', d: 'Document review by HR.' },
                            { n: '3', t: 'Screening:', d: 'Interview & Screening.' },
                            { n: '4', t: 'Deployment:', d: 'Start your first route.' },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">{s.n}</div>
                                <span className="text-sm text-white/80"><strong>{s.t}</strong> {s.d}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
