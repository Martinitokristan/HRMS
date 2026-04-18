import React, { useState } from "react";
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
    const [hoveredPoint, setHoveredPoint] = useState(null);
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
    const padding = { top: 20, right: 30, bottom: 50, left: 60 };
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
            idx,
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

    const isDaily = points.length > 20 && points.length <= 31;
    const xAxisLabelText = isDaily ? "DAY" : "MONTH";
    const yAxisLabelText = "REVENUE";

    return (
        <div
            className="line-chart-wrapper"
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
                position: "relative"
            }}
        >
            {!hideHeader && (
                <div className="chart-header-row" style={{ marginBottom: '10px' }}>
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
                {/* TOOLTIP */}
                {hoveredPoint && (
                    <div
                        className="chart-tooltip"
                        style={{
                            position: "absolute",
                            left: `${(hoveredPoint.x / width) * 100}%`,
                            top: `${(hoveredPoint.y / height) * 100}%`,
                            transform: "translate(-50%, -130%)",
                            backgroundColor: "#1e293b",
                            color: "white",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            zIndex: 10,
                            pointerEvents: "none",
                            whiteSpace: "nowrap",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            minWidth: "80px"
                        }}
                    >
                        <span style={{ color: "#94a3b8", fontSize: "9px", textTransform: "uppercase" }}>
                            {isDaily ? `Day ${hoveredPoint.label}` : hoveredPoint.label}
                        </span>
                        <span>{formatValue(hoveredPoint.value)}</span>
                    </div>
                )}

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
                                stopOpacity="0.15"
                            />
                            <stop
                                offset="100%"
                                stopColor={color}
                                stopOpacity="0.01"
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

                    {/* Y-Axis Label */}
                    <text
                        transform={`rotate(-90, ${padding.left - 45}, ${padding.top + chartHeight / 2})`}
                        x={padding.left - 50}
                        y={padding.top + chartHeight / 2}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        letterSpacing="1px"
                        fill="#94a3b8"
                        style={{ textTransform: 'uppercase' }}
                    >
                        {yAxisLabelText}
                    </text>

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
                            {/* Larger invisible hover area */}
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r="12"
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredPoint(point)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            />
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r={hoveredPoint?.idx === idx ? "5" : "4"}
                                fill="#ffffff"
                                stroke={color}
                                strokeWidth={hoveredPoint?.idx === idx ? "3" : "2"}
                                style={{ pointerEvents: 'none', transition: 'all 0.2s' }}
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
                        .filter((point, idx) => {
                            // SHOW ALL MONTHS (12 points)
                            if (points.length === 12) return true;
                            
                            // If labels are days (1-31), show every 5th day: 5, 10, 15, 20, 25, 30
                            const isNumeric = !isNaN(point.label) && point.label !== "";
                            if (isNumeric && points.length > 20 && points.length <= 31) {
                                const day = parseInt(point.label);
                                return day % 5 === 0;
                            }
                            // Default heuristic for other data
                            return idx % Math.ceil(points.length / 6) === 0 || idx === points.length - 1;
                        })
                        .map((point, idx) => (
                            <text
                                key={`xlabel-${idx}`}
                                x={point.x}
                                y={padding.top + chartHeight + 25}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#64748b"
                            >
                                {point.label}
                            </text>
                        ))}

                    {/* X-Axis Label */}
                    <text
                        x={padding.left + chartWidth / 2}
                        y={padding.top + chartHeight + 45}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        letterSpacing="1px"
                        fill="#94a3b8"
                        style={{ textTransform: 'uppercase' }}
                    >
                        {xAxisLabelText}
                    </text>
                </svg>
            </div>
        </div>
    );
};

export default LineChart;
