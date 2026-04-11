import { useState, useEffect } from 'react';
import {
    fetchRegions,
    fetchAllProvinces,
    fetchProvincesByRegion,
    fetchCitiesByProvince,
    fetchBarangaysByCity,
} from '../services/psgcService';

/**
 * Cascading Philippine address hook.
 * @param {string} regionCode   - PSGC region code; when empty, all provinces load.
 * @param {string} provinceCode - PSGC province code.
 * @param {string} cityCode     - PSGC city/municipality code.
 */
export function usePhilippineAddress(regionCode = '', provinceCode = '', cityCode = '') {
    const [regions,   setRegions]   = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities,    setCities]    = useState([]);
    const [barangays, setBarangays] = useState([]);

    const [loadingRegions,   setLoadingRegions]   = useState(true);
    const [loadingProvinces, setLoadingProvinces] = useState(true);
    const [loadingCities,    setLoadingCities]    = useState(false);
    const [loadingBarangays, setLoadingBarangays] = useState(false);

    // Regions — always fetch once on mount
    useEffect(() => {
        let cancelled = false;
        setLoadingRegions(true);
        fetchRegions()
            .then(d => { if (!cancelled) setRegions(d || []); })
            .catch(() => { if (!cancelled) setRegions([]); })
            .finally(() => { if (!cancelled) setLoadingRegions(false); });
        return () => { cancelled = true; };
    }, []);

    // Provinces — filtered by region, or all when regionCode is empty
    useEffect(() => {
        let cancelled = false;
        setLoadingProvinces(true);
        const request = regionCode
            ? fetchProvincesByRegion(regionCode)
            : fetchAllProvinces();
        request
            .then(d => { if (!cancelled) setProvinces(d || []); })
            .catch(() => { if (!cancelled) setProvinces([]); })
            .finally(() => { if (!cancelled) setLoadingProvinces(false); });
        return () => { cancelled = true; };
    }, [regionCode]);

    // Cities/Municipalities — dependent on province
    useEffect(() => {
        if (!provinceCode) { setCities([]); return; }
        let cancelled = false;
        setLoadingCities(true);
        fetchCitiesByProvince(provinceCode)
            .then(d => { if (!cancelled) setCities(d || []); })
            .catch(() => { if (!cancelled) setCities([]); })
            .finally(() => { if (!cancelled) setLoadingCities(false); });
        return () => { cancelled = true; };
    }, [provinceCode]);

    // Barangays — dependent on city
    useEffect(() => {
        if (!cityCode) { setBarangays([]); return; }
        let cancelled = false;
        setLoadingBarangays(true);
        fetchBarangaysByCity(cityCode)
            .then(d => { if (!cancelled) setBarangays(d || []); })
            .catch(() => { if (!cancelled) setBarangays([]); })
            .finally(() => { if (!cancelled) setLoadingBarangays(false); });
        return () => { cancelled = true; };
    }, [cityCode]);

    return {
        regions, provinces, cities, barangays,
        loadingRegions, loadingProvinces, loadingCities, loadingBarangays,
    };
}
