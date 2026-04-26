import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertTriangle, Upload, ShieldAlert, Loader2 } from 'lucide-react';
import { formatPHP } from '@/lib/utils';

export default function GCashProofSubmit() {
    const { token } = useParams();

    const [order, setOrder]       = useState(null);
    const [loadErr, setLoadErr]   = useState('');
    const [loading, setLoading]   = useState(true);

    const [reference, setReference] = useState('');
    const [file, setFile]           = useState(null);
    const [preview, setPreview]     = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted]   = useState(false);
    const [submitErr, setSubmitErr]   = useState('');

    const fileRef = useRef();

    useEffect(() => {
        axios.get(`/api/gcash/proof/${token}`)
            .then(res => setOrder(res.data))
            .catch(err => setLoadErr(err.response?.data?.error || 'This link is invalid or has already been used.'))
            .finally(() => setLoading(false));
    }, [token]);

    const handleFile = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitErr('');
        if (!reference.trim()) { setSubmitErr('Reference number is required.'); return; }
        if (!file) { setSubmitErr('Please attach your GCash screenshot.'); return; }

        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('payment_reference', reference.trim());
            form.append('payment_proof', file);
            await axios.post(`/api/gcash/proof/${token}`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setSubmitted(true);
        } catch (err) {
            setSubmitErr(err.response?.data?.error || err.response?.data?.message || 'Submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#007DFE]" />
            </div>
        );
    }

    if (loadErr) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center space-y-4">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                    <h2 className="text-lg font-bold text-gray-800">Link Unavailable</h2>
                    <p className="text-sm text-gray-500">{loadErr}</p>
                </Card>
            </div>
        );
    }

    if (submitted || order?.already_submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center space-y-4">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                    <h2 className="text-lg font-bold text-gray-800">Proof Submitted!</h2>
                    <p className="text-sm text-gray-500">
                        Our admin will verify your payment and confirm your order shortly.
                        You will receive an SMS once confirmed.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-4">

                {/* Header */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-[#007DFE]/10 rounded-2xl mb-3">
                        <Upload className="h-7 w-7 text-[#007DFE]" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Submit Payment Proof</h1>
                    <p className="text-sm text-gray-500 mt-1">Upload your GCash screenshot to verify your payment</p>
                </div>

                {/* Order details */}
                <Card className="p-4 bg-blue-50 border-blue-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-2">Order Summary</p>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Order</span>
                        <span className="font-semibold text-gray-900">#{order.order_number}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Amount Due</span>
                        <span className="font-mono font-bold text-foreground">{formatPHP(order.total_amount)}</span>
                    </div>
                    <div className="text-xs text-gray-500 border-t border-blue-200 pt-2">
                        {order.items?.map((item, i) => (
                            <span key={i}>{item.quantity}x {item.name}{i < order.items.length - 1 ? ', ' : ''}</span>
                        ))}
                    </div>
                </Card>

                {/* Fraud disclaimer */}
                <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">
                        <strong>Important:</strong> Submitting AI-generated, edited, or fraudulent screenshots is strictly prohibited and may result in order cancellation and account suspension. Only submit authentic GCash receipts.
                    </p>
                </div>

                {/* Form */}
                <Card className="p-5">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="ref">GCash Reference Number</Label>
                            <Input
                                id="ref"
                                placeholder="e.g. 1234567890"
                                value={reference}
                                onChange={e => setReference(e.target.value)}
                                maxLength={50}
                            />
                            <p className="text-[11px] text-gray-400">Found at the top of your GCash transaction receipt</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label>GCash Screenshot</Label>
                            <div
                                className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#007DFE] hover:bg-blue-50/50 transition-colors"
                                onClick={() => fileRef.current?.click()}
                            >
                                {preview ? (
                                    <img src={preview} alt="Proof preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                                ) : (
                                    <div className="space-y-1">
                                        <Upload className="h-8 w-8 text-gray-300 mx-auto" />
                                        <p className="text-sm text-gray-500">Click to upload screenshot</p>
                                        <p className="text-[11px] text-gray-400">JPG, PNG · Max 5MB</p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFile}
                            />
                            {file && <p className="text-[11px] text-green-600">✓ {file.name}</p>}
                        </div>

                        {submitErr && (
                            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{submitErr}</p>
                        )}

                        <Button type="submit" className="w-full" disabled={submitting}>
                            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit Proof'}
                        </Button>
                    </form>
                </Card>

            </div>
        </div>
    );
}
