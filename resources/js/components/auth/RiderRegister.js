import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload } from 'lucide-react';

export default function RiderRegister() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        vehicle_type: 'Motorcycle',
        plate_number: '',
        license_number: '',
        address: '',
        valid_id_type: 'Drivers License',
    });
    const [idFile, setIdFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.password_confirmation) {
            showToast('Passwords do not match', 'error');
            return;
        }

        const formData = new FormData();
        Object.keys(form).forEach(key => formData.append(key, form[key]));
        formData.append('role', 'rider');
        if (idFile) formData.append('valid_id_file', idFile);

        setSubmitting(true);
        try {
            await axios.post('/auth/register', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('Application submitted! Please wait for admin review and interview schedule.', 'success');
            navigate('/login');
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
                    <h1 className="text-2xl font-extrabold text-foreground mb-1">Rider Fleet Application</h1>
                    <p className="text-muted-foreground mb-8">Apply to become a professional logistics partner.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Driver Profile */}
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">👤 Driver Profile</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Full Legal Name *</Label>
                                    <Input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required placeholder="Enter your full name" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Email Address *</Label>
                                        <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required placeholder="email@example.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Phone Number *</Label>
                                        <Input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} required placeholder="09XXXXXXXXX" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Current Residential Address *</Label>
                                    <Textarea value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} required placeholder="Complete home address" rows={2} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>System Password *</Label>
                                        <Input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required minLength="8" placeholder="Min 8 chars" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm Password *</Label>
                                        <Input type="password" value={form.password_confirmation} onChange={(e) => setForm({...form, password_confirmation: e.target.value})} required placeholder="Repeat password" />
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
                                        <Label>Plate Number</Label>
                                        <Input type="text" value={form.plate_number} onChange={(e) => setForm({...form, plate_number: e.target.value})} required placeholder="ABC-1234" />
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
                                        <Label>ID Image Upload</Label>
                                        <div className="relative">
                                            <Input type="file" onChange={(e) => setIdFile(e.target.files[0])} required accept="image/*" className="text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                                        </div>
                                    </div>
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
                    <div className="text-6xl mb-6">🛵</div>
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
