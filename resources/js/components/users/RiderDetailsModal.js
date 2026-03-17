import React from 'react';
import Modal from '../shared/Modal';
import { StatusBadge } from '../shared/Badge';

export default function RiderDetailsModal({ isOpen, onClose, rider }) {
    if (!rider) return null;

    const profile = rider.rider_profile || {};

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Rider Profile Details"
            size="md"
        >
            <div className="rider-details">
                <div className="d-flex align-center gap-2 mb-4">
                    <div className="avatar bg-amber-light text-amber" style={{ width: 64, height: 64, fontSize: '1.5rem' }}>
                        {rider.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="mb-0">{rider.name}</h3>
                        <div className="text-muted">{rider.email}</div>
                        <StatusBadge status={rider.status} />
                    </div>
                </div>

                <div className="grid grid-2 gap-4">
                    <div className="info-group">
                        <label className="text-xs font-bold text-muted uppercase d-block mb-1">Phone Number</label>
                        <div className="font-bold text-md">{rider.phone || 'N/A'}</div>
                    </div>
                    <div className="info-group">
                        <label className="text-xs font-bold text-muted uppercase d-block mb-1">Vehicle Type</label>
                        <div className="font-bold text-md">{profile.vehicle_type || 'N/A'}</div>
                    </div>
                    <div className="info-group">
                        <label className="text-xs font-bold text-muted uppercase d-block mb-1">Plate Number</label>
                        <div className="font-bold text-md">{profile.plate_number || 'N/A'}</div>
                    </div>
                    <div className="info-group">
                        <label className="text-xs font-bold text-muted uppercase d-block mb-1">License Number</label>
                        <div className="font-bold text-md">{profile.license_number || 'N/A'}</div>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="text-xs font-bold text-muted uppercase d-block mb-1">Home Address</label>
                    <div className="font-semi text-md">{profile.address || 'No address provided'}</div>
                </div>

                <div className="mt-4 p-3 border-radius-lg bg-surface2">
                    <h4 className="mb-2 text-sm">Application Documents</h4>
                    <div className="d-flex align-center justify-between">
                        <div>
                            <div className="text-xs text-muted">Verification ID ({profile.valid_id_type || 'ID'})</div>
                            {profile.valid_id_path ? (
                                <a 
                                    href={`/storage/${profile.valid_id_path}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-sm font-bold text-blue hover-none underline"
                                >
                                    View Uploaded Document →
                                </a>
                            ) : <span className="text-sm italic">No ID uploaded</span>}
                        </div>
                    </div>
                </div>

                {profile.interview_at && (
                    <div className="mt-4 p-3 border-radius-lg bg-blue-light text-blue">
                        <div className="text-xs font-bold uppercase">Interview Scheduled</div>
                        <div className="font-bold">{new Date(profile.interview_at).toLocaleString()}</div>
                    </div>
                )}

                <div className="mt-4">
                    <h4 className="mb-2 text-sm">Performance Stats</h4>
                    <div className="grid grid-3 gap-2">
                        <div className="p-2 border border-radius-md text-center">
                            <div className="text-xs text-muted">Load</div>
                            <div className="font-bold">{rider.active_deliveries_count || 0}</div>
                        </div>
                        <div className="p-2 border border-radius-md text-center">
                            <div className="text-xs text-muted">Total</div>
                            <div className="font-bold">{rider.total_deliveries_count || 0}</div>
                        </div>
                        <div className="p-2 border border-radius-md text-center">
                            <div className="text-xs text-muted">On-Time</div>
                            <div className="font-bold text-green">{profile.on_time_rate || 0}%</div>
                        </div>
                    </div>
                </div>

                <div className="mt-5 d-flex justify-end">
                    <button className="btn btn-primary" onClick={onClose}>Close Profile</button>
                </div>
            </div>
        </Modal>
    );
}
