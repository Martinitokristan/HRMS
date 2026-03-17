# HRMS System Operations Overview

This directory contains detailed documentation on how the Human Resource and Management System (HRMS) handles the end-to-end lifecycle of product procurement, sales, and delivery.

## System Roles
1.  **Admin**: The central orchestrator. Manages inventory, assigns deliveries, and initiates procurement.
2.  **Customer**: The end-user. Browses products, places orders, and tracks deliveries.
3.  **Supplier**: The external partner. Receives purchase orders and replenishes warehouse stock.
4.  **Rider**: The logistics partner. Handles the physical movement of goods from store to customer.

## Core Flow Summary
The system operates on two interconnected cycles:
- **Procurement Cycle**: Admin -> Supplier -> Warehouse.
- **Retail Cycle**: Customer -> Admin -> Rider -> Customer.

### Logical Guides
- [Customer Flow](customer_guide.md)
- [Admin Flow](admin_guide.md)
- [Supplier Flow](supplier_guide.md)
- [Rider Flow](rider_guide.md)

### Technical Details
- [Data Flow & Architecture](data_architecture.md)
