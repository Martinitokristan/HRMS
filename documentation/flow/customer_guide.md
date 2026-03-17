# Customer Operations Flow

As a Customer, the flow is focused on product discovery, purchasing, and receiving service.

## 1. Ordering Process
- **Browse**: View catalog and product variants (Size, Color, etc.).
- **Checkout**: Place an order (`Sale` created).
- **Stock Impact**: The moment an order is placed, the items are **reserved**. The system decrements the "Store Stock" immediately to prevent over-selling.
- **Tracking**: A tracking number is automatically generated (e.g., `TRK-8B1A2C3D`).

## 2. Order Lifecycle
- **Pending**: Waiting for Admin confirmation.
- **Confirmed**: Admin has acknowledged the order.
- **Out for Delivery**: A Rider has been assigned and has picked up the order.
- **Delivered**: Final status once the Rider confirms the physical hand-over.

## 3. Interactive Features
- **Notifications**: Polled automatically. Customers receive alerts for:
    - Order Confirmation.
    - **Rider Proximity**: An alert is triggered when the Rider is within **1km** of the customer's coordinates.
    - Successful Delivery.
- **Rating**: Customers can submit a 1-5 star rating and comment after the delivery is complete.
- **Cancellation**: Permitted only while the order is in `pending` status. Cancelling restores the reserved stock to the store.
