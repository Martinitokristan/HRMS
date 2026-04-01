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
    const colorMap = {
        'delivered':          'bg-green-100 text-green-700 border-green-200',
        'received':           'bg-green-100 text-green-700 border-green-200',
        'active':             'bg-green-100 text-green-700 border-green-200',
        'confirmed':          'bg-blue-100 text-blue-700 border-blue-200',
        'out_for_delivery':   'bg-blue-100 text-blue-700 border-blue-200',
        'accepted':           'bg-blue-100 text-blue-700 border-blue-200',
        'in_progress':        'bg-blue-100 text-blue-700 border-blue-200',
        'pending':            'bg-yellow-100 text-yellow-700 border-yellow-200',
        'pending_payment':    'bg-yellow-100 text-yellow-700 border-yellow-200',
        'verifying_payment':  'bg-amber-100 text-amber-700 border-amber-200',
        'pending_supplier':   'bg-orange-100 text-orange-700 border-orange-200',
        'supplier_delivered': 'bg-purple-100 text-purple-700 border-purple-200',
        'low_stock':          'bg-amber-100 text-amber-700 border-amber-200',
        'interview_set':      'bg-cyan-100 text-cyan-700 border-cyan-200',
        'returned':           'bg-orange-100 text-orange-700 border-orange-200',
        'rejected':           'bg-red-100 text-red-700 border-red-200',
        'cancelled':          'bg-red-100 text-red-700 border-red-200',
        'failed':             'bg-red-100 text-red-700 border-red-200',
        'inactive':           'bg-gray-100 text-gray-600 border-gray-200',
        'draft':              'bg-gray-100 text-gray-600 border-gray-200',
    };
    const cls = colorMap[status] || 'bg-gray-100 text-gray-600 border-gray-200';
    const label = status ? String(status).replace(/_/g, ' ') : '';
    return <Badge variant="outline" className={cls}>{label}</Badge>;
}

export function RoleBadge({ role }) {
    return <BadgeComponent text={role} variant={role} />;
}
