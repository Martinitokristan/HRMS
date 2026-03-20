# Rider Operations Flow

Riders handle the "Last Mile" of the system, moving products from the Store to the Customer.

## 1. Work Management
- **Availability**: Riders toggle between "Online" and "Offline".
- **Assigned**: Once an Admin assigns a delivery, the Rider receives a notification.
- **Availability Logic**: Assigning a rider automatically changes their status to `on_delivery`.

## 2. Delivery Execution
- **Pickup**: Rider marks the items as picked up.
- **Navigation**: The system provides Customer coordinates and tracking numbers.
- **Location Updates**: As the Rider moves, they send GPS coordinate updates. If they cross the 1km radius of the customer, the system triggers the "Rider is nearby" alert to the customer.

## 3. Completion
- **Proof**: Rider can upload a photo as "Proof of Delivery".
- **Success**: Mark as "Delivered".
- **Impact**: Success increases the Rider's total delivery count and sets their status back to "Available".
