import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
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

// Custom icons
const customerIcon = L.divIcon({
    html: '🏠',
    iconSize: [30, 30],
    className: 'customer-location-marker'
});

const riderIcon = L.divIcon({
    html: '🏍️',
    iconSize: [30, 30],
    className: 'rider-location-marker'
});

// Custom styles
const trackingStyles = `
    .customer-location-marker {
        background: #10b981;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .rider-location-marker {
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
    }
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = trackingStyles;
    document.head.appendChild(styleSheet);
}

const CustomerOrderTracking = ({ delivery }) => {
    const { user } = useAuth();
    const [riderLocation, setRiderLocation] = useState({
        latitude: 7.0543,
        longitude: 125.5947,
        updated_at: new Date().toISOString()
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // WebSocket connection for real-time updates
    useEffect(() => {
        if (!delivery || !delivery.tracking_number) return;

        // Initial rider location fetch
        const fetchRiderLocation = async () => {
            try {
                const response = await axios.get(`/customer/delivery/${delivery.id}/rider-location`);
                if (response.data.data) {
                    setRiderLocation(response.data.data);
                }
                setLoading(false);
            } catch (err) {
                setError('Failed to load rider location');
                setLoading(false);
            }
        };

        fetchRiderLocation();

        // WebSocket for real-time updates (if available)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/customer.${user?.id || 'guest'}`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === 'rider.location.updated' && 
                data.data.tracking_number === delivery.tracking_number) {
                setRiderLocation({
                    latitude: data.data.latitude,
                    longitude: data.data.longitude,
                    updated_at: data.data.timestamp
                });
            }
        };

        ws.onerror = () => {
            console.warn('WebSocket connection failed, falling back to polling');
            // Fallback to polling every 10 seconds
            const interval = setInterval(fetchRiderLocation, 10000);
            return () => clearInterval(interval);
        };

        return () => {
            ws.close();
        };
    }, [delivery]);

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

    const customerPosition = [delivery.latitude || 7.0543, delivery.longitude || 125.5947];
    const riderPosition = [riderLocation.latitude, riderLocation.longitude];

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
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {/* Customer location */}
                    <Marker position={customerPosition} icon={customerIcon}>
                        <Popup>Your delivery address</Popup>
                    </Marker>
                    
                    {/* Rider location */}
                    <Marker position={riderPosition} icon={riderIcon}>
                        <Popup>Rider is here</Popup>
                    </Marker>
                    
                    {/* Route line */}
                    <Polyline
                        positions={[riderPosition, customerPosition]}
                        color="#ef4444"
                        weight={4}
                        opacity={0.8}
                        dashArray="5, 5"
                    />
                </MapContainer>
            </div>
            
            <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600">Your Location</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-gray-600">Rider (Live)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerOrderTracking;
