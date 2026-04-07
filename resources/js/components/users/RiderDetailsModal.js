import React from 'react';

const LABEL = { fontSize: 11, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 2 };
const VALUE = { fontSize: 13, color: '#1a1a1a', fontWeight: 500, lineHeight: 1.4 };
const DIVIDER = { borderTop: '1px solid #f5f5f5', margin: '12px 0' };

function Field({ label, value }) {
    return (
        <div>
            <span style={LABEL}>{label}</span>
            <span style={VALUE}>{value || 'N/A'}</span>
        </div>
    );
}

export default function RiderDetailsModal({ isOpen, onClose, rider }) {
    if (!isOpen || !rider) return null;

    const profile = rider.rider_profile || {};
    const statusColor = {
        active:       { background: '#e6f4ea', color: '#2e7d32' },
        pending:      { background: '#fff8e1', color: '#f57f17' },
        interview_set:{ background: '#e3f2fd', color: '#1565c0' },
        inactive:     { background: '#f5f5f5', color: '#757575' },
    }[rider.status] || { background: '#f5f5f5', color: '#757575' };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
            onClick={onClose}
        >
            <div
                style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.14)', width: '90vw', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: '20px 22px' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal header bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>Rider Details</span>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#9e9e9e' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        ×
                    </button>
                </div>

                {/* Section 1 — Rider Identity */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #f0f0f0', marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>{rider.name}</div>
                        <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>
                            {rider.email}
                            {rider.id && <span style={{ marginLeft: 8 }}>· Rider ID: #{rider.id}</span>}
                        </div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap', marginLeft: 12, ...statusColor }}>
                        {(rider.status || 'pending').replace(/_/g, ' ')}
                    </span>
                </div>

                {/* Section 2 — Personal & Contact Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 10, columnGap: 16, marginBottom: 4 }}>
                    <Field label="Phone Number"     value={rider.phone} />
                    <Field label="Emergency Contact" value={profile.emergency_contact} />
                    <Field label="Vehicle Type"     value={profile.vehicle_type} />
                    <Field label="Plate Number"     value={profile.plate_number} />
                    <Field label="Vehicle Model"    value={profile.vehicle_model} />
                    <Field label="License Number"   value={profile.license_number} />
                </div>
                {/* Home Address — full width */}
                <div style={{ marginTop: 10 }}>
                    <Field label="Home Address" value={profile.address || 'No address provided'} />
                </div>

                <div style={DIVIDER} />

                {/* Section 3 — Application Documents */}
                <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 6 }}>Application Documents</span>
                    {profile.valid_id_path ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img
                                src={`/storage/${profile.valid_id_path}`}
                                alt="ID"
                                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #e0e0e0' }}
                            />
                            <div>
                                <div style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{profile.valid_id_type || 'Verification ID'}</div>
                                <a
                                    href={`/storage/${profile.valid_id_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: 11, color: '#1976d2', textDecoration: 'underline' }}
                                >
                                    View full document →
                                </a>
                            </div>
                        </div>
                    ) : (
                        <span style={{ fontSize: 12, color: '#bdbdbd', fontStyle: 'italic' }}>No ID uploaded</span>
                    )}
                </div>

                {profile.interview_at && (
                    <>
                        <div style={DIVIDER} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e3f2fd', borderRadius: 6, padding: '8px 12px' }}>
                            <div>
                                <span style={{ fontSize: 10, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Interview Scheduled</span>
                                <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, marginTop: 1 }}>
                                    {new Date(profile.interview_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div style={DIVIDER} />

                {/* Section 4 — Performance Stats */}
                <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 8 }}>Performance Stats</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[
                            { label: 'Deliveries',  value: rider.total_deliveries_count || 0 },
                            { label: 'Active Load', value: rider.active_deliveries_count || 0 },
                            { label: 'On-Time Rate', value: `${profile.on_time_rate || 0}%` },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ flex: 1, background: '#f9f9f9', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{value}</div>
                                <div style={{ fontSize: 10, color: '#9e9e9e', textTransform: 'uppercase', marginTop: 4, letterSpacing: '0.4px' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
