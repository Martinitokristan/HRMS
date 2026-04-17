import React from "react";
import { BarChart3 } from "lucide-react";

const LineChart = ({
    data,
    maxValue,
    formatValue,
    title = "Trend",
    totalValueLabel = "Total",
    color = "#3b82f6",
    hideHeader: hideHeaderProp = false,
}) => {
    const hideHeader = hideHeaderProp || !title;
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No data available</p>
                </div>
            </div>
        );
    }

    // Use an internal aspect ratio box that scales based on the parent
    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Ensure minimum scale for visibility - add 20% padding to max value
    const dataMax = Math.max(...data.map((d) => Number(d.value) || 0), 0);
    const safeMaxValue =
        Math.max(maxValue > 0 ? maxValue : dataMax, dataMax) * 1.2 || 5;
    const totalValue = data.reduce((sum, d) => sum + Number(d.value), 0);

    // Calculate points with smooth positioning
    const points = data.map((item, idx) => {
        const x =
            padding.left + (idx / Math.max(data.length - 1, 1)) * chartWidth;
        const y =
            padding.top +
            chartHeight -
            (Number(item.value) / safeMaxValue) * chartHeight;
        return {
            x,
            y,
            value: item.value,
            label: item.label,
            orders: item.orders,
        };
    });

    // Create smooth cubic bezier curve path
    const createSmoothPath = (pts) => {
        if (pts.length === 0) return "";
        if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

        let path = `M ${pts[0].x} ${pts[0].y}`;

        for (let i = 0; i < pts.length - 1; i++) {
            const current = pts[i];
            const next = pts[i + 1];

            const tension = 0.3;
            const cp1x = current.x + (next.x - current.x) * tension;
            const cp1y = current.y;
            const cp2x = next.x - (next.x - current.x) * tension;
            const cp2y = next.y;

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
        }

        return path;
    };

    const linePath = createSmoothPath(points);
    const areaPath =
        linePath +
        ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    const ySteps = 5;
    const yLabels = Array.from({ length: ySteps }, (_, i) => {
        const pct = i / (ySteps - 1);
        const value = Math.round(safeMaxValue * (1 - pct));
        const y = padding.top + chartHeight * pct;
        return { value, y };
    });

    const gradientId = `gradient-${color.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;

    return (
        <div
            className="line-chart-wrapper"
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
            }}
        >
            {!hideHeader && (
                <div className="chart-header-row">
                    <span className="chart-title">{title}</span>
                    <div className="chart-total">
                        <span className="chart-total-value">
                            {formatValue(totalValue)}
                        </span>
                        <span className="chart-total-label">
                            {totalValueLabel}
                        </span>
                    </div>
                </div>
            )}
            <div
                className="chart-svg-container"
                style={{
                    flexGrow: 1,
                    position: "relative",
                    width: "100%",
                    minHeight: 0,
                }}
            >
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="line-chart-svg"
                    preserveAspectRatio="none"
                    style={{
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                    }}
                >
                    <defs>
                        <linearGradient
                            id={gradientId}
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                        >
                            <stop
                                offset="0%"
                                stopColor={color}
                                stopOpacity="0.25"
                            />
                            <stop
                                offset="100%"
                                stopColor={color}
                                stopOpacity="0.02"
                            />
                        </linearGradient>
                        <filter
                            id="glow"
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >
                            <feGaussianBlur
                                stdDeviation="3"
                                result="coloredBlur"
                            />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

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
                        </g>
                    ))}

                    {points
                        .filter(
                            (_, idx) =>
                                idx % Math.ceil(points.length / 8) === 0,
                        )
                        .map((point, idx) => (
                            <line
                                key={`v-${idx}`}
                                x1={point.x}
                                y1={padding.top}
                                x2={point.x}
                                y2={padding.top + chartHeight}
                                stroke="#f8fafc"
                                strokeWidth="1"
                            />
                        ))}

                    <path d={areaPath} fill={`url(#${gradientId})`} />

                    <path
                        d={linePath}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#glow)"
                        vectorEffect="non-scaling-stroke"
                    />

                    {points.map((point, idx) => (
                        <g key={idx}>
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                fill="#ffffff"
                                stroke={color}
                                strokeWidth="2"
                            />
                        </g>
                    ))}

                    {yLabels.map((label, idx) => (
                        <text
                            key={`ylabel-${idx}`}
                            x={padding.left - 12}
                            y={label.y + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="#94a3b8"
                        >
                            {label.value >= 1000
                                ? (label.value / 1000).toFixed(0) + "k"
                                : label.value}
                        </text>
                    ))}

                    {points
                        .filter(
                            (_, idx) =>
                                idx % Math.ceil(points.length / 6) === 0 ||
                                idx === points.length - 1,
                        )
                        .map((point, idx) => (
                            <text
                                key={`xlabel-${idx}`}
                                x={point.x}
                                y={padding.top + chartHeight + 25}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#64748b"
                            >
                                {point.label}
                            </text>
                        ))}
                </svg>
            </div>
        </div>
    );
};

export default LineChart;
