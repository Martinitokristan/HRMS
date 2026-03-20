import React from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog.jsx';

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md', hideFooter = false }) {
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-3xl',
        lg: 'max-w-5xl',
        xl: 'max-w-7xl'
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className={`${sizeClasses[size] || sizeClasses.md}`}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">{title}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {children}
                </div>
                {footer && !hideFooter && (
                    <DialogFooter>
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
