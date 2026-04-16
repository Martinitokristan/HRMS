import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function SupplierUnitSettings() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_SETTINGS);
    const [unitTypes, setUnitTypes] = useState([]);
    const [loading, setLoading] = useState(unitTypes.length === 0);
    const [saving, setSaving] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({
            show: false, title: '', message: '',
            onConfirm: null, variant: 'default'
        });
    };

    const [newUnit, setNewUnit] = useState({ purchase_unit: '', sell_unit: '', multiplier: 1 });

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/supplier/unit-types');
            setUnitTypes(res.data.data !== undefined ? res.data.data : res.data || []);
        } catch (err) {
            // Silence background error
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(unitTypes.length > 0);
    }, [refreshTrigger]);

    const handleSaveUnit = async () => {
        if (!newUnit.purchase_unit.trim() || !newUnit.sell_unit.trim()) {
            sileo.error({ title: 'Please fill in all required fields' });
            return;
        }
        setSaving(true);
        try {
            await api.post('/supplier/unit-types', newUnit);
            sileo.success({ title: 'Unit type added successfully' });
            markStale(STALE_KEYS.SUPPLIER_SETTINGS);
            setNewUnit({ purchase_unit: '', sell_unit: '', multiplier: 1 });
            fetchData(true);
        } catch (e) {
            sileo.error({ title: e.response?.data?.message || 'Error saving unit type' });
        } finally {
            setSaving(false);
        }
    };

    const performDeleteUnit = async (id) => {
        closeConfirm();
        try {
            await api.delete(`/supplier/unit-types/${id}`);
            sileo.success({ title: 'Unit type deleted' });
            markStale(STALE_KEYS.SUPPLIER_SETTINGS);
            fetchData(true);
        } catch (e) {
            sileo.error({ title: 'Error deleting unit type' });
        }
    };

    const handleDeleteUnit = (id) => {
        showConfirm(
            'Delete Unit Type',
            'Delete this unit type? Products using it may be affected.',
            () => performDeleteUnit(id),
            'destructive'
        );
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

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
