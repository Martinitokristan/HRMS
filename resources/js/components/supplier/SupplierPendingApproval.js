import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Mail, ArrowLeft } from 'lucide-react';

export default function SupplierPendingApproval() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', width: '90vw', maxWidth: 440, padding: '40px 32px 32px', textAlign: 'center', borderTop: '4px solid #F97316' }}>

                {/* Icon */}
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FFF4ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Clock style={{ width: 26, height: 26, color: '#F97316' }} />
                </div>

                {/* Title */}
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    Email Verified!
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, marginBottom: 24 }}>
                    Your email has been confirmed. Your supplier account is now <strong style={{ color: '#F97316' }}>pending admin approval</strong>.<br />
                    You will receive an email once your account has been activated.
                </div>

                {/* Steps */}
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>What happens next?</div>
                    {[
                        { icon: CheckCircle2, color: '#22C55E', text: 'Email address verified' },
                        { icon: Clock,        color: '#F97316', text: 'Account under admin review' },
                        { icon: Mail,         color: '#6B7280', text: 'You\'ll be notified once approved' },
                    ].map(({ icon: Icon, color, text }, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                            <Icon style={{ width: 16, height: 16, color, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: '#374151' }}>{text}</span>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <button
                    onClick={() => navigate('/supplier/login')}
                    style={{ width: '100%', height: 42, background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10, transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EA6C0A'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F97316'; }}
                >
                    Go to Supplier Login
                </button>
                <button
                    onClick={() => navigate('/')}
                    style={{ width: '100%', background: 'none', border: 'none', fontSize: 13, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#111827'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; }}
                >
                    <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Homepage
                </button>
            </div>
        </div>
    );
}
