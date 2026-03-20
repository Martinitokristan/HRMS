# HRMS Storage Structure Documentation

## Overview
This document outlines the organized storage structure for all image and file uploads in the HRMS system.

## Storage Link Status
✅ **ACTIVE**: `php artisan storage:link` has been executed
- `public/storage` → `storage/app/public` (symbolic link created)

## Folder Structure

### `/storage/app/public/` (Internal Storage)
```
├── products/                    # Admin product images
├── supplier-products/           # Supplier product main images
├── supplier-product-variants/   # Supplier product variant images
├── product-variants/           # Admin product variant images
├── supplier-ids/               # Supplier ID verification documents
├── rider-photos/              # Rider profile photos
├── rider_ids/                 # Rider ID verification documents
├── customer-avatars/           # Customer profile pictures
├── profile-photos/             # User profile photos (general)
├── delivery-proofs/            # Delivery proof photos
└── category-images/            # Category icon images
```

### `/public/storage/` (Publicly Accessible)
Same structure as above - this is the publicly accessible folder via the symbolic link.

## Controller Usage

### SupplierProductController
- **Main Images**: `supplier-products/`
- **Variant Images**: `supplier-product-variants/`

### ProductController  
- **Variant Images**: `product-variants/`

### AuthController
- **Rider IDs**: `rider_ids/`

### RiderController
- **Profile Photos**: `profile-photos/`

### DeliveryController
- **Proof Photos**: `delivery-proofs/`

## Access URLs
All files are accessible via: `https://your-domain.com/storage/{folder}/{filename}`

Example:
- Supplier product image: `/storage/supplier-products/image.jpg`
- Rider ID document: `/storage/rider_ids/document.pdf`

## File Upload Rules
- Images: Use `store('folder-name', 'public')` for public access
- Documents: Use `store('folder-name', 'public')` for public access
- All files are stored in `storage/app/public/` but accessed via `/storage/`

## Maintenance
- Run `php artisan storage:link` if the symbolic link is broken
- Ensure folders have proper write permissions
- Consider implementing file cleanup for old uploads
- Use proper validation for file types and sizes

## Security Notes
- All uploaded files are publicly accessible via `/storage/`
- Consider implementing access controls for sensitive documents
- Validate file types to prevent malicious uploads
- Consider using separate storage for sensitive documents
