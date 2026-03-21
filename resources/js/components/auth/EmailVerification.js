import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function EmailVerification() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();
    const { loginWithToken: loginAsSupplier } = useSupplierAuth();
    
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    
    const [status, setStatus] = useState('verifying'); // verifying, success, error, pending
    const [message, setMessage] = useState('Verifying your email address...');

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

                const response = await axios.get(endpoint);
                const { data, token: authToken, message } = response.data;

                if (type === 'rider') {
                    // Rider is pending approval
                    setStatus('pending');
                    setMessage('Email verified! Your application is now pending admin review and interview.');
                } else if (type === 'supplier') {
                    // Log in supplier and redirect to supplier dashboard
                    if (authToken) {
                        loginAsSupplier(authToken, data);
                    }
                    setStatus('success');
                    setMessage('Email verified successfully! Redirecting to your dashboard...');
                    setTimeout(() => navigate('/supplier/dashboard'), 2000);
                } else {
                    // Log in customer and redirect to shop
                    if (authToken) {
                        loginWithToken(authToken, data);
                    }
                    setStatus('success');
                    setMessage('Email verified successfully! Redirecting to the shop...');
                    setTimeout(() => navigate('/shop'), 2000);
                }
            } catch (error) {
                const status = error.response?.status;
                const msg = error.response?.data?.message || '';

                // 404 = token already used (already verified) OR invalid
                // "Email already verified" = second click on the link
                if (status === 404 || msg.toLowerCase().includes('already verified') || msg.toLowerCase().includes('invalid or expired')) {
                    // Treat as already verified — just redirect appropriately
                    setStatus('success');
                    setMessage('Your email is already verified! Redirecting...');
                    setTimeout(() => {
                        if (type === 'supplier') navigate('/supplier/dashboard');
                        else if (type === 'rider') navigate('/');
                        else navigate('/shop');
                    }, 2000);
                } else {
                    setStatus('error');
                    setMessage(msg || 'Verification failed. Please try again or request a new link.');
                }
            }
        };

        verifyEmail();
    }, [token, type, navigate, loginWithToken]);

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
                            <AlertDescription>{message}</AlertDescription>
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

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold mb-2 text-red-600">Verification Failed</h2>
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                        <Button className="w-full" onClick={() => navigate('/login')}>Go to Login</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
