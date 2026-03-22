import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function ShoppingCart() {
    const { user } = useAuth();
    const [cart, setCart] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expiringSoon, setExpiringSoon] = useState([]);

    useEffect(() => {
        fetchCart();
        fetchReservations();
        
        // Check for expiring reservations every minute
        const interval = setInterval(() => {
            fetchReservations();
        }, 60000);
        
        return () => clearInterval(interval);
    }, []);

    const fetchCart = async () => {
        try {
            const response = await axios.get('/cart');
            setCart(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch cart:', error);
        }
    };

    const fetchReservations = async () => {
        try {
            const response = await axios.get('/cart/reservations');
            const reservations = response.data.data || [];
            setReservations(reservations);
            
            // Check for reservations expiring in next 5 minutes
            const expiring = reservations.filter(reservation => {
                const minutesLeft = reservation.minutes_remaining;
                return minutesLeft <= 5 && minutesLeft > 0;
            });
            setExpiringSoon(expiring);
        } catch (error) {
            console.error('Failed to fetch reservations:', error);
        }
    };

    const updateQuantity = async (itemId, quantity) => {
        if (quantity < 1) return;
        
        setLoading(true);
        try {
            await axios.put(`/cart/${itemId}`, { quantity });
            await fetchCart();
            await fetchReservations();
        } catch (error) {
            toast.error('Failed to update quantity');
        } finally {
            setLoading(false);
        }
    };

    const removeFromCart = async (itemId) => {
        setLoading(true);
        try {
            await axios.delete(`/cart/${itemId}`);
            await fetchCart();
            await fetchReservations();
            toast.success('Item removed from cart');
        } catch (error) {
            toast.error('Failed to remove item');
        } finally {
            setLoading(false);
        }
    };

    const reserveItem = async (item) => {
        setLoading(true);
        try {
            await axios.post('/cart/reserve', {
                product_id: item.product_id,
                product_variant_id: item.product_variant_id,
                quantity: item.quantity
            });
            await fetchReservations();
            toast.success('Item reserved for 15 minutes');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reserve item');
        } finally {
            setLoading(false);
        }
    };

    const releaseReservation = async (reservationId) => {
        setLoading(true);
        try {
            await axios.post('/cart/release', { reservation_id: reservationId });
            await fetchReservations();
            toast.success('Reservation released');
        } catch (error) {
            toast.error('Failed to release reservation');
        } finally {
            setLoading(false);
        }
    };

    const getTotalPrice = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const formatTime = (minutes) => {
        if (minutes <= 0) return 'Expired';
        if (minutes < 60) return `${minutes} min`;
        return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Shopping Cart</h1>
                <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="text-sm text-muted-foreground">
                        {cart.length} items
                    </span>
                </div>
            </div>

            {/* Expiring Reservations Alert */}
            {expiringSoon.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-orange-800">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-medium">
                                {expiringSoon.length} reservation{expiringSoon.length > 1 ? 's' : ''} expiring soon!
                            </span>
                        </div>
                        <div className="mt-2 space-y-1">
                            {expiringSoon.map(reservation => (
                                <div key={reservation.id} className="flex items-center justify-between text-sm">
                                    <span>{reservation.product?.name}</span>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatTime(reservation.minutes_remaining)}</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => releaseReservation(reservation.id)}
                                        >
                                            Release
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cart Items */}
            {cart.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
                        <p className="text-muted-foreground mb-4">
                            Add some products to get started
                        </p>
                        <Button onClick={() => window.location.href = '/shop'}>
                            Continue Shopping
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Cart Items List */}
                    <div className="lg:col-span-2 space-y-4">
                        {cart.map((item) => (
                            <Card key={item.id}>
                                <CardContent className="p-4">
                                    <div className="flex gap-4">
                                        {item.image_path && (
                                            <img
                                                src={`/storage/${item.image_path}`}
                                                alt={item.name}
                                                className="w-20 h-20 object-cover rounded-md"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <h3 className="font-medium">{item.name}</h3>
                                            {item.product_variant && (
                                                <Badge variant="secondary" className="mt-1">
                                                    {item.product_variant.size_value?.label} / 
                                                    {item.product_variant.color_value?.label}
                                                </Badge>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="font-semibold">
                                                    ₱{item.price.toFixed(2)}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        disabled={loading}
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </Button>
                                                    <span className="w-8 text-center">{item.quantity}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        disabled={loading}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => removeFromCart(item.id)}
                                                        disabled={loading}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => reserveItem(item)}
                                                    disabled={loading}
                                                >
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    Reserve Stock
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Order Summary */}
                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>₱{getTotalPrice().toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Delivery Fee</span>
                                    <span>₱50.00</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>Total</span>
                                    <span>₱{(getTotalPrice() + 50).toFixed(2)}</span>
                                </div>
                                <Button className="w-full" size="lg">
                                    Proceed to Checkout
                                </Button>
                                <Button variant="outline" className="w-full">
                                    Continue Shopping
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Active Reservations */}
                        {reservations.length > 0 && (
                            <Card className="mt-4">
                                <CardHeader>
                                    <CardTitle className="text-sm">Active Reservations</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {reservations.map((reservation) => (
                                        <div key={reservation.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                                            <div>
                                                <div className="font-medium">{reservation.product?.name}</div>
                                                <div className="text-muted-foreground">
                                                    Qty: {reservation.quantity} • {formatTime(reservation.minutes_remaining)}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => releaseReservation(reservation.id)}
                                            >
                                                Release
                                            </Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
