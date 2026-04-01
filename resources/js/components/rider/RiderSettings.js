import React, { useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle } from 'lucide-react';

const RiderSettings = ({ onBack }) => {
    const { user, setUser, refreshSettings } = useAuth();
    const [profileData, setProfileData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        address: user?.rider_profile?.address || user?.riderProfile?.address || ''
    });
    const [securityData, setSecurityData] = useState({
        current_password: '',
        password: '',
        password_confirmation: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.put('/riders/me/profile', profileData);
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            setUser(res.data.user);
            if (refreshSettings) refreshSettings();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('photo', file);

        setLoading(true);
        try {
            const res = await api.post('/riders/me/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage({ type: 'success', text: 'Photo updated successfully' });
            setUser(res.data.user);
            if (refreshSettings) refreshSettings();
        } catch (err) {
            setMessage({ type: 'error', text: 'Upload failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleSecurityUpdate = async (e) => {
        e.preventDefault();
        if (securityData.password !== securityData.password_confirmation) {
            setMessage({ type: 'error', text: 'Passwords match error' });
            return;
        }
        setLoading(true);
        try {
            await api.put('/riders/me/security', securityData);
            setMessage({ type: 'success', text: 'Password changed successfully' });
            setSecurityData({ current_password: '', password: '', password_confirmation: '' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Password update failed' });
        } finally {
            setLoading(false);
        }
    };

    const getPhotoUrl = () => {
        if (user?.photo) {
            return user.photo.startsWith('http') ? user.photo : `/storage/${user.photo}`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Rider')}&background=6366f1&color=fff&size=128`;
    };

    return (
        <main className="min-h-screen bg-secondary/30">
            <div className="max-w-xl mx-auto px-5 py-8">
                {/* Top Nav */}
                <nav className="mb-8">
                    <Button variant="ghost" className="gap-1.5 text-primary font-semibold" onClick={onBack} aria-label="Go back to dashboard">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                </nav>

                <header className="mb-8">
                    <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Settings</h1>
                    <p className="text-muted-foreground mt-1">Manage your profile and account security</p>
                </header>

                {message.text && (
                    <Card role="alert" className={`p-4 mb-6 flex items-center gap-3 font-medium text-sm ${
                        message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-destructive/5 border-destructive/20 text-destructive'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        {message.text}
                    </Card>
                )}

                <div className="space-y-8">
                    {/* Profile Section */}
                    <section aria-labelledby="profile-heading">
                        <Card className="p-6">
                            <h2 id="profile-heading" className="text-lg font-bold text-foreground mb-5">Personal Details</h2>

                            <div className="flex flex-col items-center mb-6">
                                <div className="relative">
                                    <img src={getPhotoUrl()} alt="Profile avatar" className="w-28 h-28 rounded-3xl object-cover border-4 border-white shadow-lg" />
                                    <label title="Change Photo" className="absolute -bottom-1 -right-1 bg-primary text-white w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer border-[3px] border-white shadow">
                                        <Camera className="h-4 w-4" />
                                        <input type="file" onChange={handlePhotoUpload} className="hidden" accept="image/*" aria-label="Upload profile photo" />
                                    </label>
                                </div>
                            </div>

                            <form onSubmit={handleProfileUpdate} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="full-name">Full Name</Label>
                                    <Input id="full-name" type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} placeholder="John Doe" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input id="phone" type="text" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} placeholder="+63 123 456 7890" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="address">Current Address</Label>
                                    <Textarea id="address" rows={3} value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} placeholder="Your residential address" className="resize-none" />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full mt-2">{loading ? 'Processing...' : 'Save Updates'}</Button>
                            </form>
                        </Card>
                    </section>

                    {/* Security Section */}
                    <section aria-labelledby="security-heading">
                        <Card className="p-6">
                            <h2 id="security-heading" className="text-lg font-bold text-foreground mb-5">Security</h2>
                            <form onSubmit={handleSecurityUpdate} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="current-pw">Current Password</Label>
                                    <Input id="current-pw" type="password" value={securityData.current_password} onChange={e => setSecurityData({...securityData, current_password: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="new-pw">New Password</Label>
                                    <Input id="new-pw" type="password" value={securityData.password} onChange={e => setSecurityData({...securityData, password: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="confirm-pw">Confirm New Password</Label>
                                    <Input id="confirm-pw" type="password" value={securityData.password_confirmation} onChange={e => setSecurityData({...securityData, password_confirmation: e.target.value})} />
                                </div>
                                <Button type="submit" variant="secondary" disabled={loading} className="w-full mt-2 bg-foreground text-white hover:bg-foreground/90">{loading ? 'Processing...' : 'Update Password'}</Button>
                            </form>
                        </Card>
                    </section>
                </div>
            </div>
        </main>
    );
};

export default RiderSettings;
