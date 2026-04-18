import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { usePhilippineAddress } from '../../hooks/usePhilippineAddress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    User, Lock, ArrowLeft, Save, Eye, EyeOff,
    CheckCircle2, AlertCircle, Loader2, MapPin, ShieldCheck, Camera
} from 'lucide-react';

const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
];

function FieldGroup({ label, error, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">{label}</label>
            {children}
            {error && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />{error}
                </p>
            )}
        </div>
    );
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled }) {
    return (
        <input
            type={type}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#FF5A1F] focus:ring-2 focus:ring-[#FF5A1F]/10 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
    );
}

function SelectInput({ value, onChange, options, disabled }) {
    const placeholder = options.find(o => o.value === '')?.label ?? 'Select…';
    const items = options.filter(o => o.value !== '');
    return (
        <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:bg-white focus:border-[#FF5A1F] disabled:opacity-50 disabled:cursor-not-allowed">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                {items.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function PasswordInput({ value, onChange, placeholder, disabled }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#FF5A1F] focus:ring-2 focus:ring-[#FF5A1F]/10 outline-none transition-all disabled:opacity-50"
            />
            <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}

export default function CustomerSettings() {
    const { user, setUser } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const fileInputRef = useRef(null);

    // Photo state
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoError, setPhotoError] = useState(null);
    const [photoSuccess, setPhotoSuccess] = useState(false);

    const [provinceCode, setProvinceCode] = useState('');
    const [cityCode, setCityCode] = useState('');
    const { provinces, cities, barangays, loadingProvinces, loadingCities, loadingBarangays } = usePhilippineAddress('', provinceCode, cityCode);

    // Profile state
    const [profile, setProfile] = useState({
        name: '', phone: '', age: '', sex: '',
        address: '', landmark: '', province: '', municipality: '', barangay: '', zip_code: '',
    });
    const [originalProfile, setOriginalProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileErrors, setProfileErrors] = useState({});
    const [profileSuccess, setProfileSuccess] = useState(false);

    // Security state
    const [security, setSecurity] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [securitySaving, setSecuritySaving] = useState(false);
    const [securityErrors, setSecurityErrors] = useState({});
    const [securitySuccess, setSecuritySuccess] = useState(false);

    useEffect(() => {
        setProfileLoading(true);
        Promise.all([
            api.get('/customer/profile'),
        ]).then(([profileRes]) => {
            const p = profileRes.data?.data;
            const newProfile = {
                name: user?.name || '',
                phone: user?.phone || '',
                age: p?.age || '',
                sex: p?.sex || '',
                address: p?.address || '',
                landmark: p?.landmark || '',
                province: p?.province || '',
                municipality: p?.municipality || '',
                barangay: p?.barangay || '',
                zip_code: p?.zip_code || '',
            };
            setProfile(newProfile);
            setOriginalProfile(newProfile);
        }).catch(() => {
            const fallback = { name: user?.name || '', phone: user?.phone || '', age: '', sex: '', address: '', landmark: '', province: '', municipality: '', barangay: '', zip_code: '' };
            setProfile(fallback);
            setOriginalProfile(fallback);
        }).finally(() => setProfileLoading(false));
    }, [user]);

    useEffect(() => {
        if (profile.province && provinces.length > 0 && !provinceCode) {
            const found = provinces.find(p => p.name === profile.province);
            if (found) setProvinceCode(found.code);
        }
    }, [profile.province, provinces]);

    useEffect(() => {
        if (profile.municipality && cities.length > 0 && !cityCode) {
            const found = cities.find(c => c.name === profile.municipality);
            if (found) setCityCode(found.code);
        }
    }, [profile.municipality, cities]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileErrors({});
        setProfileSuccess(false);
        setProfileSaving(true);
        try {
            const res = await api.put('/customer/profile', profile);
            setProfileSuccess(true);
            setOriginalProfile({ ...profile });
            if (res?.data?.data?.name) setUser(prev => ({ ...prev, name: res.data.data.name, phone: res.data.data.phone }));
            setTimeout(() => setProfileSuccess(false), 4000);
        } catch (err) {
            if (err.response?.data?.errors) {
                setProfileErrors(err.response.data.errors);
            } else {
                setProfileErrors({ general: err.response?.data?.message || 'Failed to save profile.' });
            }
        } finally {
            setProfileSaving(false);
        }
    };

    const handleSecuritySave = async (e) => {
        e.preventDefault();
        setSecurityErrors({});
        setSecuritySuccess(false);

        if (security.password !== security.password_confirmation) {
            setSecurityErrors({ password_confirmation: ['Passwords do not match.'] });
            return;
        }
        if (security.password.length < 8) {
            setSecurityErrors({ password: ['Password must be at least 8 characters.'] });
            return;
        }

        setSecuritySaving(true);
        try {
            await api.put('/customer/change-password', security);
            setSecuritySuccess(true);
            setSecurity({ current_password: '', password: '', password_confirmation: '' });
            setTimeout(() => setSecuritySuccess(false), 4000);
        } catch (err) {
            if (err.response?.data?.errors) {
                setSecurityErrors(err.response.data.errors);
            } else {
                setSecurityErrors({ general: err.response?.data?.message || 'Failed to change password.' });
            }
        } finally {
            setSecuritySaving(false);
        }
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setPhotoError('Please select a valid image file.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setPhotoError('Image must be smaller than 2MB.');
            return;
        }
        setPhotoError(null);
        setPhotoSuccess(false);
        setPhotoPreview(URL.createObjectURL(file));

        const formData = new FormData();
        formData.append('photo', file);
        setPhotoUploading(true);
        try {
            const res = await api.post('/customer/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUser(function(prev) { return Object.assign({}, prev, { photo: res.data.photo_url }); });
            setPhotoSuccess(true);
            setTimeout(function() { setPhotoSuccess(false); }, 3000);
        } catch (err) {
            setPhotoError(err.response?.data?.message || 'Failed to upload photo.');
            setPhotoPreview(null);
        } finally {
            setPhotoUploading(false);
            e.target.value = '';
        }
    };

    const set = (key) => (val) => setProfile(p => ({ ...p, [key]: val }));

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <Link
                        to="/shop"
                        className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 tracking-tight">Account Settings</h1>
                        <p className="text-xs text-gray-500 font-medium hidden sm:block">Manage your profile and security</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                {/* Avatar card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex items-center gap-5">
                    {/* Avatar with upload */}
                    <div className="relative shrink-0">
                        <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[#FF5A1F] flex items-center justify-center shadow-lg shadow-orange-500/20">
                            {(photoPreview || user?.photo) ? (
                                <img
                                    src={photoPreview || user.photo}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-white font-black text-3xl">
                                    {(profile.name || user?.name || 'U').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={function() { fileInputRef.current && fileInputRef.current.click(); }}
                            disabled={photoUploading}
                            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-[#FF5A1F] hover:bg-orange-600 border-2 border-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
                            title="Change photo"
                        >
                            {photoUploading
                                ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                                : <Camera className="h-3.5 w-3.5 text-white" />
                            }
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="text-lg font-black text-gray-900 truncate">{profile.name || user?.name}</p>
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-orange-50 text-[#FF5A1F] text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-100">
                            Customer
                        </span>
                        {photoSuccess && (
                            <p className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Photo updated!
                            </p>
                        )}
                        {photoError && (
                            <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {photoError}
                            </p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">Click the camera icon to change photo · Max 2MB</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeTab === tab.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <form onSubmit={handleProfileSave}>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Section: Basic Info */}
                            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
                                <div className="flex items-center gap-2 mb-4">
                                    <User className="h-4 w-4 text-[#FF5A1F]" />
                                    <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Basic Information</h2>
                                </div>
                                {profileLoading ? (
                                    <div className="flex items-center gap-2 text-gray-400 py-4">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">Loading profile…</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FieldGroup label="Full Name" error={profileErrors.name?.[0]}>
                                            <TextInput value={profile.name} onChange={set('name')} placeholder="Your full name" disabled={profileSaving} />
                                        </FieldGroup>
                                        <FieldGroup label="Phone Number" error={profileErrors.phone?.[0]}>
                                            <TextInput value={profile.phone} onChange={set('phone')} placeholder="+63 9XX XXX XXXX" disabled={profileSaving} />
                                        </FieldGroup>
                                        <FieldGroup label="Age" error={profileErrors.age?.[0]}>
                                            <TextInput value={profile.age} onChange={set('age')} placeholder="e.g. 25" type="number" disabled={profileSaving} />
                                        </FieldGroup>
                                        <FieldGroup label="Sex" error={profileErrors.sex?.[0]}>
                                            <SelectInput
                                                value={profile.sex}
                                                onChange={set('sex')}
                                                disabled={profileSaving}
                                                options={[
                                                    { value: '', label: 'Prefer not to say' },
                                                    { value: 'male', label: 'Male' },
                                                    { value: 'female', label: 'Female' },
                                                    { value: 'other', label: 'Other' },
                                                ]}
                                            />
                                        </FieldGroup>
                                    </div>
                                )}
                            </div>

                            {/* Section: Address */}
                            <div className="px-6 pt-5 pb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="h-4 w-4 text-[#FF5A1F]" />
                                    <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Delivery Address</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FieldGroup label="Landmark" error={profileErrors.landmark?.[0]}>
                                        <TextInput value={profile.landmark} onChange={set('landmark')} placeholder="Nearby landmark" disabled={profileSaving} />
                                    </FieldGroup>
                                    <FieldGroup label="Municipality / City" error={profileErrors.municipality?.[0]}>
                                        <SelectInput
                                            value={cityCode}
                                            onChange={code => {
                                                const found = cities.find(c => c.code === code);
                                                setCityCode(code);
                                                setProfile(prev => ({ ...prev, municipality: found ? found.name : '', barangay: '' }));
                                            }}
                                            disabled={profileSaving || !provinceCode || loadingCities}
                                            options={[
                                                { value: '', label: !provinceCode ? 'Select Province first' : loadingCities ? 'Loading…' : 'Select Municipality / City' },
                                                ...cities.map(c => ({ value: c.code, label: c.name }))
                                            ]}
                                        />
                                    </FieldGroup>
                                    <FieldGroup label="Province" error={profileErrors.province?.[0]}>
                                        <SelectInput
                                            value={provinceCode}
                                            onChange={code => {
                                                const found = provinces.find(p => p.code === code);
                                                setProvinceCode(code);
                                                setCityCode('');
                                                setProfile(prev => ({ ...prev, province: found ? found.name : '', municipality: '', barangay: '' }));
                                            }}
                                            disabled={profileSaving || loadingProvinces}
                                            options={[
                                                { value: '', label: loadingProvinces ? 'Loading provinces…' : 'Select Province' },
                                                ...provinces.map(p => ({ value: p.code, label: p.name }))
                                            ]}
                                        />
                                    </FieldGroup>
                                    <FieldGroup label="Barangay" error={profileErrors.barangay?.[0]}>
                                        <SelectInput
                                            value={profile.barangay}
                                            onChange={set('barangay')}
                                            disabled={profileSaving || !cityCode || loadingBarangays}
                                            options={[
                                                { value: '', label: !cityCode ? 'Select Municipality first' : loadingBarangays ? 'Loading…' : 'Select Barangay' },
                                                ...barangays.map(b => ({ value: b.name, label: b.name }))
                                            ]}
                                        />
                                    </FieldGroup>
                                    <FieldGroup label="House No. / Street / Purok" error={profileErrors.address?.[0]}>
                                        <TextInput value={profile.address} onChange={set('address')} placeholder="e.g. 123 Rizal St., Purok 4" disabled={profileSaving} />
                                    </FieldGroup>
                                    <FieldGroup label="ZIP Code" error={profileErrors.zip_code?.[0]}>
                                        <TextInput value={profile.zip_code} onChange={set('zip_code')} placeholder="e.g. 8000" disabled={profileSaving} />
                                    </FieldGroup>
                                </div>
                            </div>
                        </div>

                        {/* Error banner */}
                        {profileErrors.general && (
                            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {profileErrors.general}
                            </div>
                        )}

                        {/* Success banner */}
                        {profileSuccess && (
                            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Profile updated successfully!
                            </div>
                        )}

                        <div className="mt-5 flex justify-end">
                            <button
                                type="submit"
                                disabled={profileSaving || profileLoading || !originalProfile || JSON.stringify(profile) === JSON.stringify(originalProfile)}
                                className="inline-flex items-center gap-2 h-10 px-6 bg-[#FF5A1F] hover:bg-orange-600 active:scale-95 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                                {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {profileSaving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <form onSubmit={handleSecuritySave}>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 pt-6 pb-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldCheck className="h-4 w-4 text-[#FF5A1F]" />
                                    <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Change Password</h2>
                                </div>
                                <p className="text-xs text-gray-500 mb-5 ml-6">Choose a strong password with at least 8 characters.</p>

                                <div className="flex flex-col gap-4 max-w-md">
                                    <FieldGroup label="Current Password" error={securityErrors.current_password?.[0]}>
                                        <PasswordInput
                                            value={security.current_password}
                                            onChange={v => setSecurity(s => ({ ...s, current_password: v }))}
                                            placeholder="Enter your current password"
                                            disabled={securitySaving}
                                        />
                                    </FieldGroup>

                                    <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
                                        <FieldGroup label="New Password" error={securityErrors.password?.[0]}>
                                            <PasswordInput
                                                value={security.password}
                                                onChange={v => setSecurity(s => ({ ...s, password: v }))}
                                                placeholder="At least 8 characters"
                                                disabled={securitySaving}
                                            />
                                        </FieldGroup>
                                        <FieldGroup label="Confirm New Password" error={securityErrors.password_confirmation?.[0]}>
                                            <PasswordInput
                                                value={security.password_confirmation}
                                                onChange={v => setSecurity(s => ({ ...s, password_confirmation: v }))}
                                                placeholder="Re-enter new password"
                                                disabled={securitySaving}
                                            />
                                        </FieldGroup>

                                        {/* Password match indicator */}
                                        {security.password && security.password_confirmation && (
                                            <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                                                security.password === security.password_confirmation ? 'text-green-600' : 'text-red-500'
                                            }`}>
                                                {security.password === security.password_confirmation
                                                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Passwords match</>
                                                    : <><AlertCircle className="h-3.5 w-3.5" /> Passwords do not match</>
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error banner */}
                        {securityErrors.general && (
                            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {securityErrors.general}
                            </div>
                        )}

                        {/* Success banner */}
                        {securitySuccess && (
                            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Password changed successfully!
                            </div>
                        )}

                        <div className="mt-5 flex justify-end">
                            <button
                                type="submit"
                                disabled={securitySaving || !security.current_password || !security.password || !security.password_confirmation}
                                className="inline-flex items-center gap-2 h-10 px-6 bg-[#FF5A1F] hover:bg-orange-600 active:scale-95 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                                {securitySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                {securitySaving ? 'Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
