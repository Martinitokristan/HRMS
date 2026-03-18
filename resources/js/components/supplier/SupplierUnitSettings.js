import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

export default function SupplierUnitSettings() {
    const { showToast } = useToast();
    const [unitTypes, setUnitTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const [newUnit, setNewUnit] = useState({ purchase_unit: '', sell_unit: '', multiplier: 1 });

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const res = await axios.get('/supplier/unit-types');
                if (!isMounted) return;
                setUnitTypes(res.data.data || []);
            } catch (err) {
                if (isMounted) showToast('Failed to load unit types', 'error');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [refreshTrigger]);

    const handleSaveUnit = async () => {
        if (!newUnit.purchase_unit.trim() || !newUnit.sell_unit.trim()) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        setSaving(true);
        try {
            await axios.post('/supplier/unit-types', newUnit);
            showToast('Unit type added successfully');
            setNewUnit({ purchase_unit: '', sell_unit: '', multiplier: 1 });
            triggerRefresh();
        } catch (e) {
            showToast(e.response?.data?.message || 'Error saving unit type', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUnit = async (id) => {
        if (!confirm('Delete this unit type? Products using it may be affected.')) return;
        try {
            await axios.delete(`/supplier/unit-types/${id}`);
            showToast('Unit type deleted');
            triggerRefresh();
        } catch (e) {
            showToast('Error deleting unit type', 'error');
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><div className="spinner" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-lg font-bold text-foreground">Unit Conversions</h2>
                <p className="text-sm text-muted-foreground">Define how products are purchased vs. sold (e.g., buy by box, sell by piece)</p>
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20">
                <h5 className="text-sm font-bold text-primary mb-3">+ Add New Unit Type</h5>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_150px_100px] gap-3 items-end">
                    <div className="space-y-1.5">
                        <Label>Purchase Unit *</Label>
                        <Input 
                            placeholder="e.g. Box, Case, Kilogram" 
                            value={newUnit.purchase_unit} 
                            onChange={e => setNewUnit({...newUnit, purchase_unit: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Sell Unit *</Label>
                        <Input 
                            placeholder="e.g. Pieces, Units, Grams" 
                            value={newUnit.sell_unit} 
                            onChange={e => setNewUnit({...newUnit, sell_unit: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Conversion Factor</Label>
                        <Input 
                            type="number" 
                            step="0.01"
                            min="0.01"
                            placeholder="1" 
                            value={newUnit.multiplier} 
                            onChange={e => setNewUnit({...newUnit, multiplier: e.target.value})} 
                        />
                        <p className="text-xs text-muted-foreground">1 purchase = X sell units</p>
                    </div>
                    <Button onClick={handleSaveUnit} disabled={saving}>
                        {saving ? 'Adding...' : 'Add'}
                    </Button>
                </div>
            </Card>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Purchase Unit</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Sell Unit</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Conversion</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Example</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {unitTypes.length > 0 ? (
                            unitTypes.map((unit, i) => (
                                <TableRow key={unit.id}>
                                    <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                    <TableCell className="px-4 py-3 font-bold text-foreground">{unit.purchase_unit}</TableCell>
                                    <TableCell className="px-4 py-3 font-bold text-foreground">{unit.sell_unit}</TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Badge variant="outline">1 : {unit.multiplier}</Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                                        1 {unit.purchase_unit} = {unit.multiplier} {unit.sell_unit}
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteUnit(unit.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No unit types defined yet. Add your first unit type above.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Card className="p-4 bg-blue-50 border-blue-200">
                <h5 className="text-sm font-bold text-blue-900 mb-2">💡 How Unit Conversions Work</h5>
                <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>Purchase Unit:</strong> How you buy the product from your supplier</p>
                    <p>• <strong>Sell Unit:</strong> How you sell it to customers</p>
                    <p>• <strong>Example:</strong> Buy screws by "Box" (100 pieces), sell by "Piece" → Conversion: 1:100</p>
                </div>
            </Card>
        </div>
    );
}
