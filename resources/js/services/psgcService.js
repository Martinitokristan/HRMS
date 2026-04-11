const BASE = 'https://psgc.gitlab.io/api';

async function get(path) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`PSGC API error ${res.status}: ${path}`);
    return res.json();
}

/** All regions */
export const fetchRegions = () =>
    get('/regions.json');

/** All provinces (no region filter) */
export const fetchAllProvinces = () =>
    get('/provinces.json');

/** Provinces filtered by region code */
export const fetchProvincesByRegion = (regionCode) =>
    get(`/regions/${regionCode}/provinces.json`);

/** Cities + municipalities under a province */
export const fetchCitiesByProvince = (provinceCode) =>
    get(`/provinces/${provinceCode}/cities-municipalities.json`);

/** Barangays under a city or municipality */
export const fetchBarangaysByCity = (cityCode) =>
    get(`/cities-municipalities/${cityCode}/barangays.json`);
