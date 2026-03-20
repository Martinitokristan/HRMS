# 🏗️ HRMS - Hardware Retail Management System

## 📋 Overview

HRMS is a comprehensive **Hardware Retail Management System** built with Laravel 8 and React 18. This full-stack application manages inventory, sales, deliveries, suppliers, customers, and riders for a hardware store business.

---

## 🛠️ Technology Stack

### **Backend Technologies**
- **Framework**: Laravel 8.75
- **PHP Version**: ^7.3|^8.0
- **Database**: MySQL (via XAMPP)
- **Authentication**: Laravel Sanctum
- **PDF Generation**: Laravel DomPDF + DomPDF
- **HTTP Client**: Guzzle HTTP
- **CORS**: Fruitcake Laravel CORS
- **Email**: SendinBlue API v3 SDK

### **Frontend Technologies**
- **Framework**: React 18.2.0
- **Routing**: React Router DOM 6.8.1
- **Build Tool**: Laravel Mix 6.0.6
- **Styling**: Tailwind CSS 3.4.1
- **UI Components**: Shadcn/ui (Radix UI based)
- **State Management**: Zustand 4.5.2
- **HTTP Client**: Axios 0.21
- **Form Handling**: React Hook Form 7.71.2 + Zod 3.25.76
- **Data Fetching**: TanStack React Query 4.36.1
- **Charts**: Recharts 2.15.4
- **Maps**: Leaflet 1.9.4 + React Leaflet 3.2.5
- **Date Handling**: date-fns 4.1.0
- **Notifications**: Sonner 2.0.7

### **Development Tools**
- **Package Manager**: Composer (PHP), npm (Node.js)
- **Environment**: Windows XAMPP
- **Version Control**: Git
- **Setup Scripts**: setup.bat (Windows), setup.sh (Unix)

---

## 🏗️ Architecture Overview

### **Application Structure**
```
HRMS-HRMSv9/
├── app/                     # Laravel Application Core
│   ├── Http/               # Controllers & Middleware
│   ├── Models/             # Eloquent Models
│   ├── Services/           # Business Logic Services
│   ├── Notifications/     # Notification Classes
│   └── Providers/          # Service Providers
├── database/               # Database Layer
│   ├── migrations/         # Database Migrations
│   ├── seeders/           # Database Seeders
│   └── factories/         # Model Factories
├── resources/             # Frontend Assets
│   ├── js/                # React Application
│   ├── css/               # Stylesheets
│   └── views/             # Blade Templates
├── routes/                # API & Web Routes
├── storage/               # File Storage
├── vendor/                # Composer Dependencies
└── public/                # Public Web Assets
```

---

## 🔄 Application Flow & Logic

### **Authentication Flow**
1. **Unified Login System**: Single login page handles all roles
2. **Role-Based Routing**: Users redirected based on role (admin/customer/rider/supplier)
3. **Token-Based Auth**: Laravel Sanctum for admin/customer/rider, custom tokens for suppliers
4. **Protected Routes**: Middleware guards API endpoints

### **User Roles & Permissions**
- **Admin**: Full system access, manages all entities
- **Customer**: Shop products, cart, orders, reviews
- **Rider**: Delivery management, location tracking
- **Supplier**: Product catalog, purchase orders

### **Business Logic Flow**

#### **Product Management**
```
Supplier → Product Creation → Admin Approval → Inventory Stock → Customer Purchase
```

#### **Order Processing**
```
Customer Order → Payment → Admin Assignment → Rider Pickup → Delivery → Completion
```

#### **Inventory Management**
```
Purchase Order → Supplier Delivery → Stock In → Sales Tracking → Low Stock Alerts
```

---

## 📁 Directory Structure Deep Dive

### **Backend Structure**

#### **`app/Http/Controllers/`** - API Controllers
- **Auth**: Login/registration for all user types
- **ProductController**: Product CRUD operations
- **InventoryController**: Stock management, transfers, adjustments
- **SaleController**: Order processing, returns, cancellations
- **PurchaseOrderController**: Supplier order management
- **DeliveryController**: Delivery assignment, tracking, ratings
- **ReportController**: Analytics, exports, business insights
- **RiderController**: Rider management, location updates
- **SupplierController**: Supplier administration
- **CustomerController**: Customer profile and orders
- **SettingsController**: System configuration

#### **`app/Models/`** - Eloquent Models
- **User**: Base user model with role-based relationships
- **Product**: Core product entity with variants
- **ProductVariant**: Size/color/weight variations
- **Inventory**: Stock tracking per product/variant
- **Sale/SaleItem**: Order management
- **PurchaseOrder/POItem**: Supplier orders
- **Delivery**: Delivery logistics
- **Category**: Product categorization
- **Supplier**: Supplier management
- **RiderProfile**: Rider-specific data
- **CustomerProfile**: Customer-specific data

#### **`app/Services/`**
- **DistanceCalculator**: Geospatial calculations for delivery

### **Frontend Structure**

#### **`resources/js/components/`** - React Components

**Layout Components**
- `AdminLayout`: Main admin dashboard layout
- `SupplierLayout`: Supplier portal layout
- Navigation, header, sidebar components

