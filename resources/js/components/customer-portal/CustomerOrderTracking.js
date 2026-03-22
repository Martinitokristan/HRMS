import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Custom styles
const trackingStyles = `
    .customer-marker-blob {
        width: 32px;
        height: 32px;
        background: #10b981;
        border: 4px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .rider-marker-blob {
        width: 34px;
        height: 34px;
        background: #f59e0b;
        border: 4px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        transition: transform 0.3s ease-out;
    }
    @keyframes rider-pulse {
        0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
        100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
    }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = trackingStyles;
    document.head.appendChild(styleSheet);
}

// Function to create icons with dynamic rotation
const createRiderIcon = (heading = 0) => L.divIcon({
    html: `<div class="rider-marker-blob" style="transform: rotate(${heading}deg)">🏍️</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    className: ''
});

const customerIcon = L.divIcon({
    html: '<div class="customer-marker-blob">🏠</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: ''
});

const MapBounds = ({ customerPos, riderPos }) => {
    const map = useMap();
    const hasFittedBounds = useRef(false);
    useEffect(() => {
        if (customerPos && riderPos && !hasFittedBounds.current) {
            const bounds = L.latLngBounds([customerPos, riderPos]);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            hasFittedBounds.current = true;
        }
    }, [customerPos, riderPos, map]);
    return null;
};

const CustomerOrderTracking = ({ delivery }) => {
    const { user } = useAuth();
    const [riderLocation, setRiderLocation] = useState({
        latitude: delivery.latitude || 7.0543,
        longitude: delivery.longitude || 125.5947,
        heading: 0,
        updated_at: new Date().toISOString()
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [roadRoute, setRoadRoute] = useState(null);
    const routeCacheRef = useRef(new Map());
    const pollingIntervalRef = useRef(null);

    // Initial rider location fetch
    const fetchRiderLocation = useCallback(async () => {
        try {
            const response = await axios.get(`/customer/delivery/${delivery.id}/rider-location`);
            if (response.data.data) {
                setRiderLocation(response.data.data);
            }
            setLoading(false);
        } catch (err) {
            console.error('Failed to load rider location:', err);
            setLoading(false);
        }
    }, [delivery.id]);

    // WebSocket connection for real-time updates
    useEffect(() => {
        if (!delivery || !delivery.tracking_number) return;

        fetchRiderLocation();

        let interval = null;
        // Since WebSocket server is not running on port 8000, we use polling directly
        interval = setInterval(fetchRiderLocation, 5000);

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [delivery.tracking_number, fetchRiderLocation]);

    // Get real road route using backend proxy
    const getRoadRoute = useCallback(async (startLat, startLon, endLat, endLon) => {
        const startLatNum = parseFloat(startLat);
        const startLonNum = parseFloat(startLon);
        const endLatNum = parseFloat(endLat);
        const endLonNum = parseFloat(endLon);
        
        const cacheKey = `${startLatNum.toFixed(6)},${startLonNum.toFixed(6)}-${endLatNum.toFixed(6)},${endLonNum.toFixed(6)}`;
        
        if (routeCacheRef.current.has(cacheKey)) {
            return routeCacheRef.current.get(cacheKey);
        }
        
        try {
            const response = await axios.post('/route', {
                start_lat: startLatNum,
                start_lon: startLonNum,
                end_lat: endLatNum,
                end_lon: endLonNum
            });
            
            const data = response.data;
            
            if (data.features && data.features.length > 0) {
                const route = data.features[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
                const routeData = {
                    coordinates: route,
                    distance: data.features[0].properties.segments[0].distance,
                    duration: data.features[0].properties.segments[0].duration
                };
                
                routeCacheRef.current.set(cacheKey, routeData);
                return routeData;
            }
            return null;
        } catch (error) {
            console.error('Failed to get road route:', error);
            return null;
        }
    }, []);

    const customerPosition = [delivery.latitude || 7.0543, delivery.longitude || 125.5947];
    const riderPosition = [riderLocation.latitude, riderLocation.longitude];

    // Fetch road route when rider location changes
    useEffect(() => {
        if (!riderLocation.latitude || !riderLocation.longitude) return;

        const updateRoute = async () => {
            const route = await getRoadRoute(
                riderLocation.latitude, riderLocation.longitude,
                customerPosition[0], customerPosition[1]
            );
            if (route) {
                setRoadRoute(route);
            }
        };

        updateRoute();
    }, [riderLocation.latitude, riderLocation.longitude, customerPosition[0], customerPosition[1], getRoadRoute]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-4">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || !riderLocation) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Order Tracking</h3>
                <p className="text-sm text-gray-600">
                    {error || 'Rider location not available yet'}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-1">Live Order Tracking</h3>
                <p className="text-sm text-gray-600">
                    Tracking #{delivery.tracking_number} • Last updated: {new Date(riderLocation.updated_at).toLocaleTimeString()}
                </p>
            </div>
            
            <div className="h-64">
                <MapContainer 
                    center={customerPosition} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                >
                    <TileLayer 
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        attribution="&copy; Google Maps"
                    />
                    
                    {/* Customer location */}
                    <Marker position={customerPosition} icon={customerIcon}>
                        <Popup>Your delivery address</Popup>
                    </Marker>
                    
                    {/* Rider location */}
                    <Marker position={riderPosition} icon={createRiderIcon(riderLocation.heading)}>
                        <Popup>Rider is here</Popup>
                    </Marker>
                    
                    {/* Route line */}
                    {roadRoute && roadRoute.coordinates ? (
                        <Polyline
                            positions={roadRoute.coordinates}
                            color="#10b981"
                            weight={4}
                            opacity={0.8}
                        />
                    ) : (
                        <Polyline
                            positions={[riderPosition, customerPosition]}
                            color="#10b981"
                            weight={4}
                            opacity={0.8}
                            dashArray="5, 5"
                        />
                    )}

                    <MapBounds customerPos={customerPosition} riderPos={riderPosition} />
                </MapContainer>
            </div>
            
            <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600">Your Location</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-gray-600">Rider (Live)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerOrderTracking;
