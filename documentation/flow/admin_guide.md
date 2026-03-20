# Admin Operations Flow

The Admin role is the "Controller" of the entire system, managing both the supply chain and retail fulfillment.

## 1. Inventory Management
- **Monitor**: View real-time stock levels across Store and Warehouse.
- **Thresholds**: System flags products that fall below the `reorder_threshold`.
- **Transfer**: Move stock from `Warehouse` (where suppliers deliver) to `Store` (where customers buy).

## 2. Procurement (Supply Chain) - Specific Module
- **Request Module**: Admin enters a dedicated module to browse the Supplier Catalog.
- **Stock Request**: When a product is selected, a form appears showing current stock levels.
- **Add/Subtract Logic**: Admin can specify the exact quantity to "request" (order) from the supplier.
- **Category Filter**: Admins browse requests filtered by a specific category to maintain organization.
- **Initiate**: Click "Request" to generate a Purchase Order.
- **Recieve (Automated)**: Once the Supplier accepts the request, stock is directly and automatically added to the Warehouse inventory.

## 3. Sales Fulfillment & Visibility
> [!IMPORTANT]
> **Product Creation**: The "New Product" button is removed from the Product Module. Products are now automatically created and moved to the store when an Admin performs a **Transfer to Store** from the Inventory module. This ensures all items originate from verified warehouse stock.

- **Display in Shop**: Use the `is_active` toggle to make products visible to customers after transfer.

## 4. Administrative Controls
- **User Management**: Suspend/Restore accounts.
- **Settings**: Define Unit Types (Kg, Pcs), Categories, and Variant Types (Color, Size).
- **Reports**: View Revenue, Top Products, and Inventory logs.
