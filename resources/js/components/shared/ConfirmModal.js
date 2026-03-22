import React from 'react';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info } from 'lucide-react';

export default function ConfirmModal({ modal, onClose }) {
    if (!modal.show) return null;

    const isDestructive = modal.variant === 'destructive';

    return (
        <Modal
            isOpen={modal.show}
            onClose={onClose}
            title={modal.title}
            size="sm"
            hideFooter
        >
            <div className="py-2">
                <div className="flex items-start gap-3 mb-6">
                    <div className={`p-2 rounded-full shrink-0 ${
                        isDestructive
                            ? 'bg-destructive/10'
                            : 'bg-primary/10'
                    }`}>
                        {isDestructive
                            ? <AlertTriangle className="h-5 w-5 text-destructive" />
                            : <Info className="h-5 w-5 text-primary" />
                    }
                    </div>
                    <p className="text-muted-foreground text-sm pt-1 leading-relaxed">
                        {modal.message}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={isDestructive ? 'destructive' : 'default'}
                        className="flex-1"
                        onClick={modal.onConfirm}
                    >
                        Confirm
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
