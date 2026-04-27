<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sales Report - {{ $period_label }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; }
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 11px;
            line-height: 1.6; 
            color: #333;
            background: #fff;
        }
        .container { 
            width: 100%; 
            padding: 20px; 
            margin: 0 auto;
        }
        
        /* Page breaks and positioning */
        @page {
            size: A4;
            margin: 20px;
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9px;
                color: #999;
            }
        }
        
        /* Company Header */
        .company-header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 4px solid #2c3e50;
            margin-bottom: 25px;
        }
        .logo-box {
            display: inline-block;
            background: #2c3e50;
            color: #fff;
            padding: 10px 25px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .company-name {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #2c3e50;
        }
        .company-tagline {
            font-size: 12px;
            color: #666;
            font-weight: 600;
            margin-top: 3px;
        }
        .company-info {
            font-size: 10px;
            color: #777;
            margin-top: 8px;
            line-height: 1.4;
        }
        
        /* Report Header */
        .report-header {
            text-align: center;
            margin-bottom: 25px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 4px;
            border-left: 4px solid #3498db;
        }
        .report-title {
            font-size: 18px;
            font-weight: 700;
            color: #2c3e50;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .report-meta {
            font-size: 10px;
            color: #666;
        }
        .report-meta strong {
            color: #2c3e50;
            font-weight: 700;
        }
        
        /* Generated timestamp */
        .generated-info {
            font-size: 9px;
            color: #999;
            text-align: right;
            margin-bottom: 20px;
            padding-right: 5px;
        }
        
        /* Summary Section */
        .summary-section {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 8px;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary-table td {
            padding: 12px;
            text-align: center;
            width: 33.33%;
            border-right: 1px solid #ddd;
            background: #fff;
        }
        .summary-table td:last-child {
            border-right: none;
        }
        .summary-label {
            font-size: 9px;
            color: #999;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-weight: 600;
        }
        .summary-value {
            font-size: 18px;
            font-weight: 700;
        }
        .text-green { color: #27ae60; }
        .text-blue { color: #3498db; }
        .text-purple { color: #9b59b6; }
        
        /* Order Status Summary */
        .status-section {
            margin-bottom: 20px;
        }
        .status-grid {
            display: table;
            width: 100%;
            border-collapse: collapse;
        }
        .status-cell {
            display: table-cell;
            width: 25%;
            padding: 12px;
            text-align: center;
            border: 1px solid #e0e0e0;
            background: #f8f9fa;
        }
        .status-box {
            padding: 10px;
            background: #fff;
            border-radius: 3px;
            border-left: 4px solid #ccc;
        }
        .status-box.delivered { border-left-color: #27ae60; background: #d4edda; }
        .status-box.pending { border-left-color: #f39c12; background: #fff3cd; }
        .status-box.in-progress { border-left-color: #3498db; background: #cce5ff; }
        .status-box.failed { border-left-color: #e74c3c; background: #f8d7da; }
        .status-count {
            font-size: 16px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 3px;
        }
        .status-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        /* Transactions Table */
        .transactions-section {
            margin-bottom: 20px;
        }
        .transactions-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-top: 10px;
        }
        .transactions-table th {
            background: #34495e;
            color: #fff;
            padding: 10px;
            text-align: left;
            font-weight: 700;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .transactions-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: middle;
        }
        .transactions-table tr:nth-child(even) { background: #f9f9f9; }
        .order-number { 
            font-weight: 700; 
            color: #2c3e50; 
            font-family: monospace;
        }
        .order-total { 
            font-weight: 700; 
            color: #27ae60; 
            text-align: right;
        }
        .order-customer { color: #555; }
        .order-date { color: #999; }
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            text-align: center;
        }
        .badge-delivered { background: #d4edda; color: #155724; }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-in-progress { background: #cce5ff; color: #004085; }
        .badge-failed { background: #f8d7da; color: #721c24; }
        
        /* Totals Row */
        .transactions-table tfoot tr {
            background: #34495e;
            color: #fff;
            font-weight: 700;
        }
        .transactions-table tfoot td {
            padding: 10px;
            border-bottom: none;
        }
        
        /* Footer */
        .report-footer {
            text-align: center;
            padding-top: 20px;
            margin-top: 30px;
            border-top: 2px solid #e0e0e0;
            font-size: 9px;
            color: #999;
        }
        .footer-line {
            margin-bottom: 4px;
        }
        .footer-disclaimer {
            font-style: italic;
            color: #aaa;
            margin-top: 5px;
        }
        .footer-badge {
            display: inline-block;
            background: #2c3e50;
            color: #fff;
            padding: 2px 8px;
            border-radius: 2px;
            font-size: 8px;
            margin-top: 5px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Company Header -->
        <div class="company-header">
            <div class="logo-box">
                <span style="font-size: 18px; font-weight: 700;">HRMS</span>
            </div>
            <div class="company-name">HRMS / Hardware Retail Management System</div>
            <div class="company-tagline">Sales & Order Management Platform</div>
            <div class="company-info">
                Davao City, Philippines<br>
                support@hrms-system.com
            </div>
        </div>
        
        <!-- Report Header & Metadata -->
        <div class="report-header">
            <div class="report-title">Sales Performance Report</div>
            <div class="report-meta">
                Period: <strong>{{ $period_label }}</strong> | Date Range: <strong>{{ $from }} to {{ $to }}</strong>
            </div>
        </div>
        
        <!-- Generated Timestamp -->
        <div class="generated-info">
            Generated: <strong>{{ $generated_at }}</strong> (Asia/Manila)
        </div>
        
        <!-- Executive Summary -->
        <div class="summary-section">
            <div class="section-title">📊 Executive Summary</div>
            <table class="summary-table">
                <tr>
                    <td>
                        <div class="summary-label">Total Revenue</div>
                        <div class="summary-value text-green">₱ {{ number_format($summary['total_revenue'], 2) }}</div>
                    </td>
                    <td>
                        <div class="summary-label">Total Orders</div>
                        <div class="summary-value text-blue">{{ number_format($summary['total_orders']) }}</div>
                    </td>
                    <td>
                        <div class="summary-label">Avg Order Value</div>
                        <div class="summary-value text-purple">₱ {{ number_format($summary['average_order_value'], 2) }}</div>
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- KPI Summary -->
        <div class="summary-section">
            <div class="section-title">📈 Key Performance Indicators</div>
            <table class="summary-table">
                <tr>
                    <td>
                        <div class="summary-label">Delivered Orders</div>
                        <div class="summary-value text-green">{{ number_format($summary['delivered_orders']) }}</div>
                    </td>
                    <td>
                        <div class="summary-label">Pending Orders</div>
                        <div class="summary-value text-blue">{{ number_format($summary['pending_orders']) }}</div>
                    </td>
                    <td>
                        <div class="summary-label">In Progress Orders</div>
                        <div class="summary-value text-purple">{{ number_format($summary['in_progress_orders']) }}</div>
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Order Status Breakdown -->
        <div class="status-section">
            <div style="margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
                <div class="section-title" style="margin-bottom: 12px;">📋 Order Status Summary</div>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 25%; padding: 12px; text-align: center; border: 1px solid #e0e0e0;">
                            <div class="status-box delivered">
                                <div class="status-count">{{ number_format($summary['delivered_orders']) }}</div>
                                <div class="status-label">Delivered</div>
                            </div>
                        </td>
                        <td style="width: 25%; padding: 12px; text-align: center; border: 1px solid #e0e0e0;">
                            <div class="status-box pending">
                                <div class="status-count">{{ number_format($summary['pending_orders']) }}</div>
                                <div class="status-label">Pending</div>
                            </div>
                        </td>
                        <td style="width: 25%; padding: 12px; text-align: center; border: 1px solid #e0e0e0;">
                            <div class="status-box in-progress">
                                <div class="status-count">{{ number_format($summary['in_progress_orders']) }}</div>
                                <div class="status-label">In Progress</div>
                            </div>
                        </td>
                        <td style="width: 25%; padding: 12px; text-align: center; border: 1px solid #e0e0e0;">
                            <div class="status-box failed">
                                <div class="status-count">{{ number_format($summary['failed_orders']) }}</div>
                                <div class="status-label">Failed</div>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        
        <!-- Detailed Sales Transactions Table -->
        <div class="transactions-section">
            <div class="section-title">📑 Detailed Sales Transactions</div>
            <table class="transactions-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">Order #</th>
                        <th style="width: 25%;">Customer</th>
                        <th style="width: 20%;">Total</th>
                        <th style="width: 18%;">Status</th>
                        <th style="width: 25%;">Date</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($sales as $sale)
                        <tr>
                            <td class="order-number">{{ $sale->order_number }}</td>
                            <td class="order-customer">{{ optional($sale->customer)->name ?? 'Guest' }}</td>
                            <td class="order-total">₱ {{ number_format($sale->total_amount, 2) }}</td>
                            <td>
                                <span class="status-badge badge-{{ str_replace('_', '-', $sale->status) }}">
                                    {{ ucwords(str_replace('_', ' ', $sale->status)) }}
                                </span>
                            </td>
                            <td class="order-date">{{ $sale->created_at->format('M d, Y') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 20px; color: #999;">No sales data available for the selected period</td>
                        </tr>
                    @endforelse
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="text-align: right; font-weight: 700;">TOTALS:</td>
                        <td style="font-weight: 700;">₱ {{ number_format($summary['total_revenue'], 2) }}</td>
                        <td colspan="2" style="text-align: center; font-weight: 700;">{{ number_format($summary['total_orders']) }} Orders</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <!-- Footer -->
        <div class="report-footer">
            <div class="footer-line">This is an official sales report generated by HRMS (Hardware Retail Management System)</div>
            <div class="footer-line" style="margin-top: 8px;">Report prepared by: <strong>System-Generated</strong></div>
            <div class="footer-disclaimer">
                ⚠️ CONFIDENTIAL - For internal use only. Distribution without authorization is prohibited.
            </div>
            <div class="footer-badge">HRMS v1.0 | System Generated</div>
        </div>
    </div>
</body>
</html>
