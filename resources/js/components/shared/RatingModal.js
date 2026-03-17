import React, { useState } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';

export default function RatingModal({ isOpen, onClose, delivery, onSuccess }) {
    const { showToast } = useToast();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !delivery) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            showToast('Please select a rating', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post(`/deliveries/${delivery.id}/rate`, {
                rating,
                comment: comment.trim()
            });
            showToast('Thank you for your feedback!', 'success');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to submit rating', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const stars = [1, 2, 3, 4, 5];

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 20, maxWidth: 500,
                width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '1.5rem', borderBottom: '1px solid #e2e8f0',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}>
                    <h3 style={{ 
                        fontWeight: 800, fontSize: '1.3rem', margin: 0,
                        color: '#fff', textAlign: 'center'
                    }}>Rate Your Delivery</h3>
                    <p style={{ 
                        color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem',
                        textAlign: 'center', margin: '0.5rem 0 0 0'
                    }}>
                        Delivery #{delivery.id} • {delivery.rider_name || 'Rider'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
                    {/* Star Rating */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ 
                            fontSize: '0.75rem', fontWeight: 700, 
                            color: '#64748b', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: '1rem'
                        }}>
                            How was your delivery experience?
                        </div>
                        <div style={{ 
                            display: 'flex', justifyContent: 'center', 
                            gap: '0.5rem', marginBottom: '0.5rem'
                        }}>
                            {stars.map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    style={{
                                        background: 'none', border: 'none',
                                        cursor: 'pointer', padding: 0,
                                        fontSize: '3rem', lineHeight: 1,
                                        color: (hoverRating || rating) >= star ? '#fbbf24' : '#e2e8f0',
                                        transition: 'all 0.2s',
                                        transform: (hoverRating || rating) >= star ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                        {rating > 0 && (
                            <div style={{ 
                                fontSize: '0.9rem', fontWeight: 600,
                                color: rating >= 4 ? '#16a34a' : rating >= 3 ? '#f59e0b' : '#ef4444',
                                marginTop: '0.5rem'
                            }}>
                                {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
                            </div>
                        )}
                    </div>

                    {/* Comment */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ 
                            display: 'block', fontSize: '0.85rem', fontWeight: 700,
                            color: '#1e293b', marginBottom: '0.5rem'
                        }}>
                            Additional Comments (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Share your experience with us..."
                            rows={4}
                            style={{
                                width: '100%', padding: '0.75rem',
                                border: '1px solid #e2e8f0', borderRadius: 10,
                                fontSize: '0.9rem', fontFamily: 'inherit',
                                resize: 'vertical', minHeight: 100
                            }}
                        />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="btn btn--ghost"
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || rating === 0}
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                        >
                            {submitting ? 'Submitting...' : 'Submit Rating'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
