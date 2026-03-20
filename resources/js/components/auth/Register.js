import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, CheckCircle, AlertCircle, Loader2, MapPin, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', password: '', password_confirmation: '',
        age: '', sex: '', province: '', municipality: '', zip_code: '',
        address: '', landmark: '', latitude: '', longitude: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await register(formData);
            navigate('/shop');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left - Form */}
            <div className="flex flex-1 items-center justify-center px-6 py-10 bg-card overflow-y-auto">
                <div className="w-full max-w-[580px]">
                    <div className="flex items-center gap-2 cursor-pointer mb-8" onClick={() => navigate('/')}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                            <span className="text-sm font-black text-primary-foreground">H</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-foreground">
                            HRMS <span className="text-primary">Pro</span>
                        </span>
                    </div>

                    <h1 className="text-[26px] font-black text-foreground tracking-tight mb-2">Create Customer Account</h1>
                    <p className="text-sm text-muted-foreground mb-8">Enter your details to start ordering high-quality supplies.</p>

                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Account Security */}
                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <Shield className="h-4 w-4 text-primary" />
                                    Account Security
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Username / Display Name</Label>
                                    <Input id="name" name="name" type="text" required onChange={handleChange} placeholder="First & Last Name" className="h-11" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-email">Email Address</Label>
                                        <Input id="reg-email" name="email" type="email" required onChange={handleChange} placeholder="name@email.com" className="h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input id="phone" name="phone" type="tel" required onChange={handleChange} placeholder="09xxxxxxxxx" className="h-11" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-password">Password</Label>
                                        <Input id="reg-password" name="password" type="password" required minLength={8} onChange={handleChange} placeholder="Min 8 chars" className="h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-confirm">Confirm Password</Label>
                                        <Input id="reg-confirm" name="password_confirmation" type="password" required minLength={8} onChange={handleChange} placeholder="Repeat password" className="h-11" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Shipment Details */}
                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    Shipment Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="province">Province</Label>
                                        <Input id="province" name="province" type="text" required onChange={handleChange} placeholder="e.g. Davao del Sur" className="h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="municipality">Municipality/City</Label>
                                        <Input id="municipality" name="municipality" type="text" required onChange={handleChange} placeholder="e.g. Davao City" className="h-11" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Specific Address (House #, Street, Barangay)</Label>
                                    <Input id="address" name="address" type="text" required onChange={handleChange} placeholder="Full address details" className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="landmark">Landmark / Delivery Instructions</Label>
                                    <Input id="landmark" name="landmark" type="text" onChange={handleChange} placeholder="Optional: e.g. Near Blue Gate" className="h-11" />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="text-center space-y-4">
                            <Button type="submit" disabled={loading} className="w-full max-w-[340px] mx-auto h-12 text-[15px] font-bold shadow-md shadow-primary/20">
                                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Account...</> : 'Join as Active Customer'}
                            </Button>

                            <p className="text-sm text-muted-foreground">
                                Already registered? <Link to="/login" className="font-bold text-primary hover:underline">Sign In</Link>
                            </p>
                            <Separator />
                            <Link to="/rider/register" className="text-sm font-bold text-primary hover:underline inline-block">
                                Apply as Delivery Rider &rarr;
                            </Link>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right - Promo */}
            <div className="hidden lg:flex flex-col items-center justify-center w-[480px] xl:w-[520px] p-12 text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' }}
            >
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, #FF6B35, transparent 60%)' }} />
                <div className="relative z-10 text-center max-w-sm">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 mx-auto mb-8">
                        <UserPlus className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-black mb-3">Industrial Access</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        Register to unlock our complete catalog of professional construction materials and logistics services.
                    </p>
                    <div className="space-y-3 text-left">
                        {['Direct Warehouse Pricing', 'Live GPS Order Tracking', 'Secure Digital Invoicing'].map((feat, i) => (
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
