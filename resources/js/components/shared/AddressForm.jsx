import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    fetchRegions,
    fetchProvincesByRegion,
    fetchCitiesByProvince,
    fetchBarangaysByCity,
} from '../../services/psgcService';

// ---------------------------------------------------------------------------
// Zod schema — codes drive validation; names are auto-filled
// ---------------------------------------------------------------------------
const schema = z.object({
    region_code:   z.string().min(1, 'Region is required'),
    region_name:   z.string().min(1),
    province_code: z.string().min(1, 'Province is required'),
    province_name: z.string().min(1),
    city_code:     z.string().min(1, 'City / Municipality is required'),
    city_name:     z.string().min(1),
    barangay_code: z.string().min(1, 'Barangay is required'),
    barangay_name: z.string().min(1),
    street:        z.string().min(1, 'Street / Purok is required'),
    zip_code:      z.string()
        .regex(/^\d{4}$/, 'Enter a valid 4-digit ZIP code')
        .or(z.literal(''))
        .optional(),
});

const EMPTY = { region_code: '', region_name: '', province_code: '', province_name: '',
                city_code: '', city_name: '', barangay_code: '', barangay_name: '',
                street: '', zip_code: '' };

// ---------------------------------------------------------------------------
// Reusable dropdown field block
// ---------------------------------------------------------------------------
function AddressSelect({ label, required, isLoading, error, children }) {
    return (
        <div className="space-y-1.5">
            <Label className={error ? 'text-red-500' : ''}>
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {isLoading ? <Skeleton className="h-10 w-full rounded-md" /> : children}
            {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
/**
 * AddressForm
 *
 * Props:
 *   defaultValues  – pre-fill all address fields (for edit mode)
 *   onSubmit(data) – called with validated form data on submit
 *   disabled       – disables all fields
 *   submitLabel    – text for the submit button (default "Save Address")
 */
export default function AddressForm({
    defaultValues = {},
    onSubmit,
    disabled = false,
    submitLabel = 'Save Address',
}) {
    const [opts, setOpts]       = useState({ regions: [], provinces: [], cities: [], barangays: [] });
    const [loading, setLoading] = useState({ regions: true, provinces: false, cities: false, barangays: false });

    const {
        control,
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { ...EMPTY, ...defaultValues },
    });

    const regionCode   = watch('region_code');
    const provinceCode = watch('province_code');
    const cityCode     = watch('city_code');

    // ── Initial load: regions ─────────────────────────────────────────────
    useEffect(() => {
        setLoading(l => ({ ...l, regions: true }));
        fetchRegions()
            .then(d => setOpts(o => ({ ...o, regions: d || [] })))
            .catch(() => {})
            .finally(() => setLoading(l => ({ ...l, regions: false })));
    }, []);

    // ── Hydrate options when defaultValues codes are present ──────────────
    useEffect(() => {
        const { region_code: rc, province_code: pc, city_code: cc } = { ...EMPTY, ...defaultValues };
        if (!rc) return;
        setLoading(l => ({ ...l, provinces: true }));
        fetchProvincesByRegion(rc)
            .then(provinces => {
                setOpts(o => ({ ...o, provinces: provinces || [] }));
                if (!pc) return null;
                setLoading(l => ({ ...l, cities: true }));
                return fetchCitiesByProvince(pc).then(cities => {
                    setOpts(o => ({ ...o, cities: cities || [] }));
                    if (!cc) return;
                    setLoading(l => ({ ...l, barangays: true }));
                    return fetchBarangaysByCity(cc).then(barangays => {
                        setOpts(o => ({ ...o, barangays: barangays || [] }));
                    }).finally(() => setLoading(l => ({ ...l, barangays: false })));
                }).finally(() => setLoading(l => ({ ...l, cities: false })));
            })
            .catch(() => {})
            .finally(() => setLoading(l => ({ ...l, provinces: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Cascade: region → provinces ───────────────────────────────────────
    useEffect(() => {
        if (!regionCode) return;
        setLoading(l => ({ ...l, provinces: true }));
        setOpts(o => ({ ...o, provinces: [], cities: [], barangays: [] }));
        fetchProvincesByRegion(regionCode)
            .then(d => setOpts(o => ({ ...o, provinces: d || [] })))
            .catch(() => {})
            .finally(() => setLoading(l => ({ ...l, provinces: false })));
    }, [regionCode]);

    // ── Cascade: province → cities ────────────────────────────────────────
    useEffect(() => {
        if (!provinceCode) return;
        setLoading(l => ({ ...l, cities: true }));
        setOpts(o => ({ ...o, cities: [], barangays: [] }));
        fetchCitiesByProvince(provinceCode)
            .then(d => setOpts(o => ({ ...o, cities: d || [] })))
            .catch(() => {})
            .finally(() => setLoading(l => ({ ...l, cities: false })));
    }, [provinceCode]);

    // ── Cascade: city → barangays ─────────────────────────────────────────
    useEffect(() => {
        if (!cityCode) return;
        setLoading(l => ({ ...l, barangays: true }));
        setOpts(o => ({ ...o, barangays: [] }));
        fetchBarangaysByCity(cityCode)
            .then(d => setOpts(o => ({ ...o, barangays: d || [] })))
            .catch(() => {})
            .finally(() => setLoading(l => ({ ...l, barangays: false })));
    }, [cityCode]);

    // ── Reset helpers ─────────────────────────────────────────────────────
    const resetProvince  = () => { setValue('province_code', ''); setValue('province_name', ''); resetCity(); };
    const resetCity      = () => { setValue('city_code', ''); setValue('city_name', ''); resetBarangay(); };
    const resetBarangay  = () => { setValue('barangay_code', ''); setValue('barangay_name', ''); };

    const content = (side = 'bottom') => `position="popper" side="${side}" sideOffset={4}`;

    // ── JSX ───────────────────────────────────────────────────────────────
    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Region */}
            <AddressSelect label="Region" required isLoading={loading.regions} error={errors.region_code?.message}>
                <Controller
                    control={control}
                    name="region_code"
                    render={({ field }) => (
                        <Select
                            value={field.value}
                            onValueChange={code => {
                                field.onChange(code);
                                const found = opts.regions.find(r => r.code === code);
                                setValue('region_name', found?.name ?? '');
                                resetProvince();
                            }}
                            disabled={disabled}
                        >
                            <SelectTrigger className={`h-10 ${errors.region_code ? 'border-red-500' : ''}`}>
                                <SelectValue placeholder="Select Region" />
                            </SelectTrigger>
                            <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                {opts.regions.map(r => (
                                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </AddressSelect>

            {/* Province + City — 2-col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Province */}
                <AddressSelect label="Province" required isLoading={loading.provinces} error={errors.province_code?.message}>
                    <Controller
                        control={control}
                        name="province_code"
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={code => {
                                    field.onChange(code);
                                    const found = opts.provinces.find(p => p.code === code);
                                    setValue('province_name', found?.name ?? '');
                                    resetCity();
                                }}
                                disabled={disabled || !regionCode || loading.provinces}
                            >
                                <SelectTrigger className={`h-10 ${errors.province_code ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder={!regionCode ? 'Select Region first' : 'Select Province'} />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                    {opts.provinces.map(p => (
                                        <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </AddressSelect>

                {/* City / Municipality */}
                <AddressSelect label="City / Municipality" required isLoading={loading.cities} error={errors.city_code?.message}>
                    <Controller
                        control={control}
                        name="city_code"
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={code => {
                                    field.onChange(code);
                                    const found = opts.cities.find(c => c.code === code);
                                    setValue('city_name', found?.name ?? '');
                                    resetBarangay();
                                }}
                                disabled={disabled || !provinceCode || loading.cities}
                            >
                                <SelectTrigger className={`h-10 ${errors.city_code ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder={!provinceCode ? 'Select Province first' : 'Select City / Municipality'} />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                    {opts.cities.map(c => (
                                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </AddressSelect>
            </div>

            {/* Barangay */}
            <AddressSelect label="Barangay" required isLoading={loading.barangays} error={errors.barangay_code?.message}>
                <Controller
                    control={control}
                    name="barangay_code"
                    render={({ field }) => (
                        <Select
                            value={field.value}
                            onValueChange={code => {
                                field.onChange(code);
                                const found = opts.barangays.find(b => b.code === code);
                                setValue('barangay_name', found?.name ?? '');
                            }}
                            disabled={disabled || !cityCode || loading.barangays}
                        >
                            <SelectTrigger className={`h-10 ${errors.barangay_code ? 'border-red-500' : ''}`}>
                                <SelectValue placeholder={!cityCode ? 'Select City first' : 'Select Barangay'} />
                            </SelectTrigger>
                            <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                {opts.barangays.map(b => (
                                    <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </AddressSelect>

            {/* Street */}
            <div className="space-y-1.5">
                <Label className={errors.street ? 'text-red-500' : ''}>
                    House No. / Street / Purok <span className="text-red-500">*</span>
                </Label>
                <Controller
                    control={control}
                    name="street"
                    render={({ field }) => (
                        <Input
                            {...field}
                            placeholder="e.g. 123 Rizal St., Purok 4"
                            disabled={disabled}
                            className={`h-10 ${errors.street ? 'border-red-500' : ''}`}
                        />
                    )}
                />
                {errors.street && <p className="text-sm text-red-500">{errors.street.message}</p>}
            </div>

            {/* ZIP Code */}
            <div className="space-y-1.5 sm:w-1/2">
                <Label className={errors.zip_code ? 'text-red-500' : ''}>ZIP Code</Label>
                <Controller
                    control={control}
                    name="zip_code"
                    render={({ field }) => (
                        <Input
                            {...field}
                            placeholder="e.g. 2300"
                            maxLength={4}
                            disabled={disabled}
                            className={`h-10 ${errors.zip_code ? 'border-red-500' : ''}`}
                        />
                    )}
                />
                {errors.zip_code && <p className="text-sm text-red-500">{errors.zip_code.message}</p>}
            </div>

            {/* Submit */}
            <Button type="submit" disabled={disabled || isSubmitting} className="w-full h-11">
                {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
        </form>
    );
}
