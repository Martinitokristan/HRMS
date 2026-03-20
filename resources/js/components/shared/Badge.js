import React from 'react';
import { Badge, badgeVariants } from '../ui/badge.jsx';
import { cn } from '../../lib/utils';

export default function BadgeComponent({ text, variant = 'gray' }) {
    const displayText = text ? String(text).replace(/_/g, ' ') : '';
    const normalizedVariant = String(variant).toLowerCase().replace(/ /g, '_');
    return (
        <Badge variant={normalizedVariant}>
            {displayText}
        </Badge>
    );
}

export function StatusBadge({ status }) {
    const variantMap = {
        'draft':             'draft',
        'pending':           'pending',
        'pending_supplier':  'pending_supplier',
        'accepted':          'accepted',
        'rejected':          'rejected',
        'cancelled':         'cancelled',
        'supplier_delivered':'supplier_delivered',
        'received':          'received',
        'active':            'active',
        'inactive':          'inactive',
        'low_stock':         'low_stock',
        'interview_set':     'interview_set',
        'confirmed':         'confirmed',
        'out_for_delivery':  'out_for_delivery',
        'delivered':         'delivered',
        'returned':          'returned',
        'in_progress':       'in_progress',
        'failed':            'failed',
    };
    const variant = variantMap[status] || 'gray';
    return <BadgeComponent text={status} variant={variant} />;
}

export function RoleBadge({ role }) {
    return <BadgeComponent text={role} variant={role} />;
}
