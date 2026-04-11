import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePhilippineAddress } from '../../hooks/usePhilippineAddress';

export function PhAddressFields({
    region       = '',
    province     = '',
    municipality = '',
    barangay     = '',
    address      = '',
    onRegionChange       = () => {},
    onProvinceChange,
    onMunicipalityChange,
    onBarangayChange,
    onAddressChange,
    errors   = {},
    disabled = false,
}) {
    const [regionCode,   setRegionCode]   = useState('');
    const [provinceCode, setProvinceCode] = useState('');
    const [cityCode,     setCityCode]     = useState('');

    const {
        regions, provinces, cities, barangays,
        loadingRegions, loadingProvinces, loadingCities, loadingBarangays,
    } = usePhilippineAddress(regionCode, provinceCode, cityCode);

    // Sync name → code for pre-populated values
    useEffect(() => {
        if (region && regions.length > 0 && !regionCode) {
            const found = regions.find(r => r.name === region);
            if (found) setRegionCode(found.code);
        }
    }, [region, regions]);

    useEffect(() => {
        if (province && provinces.length > 0 && !provinceCode) {
            const found = provinces.find(p => p.name === province);
            if (found) setProvinceCode(found.code);
        }
    }, [province, provinces]);

    useEffect(() => {
        if (municipality && cities.length > 0 && !cityCode) {
            const found = cities.find(c => c.name === municipality);
            if (found) setCityCode(found.code);
        }
    }, [municipality, cities]);

    const handleRegionChange = (code) => {
        const found = regions.find(r => r.code === code);
        setRegionCode(code);
        setProvinceCode('');
        setCityCode('');
        onRegionChange(found ? found.name : '');
        onProvinceChange('');
        onMunicipalityChange('');
        onBarangayChange('');
    };

    const handleProvinceChange = (code) => {
        const found = provinces.find(p => p.code === code);
        setProvinceCode(code);
        setCityCode('');
        onProvinceChange(found ? found.name : '');
        onMunicipalityChange('');
        onBarangayChange('');
    };

    const handleMunicipalityChange = (code) => {
        const found = cities.find(c => c.code === code);
        setCityCode(code);
        onMunicipalityChange(found ? found.name : '');
        onBarangayChange('');
    };

    const triggerCls = (hasErr) => `h-11 w-full text-sm ${hasErr ? 'border-red-500' : ''}`;

    return (
        <>
            {/* Region — full width, optional filter */}
            <div className="space-y-2 sm:col-span-2">
                <Label>Region <span className="text-xs text-muted-foreground font-normal">(optional — narrows province list)</span></Label>
                {loadingRegions ? (
                    <Skeleton className="h-11 w-full rounded-md" />
                ) : (
                    <Select value={regionCode} onValueChange={handleRegionChange} disabled={disabled}>
                        <SelectTrigger className={triggerCls(errors.region)}>
                            <SelectValue placeholder="Select Region" />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                            {regions.map(r => (
                                <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {errors.region && <p className="text-sm text-red-500">{errors.region}</p>}
            </div>

            {/* Province */}
            <div className="space-y-2">
                <Label>Province <span className="text-red-500">*</span></Label>
                {loadingProvinces ? (
                    <Skeleton className="h-11 w-full rounded-md" />
                ) : (
                    <Select value={provinceCode} onValueChange={handleProvinceChange} disabled={disabled}>
                        <SelectTrigger className={triggerCls(errors.province)}>
                            <SelectValue placeholder="Select Province" />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                            {provinces.map(p => (
                                <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {errors.province && <p className="text-sm text-red-500">{errors.province}</p>}
            </div>

            {/* Municipality / City */}
            <div className="space-y-2">
                <Label>Municipality / City <span className="text-red-500">*</span></Label>
                {loadingCities ? (
                    <Skeleton className="h-11 w-full rounded-md" />
                ) : (
                    <Select value={cityCode} onValueChange={handleMunicipalityChange} disabled={disabled || !provinceCode}>
                        <SelectTrigger className={triggerCls(errors.municipality)}>
                            <SelectValue placeholder={!provinceCode ? 'Select Province first' : 'Select Municipality / City'} />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                            {cities.map(c => (
                                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {errors.municipality && <p className="text-sm text-red-500">{errors.municipality}</p>}
            </div>

            {/* Barangay — full width */}
            <div className="space-y-2 sm:col-span-2">
                <Label>Barangay <span className="text-red-500">*</span></Label>
                {loadingBarangays ? (
                    <Skeleton className="h-11 w-full rounded-md" />
                ) : (
                    <Select value={barangay} onValueChange={onBarangayChange} disabled={disabled || !cityCode}>
                        <SelectTrigger className={triggerCls(errors.barangay)}>
                            <SelectValue placeholder={!cityCode ? 'Select Municipality first' : 'Select Barangay'} />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                            {barangays.map(b => (
                                <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {errors.barangay && <p className="text-sm text-red-500">{errors.barangay}</p>}
            </div>

            {/* House No. / Street — full width */}
            <div className="space-y-2 sm:col-span-2">
                <Label>House No. / Street / Purok <span className="text-red-500">*</span></Label>
                <Input
                    value={address}
                    onChange={e => onAddressChange(e.target.value)}
                    placeholder="e.g. 123 Rizal St., Purok 4"
                    required
                    disabled={disabled}
                    className={`h-11 ${errors.address ? 'border-red-500' : ''}`}
                />
                {errors.address && <p className="text-sm text-red-500">{errors.address}</p>}
            </div>
        </>
    );
}
