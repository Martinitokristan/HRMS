import React from "react";
import { BarChart3 } from "lucide-react";

/**
 * A premium SVG-based Bar Chart component.
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of { label: string, value: number }
 * @param {number} props.maxValue - Optional manual max value for Y-axis
 * @param {Function} props.formatValue - Formatter for tooltips and axes
 * @param {string} props.title - Chart title
 * @param {string} props.color - Bar color (HEX/HSL)
 * @param {boolean} props.hideHeader - Whether to hide the title/total header
 * @param {string} props.totalValueLabel - Label for the total sum
 */
const BarChart = ({
    data,
    maxValue,
    formatValue = (v) => v,
    title = "Analysis",
    totalValueLabel = "Total",
    color = "#3b82f6",
    hideHeader: hideHeaderProp = false,
}) => {
    const hideHeader = hideHeaderProp || !title;
    const normalizedData = Array.isArray(data)
        ? data.map((item, idx) => ({
              label:
                  item?.label == null || item?.label === ""
                      ? `Item ${idx + 1}`
                      : String(item.label),
              value: Number(item?.value) || 0,
          }))
        : [];

    if (normalizedData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
                <div className="text-center">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">No data available</p>
                </div>
            </div>
        );
    }

    const width = 800;
    const height = 240;
    const padding = { top: 30, right: 30, bottom: 45, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const dataMax = Math.max(...normalizedData.map((d) => d.value), 0);
    const safeMaxValue =
        Math.max(maxValue > 0 ? maxValue : dataMax * 1.1, dataMax * 1.1) || 10;
    const totalValue = normalizedData.reduce((sum, d) => sum + d.value, 0);

    const barCount = normalizedData.length;
    const barGapRatio = 0.3; // Space between bars as fraction of bar width
    const totalGapWidth = chartWidth * barGapRatio;
    const availableBarWidth = chartWidth - totalGapWidth;
    const barWidth = availableBarWidth / barCount;
    const gapWidth = totalGapWidth / (barCount + 1);

    const bars = normalizedData.map((item, idx) => {
        const h = (item.value / safeMaxValue) * chartHeight;
        const x = padding.left + gapWidth + idx * (barWidth + gapWidth);
        const y = padding.top + chartHeight - h;
        return {
            x,
            y,
            w: barWidth,
            h: Math.max(h, 2), // Min 2px height for visibility
            value: item.value,
            label: item.label,
        };
    });

    const ySteps = 5;
    const yLabels = Array.from({ length: ySteps }, (_, i) => {
        const pct = i / (ySteps - 1);
        const value = safeMaxValue * (1 - pct);
        const y = padding.top + chartHeight * pct;
        return { value, y };
    });

    const gradientId = `bar-gradient-${color.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;

    return (
        <div className="bar-chart-container w-full h-full flex flex-col">
            {!hideHeader && (
                <div className="flex items-end justify-between mb-4">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold text-slate-900 leading-none">
                            {formatValue(totalValue)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                            {totalValueLabel}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="relative flex-grow min-h-0">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={color} stopOpacity="1" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
                        </linearGradient>
                        <filter id="bar-shadow" x="-10%" y="-10%" width="120%" height="120%">
                            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.1" />
                        </filter>
                    </defs>

                    {/* Y-Axis Grid Lines */}
                    {yLabels.map((label, idx) => (
                        <g key={idx}>
                            <line
                                x1={padding.left}
                                y1={label.y}
                                x2={padding.left + chartWidth}
                                y2={label.y}
                                stroke="#f1f5f9"
                                strokeWidth="1"
                            />
                            <text
                                x={padding.left - 10}
                                y={label.y + 4}
                                textAnchor="end"
                                fontSize="11"
                                fill="#94a3b8"
                                className="font-medium"
                            >
                                {label.value >= 1000
                                    ? (label.value / 1000).toFixed(1) + "k"
                                    : Math.round(label.value)}
                            </text>
                        </g>
                    ))}

                    {/* Bars */}
                    {bars.map((bar, idx) => (
                        <g key={idx} className="group">
                            <rect
                                x={bar.x}
                                y={bar.y}
                                width={bar.w}
                                height={bar.h}
                                fill={`url(#${gradientId})`}
                                rx={Math.min(bar.w / 4, 4)}
                                className="transition-all duration-300 hover:opacity-80"
                                filter="url(#bar-shadow)"
                            >
                                <title>{`${bar.label}: ${formatValue(bar.value)}`}</title>
                            </rect>
                            
                            {/* X-Axis labels (only show for some if too many, or rotate) */}
                            {idx % Math.ceil(bars.length / 10) === 0 && (
                                <text
                                    x={bar.x + bar.w / 2}
                                    y={padding.top + chartHeight + 20}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fill="#64748b"
                                    className="font-medium"
                                >
                                    {bar.label.length > 12
                                        ? bar.label.substring(0, 10) + "..."
                                        : bar.label}
                                </text>
                            )}
                        </g>
                    ))}

                    {/* Base line */}
                    <line
                        x1={padding.left}
                        y1={padding.top + chartHeight}
                        x2={padding.left + chartWidth}
                        y2={padding.top + chartHeight}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                    />
                </svg>
            </div>
        </div>
    );
};

export default BarChart;