**Feature Modules**
- `admin/`: Admin-specific pages (dashboard, returns, analytics)
- `auth/`: Login, registration, role selection
- `customer-portal/`: Shopping cart, product browsing, orders
- `delivery/`: Delivery management interface
- `inventory/`: Stock management, transfers, reports
- `rider/`: Rider dashboard, delivery tracking
- `supplier/`: Supplier product catalog, orders
- `products/`: Product management, variants
- `reports/`: Analytics, charts, exports
- `settings/`: System configuration
- `shared/`: Reusable UI components
- `ui/`: Shadcn/ui components

**State Management**
- `context/AuthContext`: Authentication state
- `context/SupplierAuthContext`: Supplier authentication
- `context/ToastContext`: Global notifications

---

## 🗄️ Database Schema

### **Core Tables**
- **users**: All user types (admin, customer, rider)
- **products**: Main product catalog
- **product_variants**: Size/color/weight variations
- **inventory**: Stock levels and locations
- **sales/sale_items**: Customer orders
- **purchase_orders/purchase_order_items**: Supplier orders
- **deliveries**: Delivery logistics and tracking
- **categories**: Product categorization
- **suppliers**: Supplier information
- **notifications**: System notifications
- **settings**: Configuration parameters

### **Relationship Overview**
```
Users (1:N) → Sales → SaleItems → Products
Products (1:N) → ProductVariants → Inventory
Suppliers (1:N) → PurchaseOrders → POItems → Products
Deliveries (1:1) → Sales (1:1) → Riders
```

---

## 🚀 Deployment & Setup

### **Development Setup**
1. **Environment**: Windows XAMPP stack
2. **Database**: MySQL via XAMPP
3. **Setup Scripts**: 
   - `setup.bat` (Windows)
   - `setup.sh` (Unix/Linux)
4. **Commands**:
   ```bash
   php artisan migrate:fresh --seed --force
   php artisan serve
   npm run dev
   ```

### **Production Considerations**
- Environment variables in `.env`
- Database migrations with seeding
- Asset compilation with `npm run production`
- Storage link creation
- Application key generation

---

## 🔧 Key Features & Logic

### **Multi-Role System**
- Unified login with role-based routing
- Separate authentication contexts for suppliers
- Role-protected API endpoints

### **Real-Time Features**
- Rider location tracking
- Delivery status updates
- Customer notifications
- Cart reservation system

### **Business Intelligence**
- Sales analytics with Recharts
- Inventory forecasting
- Customer behavior analysis
- Rating analytics system

### **E-Commerce Features**
- Product catalog with variants
- Shopping cart with reservations
- Order management system
- Product review system
- Return processing

### **Supply Chain Management**
- Supplier product catalogs
- Purchase order processing
- Inventory transfers
- Delivery logistics

---

## 🎯 Development Rules Compliance

This system follows strict development rules:
- **Shadcn/ui Components Only**: Consistent UI component library
- **No Duplicate Migration Files**: Update original migrations
- **Proper Error Handling**: Try-catch blocks throughout
- **Responsive Design**: Mobile-first approach
- **Security Best Practices**: Input validation, CSRF protection
- **Clean Architecture**: Separation of concerns, modular design

---

## 📊 API Architecture

### **Route Organization**
- **Public Routes**: Authentication, product browsing
- **Protected Routes**: Role-based API access
- **Supplier Routes**: Separate authentication middleware
- **Admin Routes**: Full system management

### **Response Standards**
- Consistent JSON responses
- Proper HTTP status codes
- Error handling with meaningful messages
- Pagination for large datasets

---

## 🔍 Monitoring & Analytics

### **Business Metrics**
- Sales performance tracking
- Inventory turnover analysis
- Customer behavior insights
- Delivery efficiency metrics
- Supplier performance analytics

### **System Monitoring**
- Error logging with Laravel
- Performance monitoring
- User activity tracking
- System health checks

---

## 🚧 Future Enhancements

### **Planned Features**
- Real-time notifications (WebSocket)
- Advanced reporting dashboards
- Mobile applications
- API rate limiting
- Caching optimization
- Payment gateway integration

### **Scalability Considerations**
- Database optimization
- Load balancing
- CDN implementation
- Microservices architecture

---

## 📞 Support & Maintenance

### **Default Credentials**
- **Admin**: admin@hrms.com / password
- **Customer**: customer@hrms.com / password
- **Suppliers**: Created during seeding (3 suppliers with test credentials)

### **Maintenance Commands**
```bash
# Database reset
php artisan migrate:fresh --seed

# Asset compilation
npm run dev  # Development
npm run production  # Production

# Cache clearing
php artisan cache:clear
php artisan config:clear
php artisan view:clear
```

---

## 🎉 Conclusion

HRMS is a production-ready, feature-rich hardware retail management system that demonstrates modern full-stack development practices with Laravel and React. The system provides comprehensive tools for managing all aspects of a hardware retail business, from inventory management to customer service and supplier relations.

The architecture supports scalability, maintainability, and follows industry best practices for security and performance.
