import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function EmailVerification() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const token = searchParams.get('token');
    const type = searchParams.get('type');

    const [status, setStatus] = useState('verifying'); // verifying, success, error, pending
    const [message, setMessage] = useState('Verifying your email address...');
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        if (!token || !type) {
            setStatus('error');
            setMessage('Invalid verification link. Missing token or type.');
            return;
        }

        const verifyEmail = async () => {
            try {
                // Determine endpoint based on type
                const endpoint = type === 'supplier'
                    ? `/supplier/auth/verify-email?token=${token}`
                    : `/auth/verify-email?token=${token}`;

                const response = await api.get(endpoint);
                
                if (response.data.status === 'success') {
                    if (type === 'supplier') {
                        navigate('/supplier/pending-approval', { replace: true });
                        return;
                    }
                    
                    // Handle Customer Auto-login
                    if (response.data.data && response.data.data.role === 'customer') {
                        setStatus('success');
                        setMessage('Email verified successfully! Redirecting to shop in 3s...');
                        
                        // Set user in context immediately
                        if (response.data.data) {
                            setUser(response.data.data);
                        }

                        // Start countdown
                        let timer = 3;
                        const interval = setInterval(() => {
                            timer -= 1;
                            setCountdown(timer);
                            if (timer <= 0) {
                                clearInterval(interval);
                                navigate('/shop', { replace: true });
                            }
                        }, 1000);
                        return;
                    }

                    setStatus('success');
                    setMessage('Email verified successfully! Please head to the login page to continue.');
                } else {
                    setStatus('error');
                    setMessage('Verification failed. Please try again or request a new link.');
                }
            } catch (error) {
                const httpStatus = error.response?.status;
                const msg = error.response?.data?.message || '';

                if (msg.toLowerCase().includes('already verified')) {
                    setStatus('success');
                    setMessage('Your email is already verified! Redirecting...');
                    setTimeout(() => {
                        if (type === 'supplier') navigate('/supplier/dashboard');
                        else if (type === 'rider') navigate('/');
                        else navigate('/shop');
                    }, 2000);
                } else if (httpStatus === 404 || msg.toLowerCase().includes('invalid or expired')) {
                    setStatus('expired');
                    setMessage('This verification link has expired or has already been used. If your email is not yet verified, please request a new link.');
                } else {
                    setStatus('error');
                    setMessage(msg || 'Verification failed. Please try again or request a new link.');
                }
            }
        };

        verifyEmail();
    }, [token, type, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                {status === 'verifying' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <h2 className="text-xl font-bold mb-2">Verifying Email</h2>
                        <p className="text-muted-foreground">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                        <h2 className="text-xl font-bold mb-2">Verified!</h2>
                        <Alert className="bg-green-50 text-green-800 border-green-200">
                            <AlertDescription>
                                {message}
                                {type === 'customer' && (
                                    <div className="mt-2 font-bold text-lg">
                                        Redirecting in {countdown}s...
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-12 w-12 text-orange-500 mb-4" />
                        <h2 className="text-xl font-bold mb-2">Email Verified</h2>
                        <Alert className="bg-orange-50 text-orange-800 border-orange-200 mb-6 font-medium">
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                        <Button className="w-full" onClick={() => navigate('/')}>Return to Homepage</Button>
                    </div>
                )}

                {status === 'expired' && (
                    <div className="flex flex-col items-center">
                        <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
                        <h2 className="text-xl font-bold mb-2 text-orange-600">Link Expired</h2>
                        <Alert className="bg-orange-50 text-orange-800 border-orange-200 mb-6">
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                        <Button className="w-full mb-2" onClick={() => navigate(type === 'supplier' ? '/supplier/login' : '/login')}>Go to Login</Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold mb-2 text-red-600">Verification Failed</h2>
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                        <Button className="w-full" onClick={() => navigate(type === 'supplier' ? '/supplier/login' : '/login')}>Go to Login</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
