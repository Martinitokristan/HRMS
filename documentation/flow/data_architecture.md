# Data Flow & Architecture

This document tracks how data moves through the HRMS system across the four roles.

## High-Level Visual Flow
```mermaid
sequenceDiagram
    participant C as Customer
    participant A as Admin
    participant S as Supplier
    participant R as Rider

    Note over A,S: Procurement Flow
    A->>S: Creates Stock Request (PO)
    S-->>A: Approves Request
    A->>A: Automated Inventory Update (Direct to Warehouse Stock)
    A->>A: Transfers Stock (Warehouse -> Store)

    Note over C,A: Retail Flow
    C->>A: Places Order (Reduces Store Stock)
    A->>A: Confirms Order
    A->>R: Assigns Delivery

    Note over R,C: Last Mile Flow
    R->>R: Picks up Items
    R->>C: Sends Distance Updates (Proximity Alert at <1km)
    R->>C: Delivers & Uploads Proof
    C->>R: Rates Experience
```

## Inventory Logic
The system uses a **Split-Inventory Model**:

| Feature | Logic |
| :--- | :--- |
| **Warehouse Stock** | Incremented by Supplier Deliveries. Managed by Admin. |
| **Store Stock** | Decremented by Customer Orders. Incremented by Admin Transfers. |
| **Variant Stock** | For products with variations (e.g., 500g vs 1kg), stock is managed at the variant level. |

## Status State Machine

### Sale (Retail) Statuses
`pending` -> `confirmed` -> `out_for_delivery` -> `delivered`
*Alternate paths: `cancelled`, `returned`.*

### Purchase Order (Procurement) Statuses
`pending` -> `pending_supplier` -> `accepted` -> `supplier_delivered` -> `received`
*Alternate paths: `rejected`, `cancelled`.*

### Delivery Statuses
`pending` -> `in_progress` -> `delivered`
*Alternate path: `failed`.*
