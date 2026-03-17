import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, ClipboardList } from 'lucide-react';
import StockTab from './StockTab';
import SalesTab from './SalesTab';
import PurchaseTab from './PurchaseTab';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tabItems = [
    { key: 'stock', label: 'Stock Levels', icon: Package, path: '/inventory' },
    { key: 'sales', label: 'Sales Orders', icon: ShoppingCart, path: '/inventory/sales' },
    { key: 'purchase', label: 'Purchase Orders', icon: ClipboardList, path: '/inventory/purchase' },
];

export default function Inventory({ tab }) {
    const navigate = useNavigate();
    
    return (
        <div className="relative">
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-5 relative z-0">Inventory Management</h2>
            
            <Tabs value={tab} className="mb-6 relative z-0">
                <TabsList>
                    {tabItems.map(t => {
                        const Icon = t.icon;
                        return (
                            <TabsTrigger
                                key={t.key}
                                value={t.key}
                                onClick={() => navigate(t.path)}
                                className="gap-2"
                            >
                                <Icon className="h-4 w-4" />
                                {t.label}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>

            <div className="relative z-0">
                {tab === 'stock' && <StockTab />}
                {tab === 'sales' && <SalesTab />}
                {tab === 'purchase' && <PurchaseTab />}
            </div>
        </div>
    );
}
