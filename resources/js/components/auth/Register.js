import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mail, RefreshCw, Loader2, CheckCircle, AlertCircle, UserPlus, MapPin, Shield, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useFormValidation } from '../../hooks/useFormValidation';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to center map when coordinates change
function MapController({ center, zoom, onMapClick }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, zoom);
    }, [center, zoom, map]);

    useMapEvents({
        click: onMapClick,
    });
    return null;
}

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const { errors, validateName, validatePhone, validatePassword, setError, clearError, clearAllErrors } = useFormValidation();

    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', password: '', password_confirmation: '',
        age: '', sex: '', province: '', municipality: '', zip_code: '',
        address: '', landmark: '', latitude: '', longitude: ''
    });

    const [loading, setLoading] = useState(false);

    const [successMsg, setSuccessMsg] = useState('');
    const [capsWarning, setCapsWarning] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [pinnedAddressDetails, setPinnedAddressDetails] = useState('');
    const [mapCenter, setMapCenter] = useState([8.9475, 125.5406]); // Default Butuan City

    // Function to search coordinates based on address
    const handleGeocode = async () => {
        const query = formData.address 
            ? `${formData.address}, ${formData.municipality}, ${formData.province}, Philippines`
            : `${formData.municipality}, ${formData.province}, Philippines`;
            
        if (formData.municipality.length < 3) {
            alert("Please enter a Municipality/City first.");
            return;
        }

        setIsGeocoding(true);
        try {
            // Internal logic: Try full address, then fallback to city
            let response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            
            if (!response.data || response.data.length === 0) {
                const fallbackQuery = `${formData.municipality}, ${formData.province}, Philippines`;
                response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}`);
            }

            if (response.data && response.data.length > 0) {
                const { lat, lon } = response.data[0];
                const newCoords = { lat: parseFloat(lat), lon: parseFloat(lon) };
                setFormData(prev => ({ ...prev, latitude: newCoords.lat, longitude: newCoords.lon }));
                setMapCenter([newCoords.lat, newCoords.lon]);
                setPinnedAddressDetails(response.data[0].display_name);
            } else {
                alert("Location not found. Please click on the map manually to pin your location.");
                // Center on a rough Filipino coordinate if totally lost
                setMapCenter([8.9475, 125.5406]); 
            }
        } catch (error) {
            console.error("Geocoding failed:", error);
        } finally {
            setIsGeocoding(false);
        }
    };

    // Reverse Geocode to get address for a given lat/lon
    const reverseGeocode = async (lat, lon) => {
        try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            if (res.data && res.data.display_name) {
                setPinnedAddressDetails(res.data.display_name);
                if (res.data.address && res.data.address.postcode && !formData.zip_code) {
                    setFormData(prev => ({ ...prev, zip_code: res.data.address.postcode }));
                }
            } else {
                setPinnedAddressDetails('Location pinned on map');
            }
        } catch (error) {
            setPinnedAddressDetails('Location pinned on map');
        }
    };

    // Handle manual map click
    const handleMapClick = (e) => {
        const { lat, lng } = e.latlng;
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        reverseGeocode(lat, lng);
    };

    // Update coordinates when marker is dragged
    const onMarkerDragEnd = (e) => {
        const { lat, lng } = e.target.getLatLng();
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        reverseGeocode(lat, lng);
    };

    // Get current GPS location
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setFormData(prev => ({ ...prev, latitude, longitude }));
                setMapCenter([latitude, longitude]);
                reverseGeocode(latitude, longitude);
                setGpsLoading(false);
            },
            (error) => {
                alert('Unable to retrieve your location. Please check your browser permissions.');
                setGpsLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        let newValue = value;
        if (name === 'phone') {
            // Only allow 10 digits
            newValue = value.replace(/\D/g, '').substring(0, 10);
        }

        setFormData({ ...formData, [name]: newValue });

        // Real-time validation
        let error = null;
        if (name === 'name') error = validateName(newValue);
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
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMsg, setResendMsg] = useState('');
    const [resendError, setResendError] = useState('');

    const handleResend = async () => {
        setResendLoading(true);
        setResendMsg('');
        setResendError('');
        try {
            const response = await axios.post('/auth/resend-verification', { email: formData.email });
            setResendMsg(response.data.message);
        } catch (err) {
            setResendError(err.response?.data?.message || 'Failed to resend email.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('form', '');
        clearAllErrors();
        setSuccessMsg('');

        const nameErr = validateName(formData.name);
        const phoneErr = validatePhone(formData.phone);
        const passErr = validatePassword(formData.password);

        if (nameErr) setError('name', nameErr);
        if (phoneErr) setError('phone', phoneErr);
        if (passErr) setError('password', passErr);

        if (formData.password !== formData.password_confirmation) {
            setError('password_confirmation', 'Passwords do not match');
        }

        if (nameErr || phoneErr || passErr || formData.password !== formData.password_confirmation) {
            return;
        }

        setLoading(true);

        try {
            const dataToSubmit = {
                ...formData,
                phone: `63${formData.phone}` // Add the PH country code
            };
            await register(dataToSubmit);
            setSuccessMsg('Account created successfully! Please check your email to verify your account.');
        } catch (err) {
            setError('form', err.response?.data?.message || 'Registration failed.');
            if (err.response?.data?.errors) {
                // Set server validation errors
                Object.keys(err.response.data.errors).forEach(key => {
                    setError(key, err.response.data.errors[key][0]);
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
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
                            We've sent a verification link to <br />
                            <span className="font-bold text-foreground">{formData.email}</span>. <br />
                            Check your inbox and click the link to activate your account.
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

                    {errors.form && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.form}</AlertDescription>
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
                                    <Input id="name" name="name" type="text" value={formData.name} required onChange={handleChange} placeholder="First & Last Name" className={`h-11 ${errors.name ? 'border-red-500' : ''}`} />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-email">Email Address</Label>
                                        <Input id="reg-email" name="email" type="email" value={formData.email} required onChange={handleChange} placeholder="name@email.com" className={`h-11 ${errors.email ? 'border-red-500' : ''}`} />
                                        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-sm text-muted-foreground">+63</span>
                                            <Input id="phone" name="phone" type="tel" value={formData.phone} required onChange={handleChange} placeholder="9XXXXXXXXX" className={`h-11 pl-10 ${errors.phone ? 'border-red-500' : ''}`} />
                                        </div>
                                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-password">Password</Label>
                                        <Input id="reg-password" name="password" type="password" required value={formData.password} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Min 8 chars, 1 letter, 1 number" className={`h-11 ${errors.password ? 'border-red-500' : ''}`} />
                                        {capsWarning && <p className="text-xs text-orange-500 my-1 font-semibold">Caps Lock is on!</p>}
                                        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-confirm">Confirm Password</Label>
                                        <Input id="reg-confirm" name="password_confirmation" type="password" value={formData.password_confirmation} required onChange={handleChange} placeholder="Repeat password" className={`h-11 ${errors.password_confirmation ? 'border-red-500' : ''}`} />
                                        {errors.password_confirmation && <p className="text-sm text-red-500">{errors.password_confirmation}</p>}
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
                                        <Input id="province" name="province" type="text" required onChange={handleChange} placeholder="e.g. Davao del Sur" className={`h-11 ${errors.province ? 'border-red-500' : ''}`} />
                                        {errors.province && <p className="text-sm text-red-500">{errors.province}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="municipality">Municipality/City</Label>
                                        <Input id="municipality" name="municipality" type="text" required onChange={handleChange} placeholder="e.g. Davao City" className={`h-11 ${errors.municipality ? 'border-red-500' : ''}`} />
                                        {errors.municipality && <p className="text-sm text-red-500">{errors.municipality}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Specific Address (House #, Street, Barangay)</Label>
                                    <Input id="address" name="address" type="text" required onChange={handleChange} placeholder="Full address details" className={`h-11 ${errors.address ? 'border-red-500' : ''}`} />
                                    {errors.address && <p className="text-sm text-red-500">{errors.address}</p>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="zip_code">Zip / Postal Code</Label>
                                        <Input id="zip_code" name="zip_code" type="text" required onChange={handleChange} placeholder="e.g. 8600" className={`h-11 ${errors.zip_code ? 'border-red-500' : ''}`} />
                                        {errors.zip_code && <p className="text-sm text-red-500">{errors.zip_code}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="landmark">Landmark / Delivery Instructions</Label>
                                        <Input id="landmark" name="landmark" type="text" onChange={handleChange} placeholder="Optional: e.g. Near Blue Gate" className={`h-11 ${errors.landmark ? 'border-red-500' : ''}`} />
                                        {errors.landmark && <p className="text-sm text-red-500">{errors.landmark}</p>}
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-bold text-primary flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Pin Delivery Location
                                        </Label>
                                        <div className="flex gap-2">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleGetLocation}
                                                disabled={gpsLoading || !formData.province || !formData.municipality || !formData.address}
                                                className="text-xs h-8 px-3 font-semibold text-primary"
                                                title="Type your address first to use GPS Auto-Locate"
                                            >
                                                {gpsLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Navigation className="h-3 w-3 mr-1" />}
                                                Use Current GPS
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground italic">
                                        Manual: Click on the map or drag the pin to your exact delivery spot.
                                    </p>
                                    <div className="h-[220px] w-full rounded-xl border-2 border-primary/20 overflow-hidden relative shadow-inner cursor-crosshair">
                                        <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                                            <MapController center={mapCenter} zoom={15} onMapClick={handleMapClick} />
                                            <TileLayer 
                                                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
                                                attribution="&copy; Google Maps" 
                                            />
                                            <Marker 
                                                position={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : mapCenter} 
                                                draggable={true}
                                                eventHandlers={{ dragend: onMarkerDragEnd }}
                                            />
                                        </MapContainer>
                                        {!formData.latitude && !formData.address && (
                                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-4 text-center">
                                                <div className="bg-white p-4 rounded-xl shadow-lg border border-primary/10">
                                                    <MapPin className="h-8 w-8 text-primary mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm font-bold text-foreground">Set Address First</p>
                                                    <p className="text-[11px] text-muted-foreground">Then use 'Use Current GPS' or click the map manually.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {pinnedAddressDetails && (
                                        <div className="text-xs p-2.5 bg-green-50/50 text-green-800 border-l-4 border-green-500 rounded-lg mt-2 flex items-start gap-2 shadow-sm">
                                            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                                            <div>
                                                <span className="font-bold block text-green-900 mb-0.5">Pinned Location Detected:</span>
                                                <span className="text-green-700/90 leading-relaxed">{pinnedAddressDetails}</span>
                                            </div>
                                        </div>
                                    )}
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
                                <CheckCircle className="h-4 w-4 text-slate-500 shrink-0" />
                                <span className="text-sm font-semibold">{feat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
