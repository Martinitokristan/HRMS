import React from 'react';
import { cn } from '../../lib/utils';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
    accent: { border: 'border-t-[#FF6B35]', iconBg: 'bg-[#FFF1EB]', iconText: 'text-[#FF6B35]' },
    green:  { border: 'border-t-[#22C55E]', iconBg: 'bg-[#F0FDF4]',  iconText: 'text-[#22C55E]' },
    blue:   { border: 'border-t-[#3B82F6]', iconBg: 'bg-[#EFF6FF]',  iconText: 'text-[#3B82F6]' },
    amber:  { border: 'border-t-[#F59E0B]', iconBg: 'bg-[#FFFBEB]',  iconText: 'text-[#F59E0B]' },
    red:    { border: 'border-t-[#EF4444]', iconBg: 'bg-[#FEF2F2]',  iconText: 'text-[#EF4444]' },
    purple: { border: 'border-t-[#8B5CF6]', iconBg: 'bg-[#F5F3FF]',  iconText: 'text-[#8B5CF6]' },
};

export default function StatCard({ label, value, trend, trendUp, icon: Icon, accentColor = 'accent' }) {
    const colors = colorMap[accentColor] || colorMap.accent;

    return (
        <Card className={cn(
            'stat-card relative overflow-hidden p-6',
            'border-t-[3px] transition-all duration-200 hover:-translate-y-0.5',
            colors.border
        )}>
            {Icon && (
                <div className={cn(
                    'absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-xl',
                    colors.iconBg, colors.iconText
                )}>
                    <Icon className="h-5 w-5" />
                </div>
            )}
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground mb-2">
                {label}
            </p>
            <p className="text-[1.875rem] font-extrabold text-foreground leading-none tracking-tight">
                {value}
            </p>
            {trend !== undefined && (
                <p className={cn(
                    'mt-2 flex items-center gap-1 text-xs font-bold',
                    trendUp ? 'text-[#22C55E]' : 'text-[#EF4444]'
                )}>
                    {trendUp
                        ? <TrendingUp className="h-3.5 w-3.5" />
                        : <TrendingDown className="h-3.5 w-3.5" />}
                    {trend}
                </p>
            )}
        </Card>
    );
}
