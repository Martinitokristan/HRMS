import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

export default function ConfirmModal({ isOpen, message, onConfirm, onCancel, title = 'Confirm Action' }) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF2F2]">
                            <AlertTriangle className="h-7 w-7 text-[#EF4444]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground mb-1.5">Are you sure?</h3>
                            <p className="text-sm text-muted-foreground">{message}</p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" onClick={onConfirm}>Confirm Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
