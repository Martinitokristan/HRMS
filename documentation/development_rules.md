# 🎯 DEVELOPMENT RULES SYSTEM

## **📋 RULES TO FOLLOW FOR EVERY TASK**

### **🔧 TECHNICAL RULES**
1. **ALWAYS use shadcn components** for any UI additions
2. **NEVER create duplicate functionality** - check existing code first
3. **ALWAYS add proper error handling** with try-catch blocks
4. **NEVER hardcode values** - use variables/constants
5. **ALWAYS follow existing code patterns** and naming conventions
6. **NEVER break existing functionality** - test before and after
7. **ALWAYS add proper loading states** for async operations
8. **NEVER leave console.log statements** in production code

### **🎨 UI/UX RULES**
1. **ALWAYS use shadcn components**: Card, Badge, Button, Progress, Tabs, etc.
2. **NEVER use inline styles** - use Tailwind CSS classes
3. **ALWAYS maintain responsive design** principles
4. **NEVER use generic colors** - use semantic color classes
5. **ALWAYS add proper spacing** with consistent margins/padding
6. **NEVER create empty states** without helpful messages
7. **ALWAYS add hover/focus states** for interactive elements
8. **NEVER use pixel values** for responsive layouts

### **📁 FILE ORGANIZATION RULES**
1. **ALWAYS place components** in appropriate directories
2. **NEVER create files** in wrong locations
3. **ALWAYS use descriptive file names** with proper casing
4. **NEVER mix concerns** - keep components focused
5. **ALWAYS add proper imports** at the top of files
6. **NEVER import unused dependencies**
7. **ALWAYS export components** properly
8. **NEVER create circular dependencies**
9. **✅ USE .JS FILES** for creating logic and UI components
10. **✅ USE .JSX FILES** ONLY when adding components to UI folder with shadcn
11. **✅ NEVER CREATE MIGRATION FILES** for simple table attribute additions
12. **✅ UPDATE ORIGINAL MIGRATION** and migrate only that file

### **🔄 API RULES**
1. **ALWAYS check existing endpoints** before creating new ones
2. **NEVER duplicate API functionality**
3. **ALWAYS use proper HTTP methods** (GET, POST, PUT, DELETE)
4. **NEVER use GET for destructive operations**
5. **ALWAYS return consistent JSON responses**
6. **NEVER expose sensitive data** in API responses
7. **ALWAYS add proper validation** for API inputs
8. **NEVER forget error responses** with proper status codes

### **📄 FILE TYPE SPECIFIC RULES**
1. **✅ USE .JS FILES** for creating logic and UI components
   - General React components
   - Business logic components
   - Utility functions
   - Service classes
2. **✅ USE SHADCN CLI** to install shadcn UI components
   - Install with: `npx shadcn-ui@latest add button`
   - Available components: button, card, badge, tabs, textarea, input, etc.
   - Components are automatically added to @/components/ui/ folder
3. **✅ NEVER CREATE MIGRATION FILES** for simple table attribute additions
   - Adding new columns to existing tables
   - Modifying column types
   - Adding indexes or constraints
4. **✅ UPDATE ORIGINAL MIGRATION** and migrate only that file
   - Modify the existing migration file
   - Run `php artisan migrate:refresh --path=database/migrations/specific_file.php`
   - Never create duplicate migrations for simple changes

### **🧪 TESTING RULES**
1. **ALWAYS test new functionality** before marking complete
2. **NEVER assume code works** without verification
3. **ALWAYS test edge cases** and error scenarios
4. **NEVER skip testing responsive design**
5. **ALWAYS verify API responses** are correct
6. **NEVER ignore console errors**
7. **ALWAYS test user interactions** (clicks, forms, etc.)
8. **NEVER deploy untested code**

### **📝 DOCUMENTATION RULES**
1. **ALWAYS update documentation** after each task
2. **NEVER leave documentation outdated**
3. **ALWAYS record implementation details** and decisions
4. **NEVER forget to update progress tracking**
5. **ALWAYS note any limitations** or known issues
6. **NEVER skip adding testing checklists**
7. **ALWAYS update file lists** and component usage
8. **NEVER forget success criteria** verification
9. **ALWAYS update `docs/HRMSBOSHET-System-Technical-Documentation.md`** whenever any code change is made — add new sections, update existing flowcharts, API references, database schemas, or security documentation to reflect the change
10. **NEVER ship a code change without a corresponding documentation update** — the technical documentation must always mirror the current state of the codebase

### **🗂️ ROUTING RULES**
1. **ALWAYS check existing routes** before adding new ones
2. **NEVER create duplicate routes**
3. **ALWAYS use descriptive route paths**
4. **NEVER use nested routes unnecessarily**
5. **ALWAYS add proper route protection** for authenticated areas
6. **NEVER expose admin routes** to public
7. **ALWAYS update navigation** when adding new routes
8. **NEVER forget route parameters** validation

### **⚡ PERFORMANCE RULES**
1. **ALWAYS optimize database queries** with proper indexes
2. **NEVER use N+1 queries** - use eager loading
3. **ALWAYS implement caching** for frequently accessed data
4. **NEVER load unnecessary data** in API responses
5. **ALWAYS use React.memo** for expensive components
6. **NEVER cause unnecessary re-renders**
7. **ALWAYS implement proper state management**
8. **NEVER create memory leaks** with uncleaned effects

### **🔒 SECURITY RULES**
1. **ALWAYS validate user input** on both client and server
2. **NEVER trust client-side data** without validation
3. **ALWAYS use proper authentication** for protected routes
4. **NEVER expose sensitive information** in frontend
5. **ALWAYS sanitize user-generated content**
6. **NEVER use eval() or similar dangerous functions**
7. **ALWAYS implement proper CORS policies**
8. **NEVER store secrets** in frontend code

### **🎯 TASK EXECUTION RULES**
1. **ALWAYS understand requirements** before starting
2. **NEVER make assumptions** - ask for clarification
3. **ALWAYS break down complex tasks** into smaller steps
4. **NEVER skip planning** - think through implementation
5. **ALWAYS use existing patterns** and conventions
6. **NEVER reinvent the wheel** - use existing solutions
7. **ALWAYS test incrementally** as you build
8. **NEVER wait until the end** to test

### **📊 COMMUNICATION RULES**
1. **ALWAYS provide clear progress updates**
2. **NEVER go silent** during implementation
3. **ALWAYS explain technical decisions** when needed
4. **NEVER use jargon** without explanation
5. **ALWAYS ask for clarification** when unsure
6. **NEVER proceed with assumptions**
7. **ALWAYS confirm completion** before moving on
8. **NEVER skip final verification** with user

---

## **⚡ REAL-TIME SYNC RULES (Pusher + useSilentRefresh)**

> Every page that **displays data fetched from the API** MUST use `useSilentRefresh` so all logged-in users across all devices see updates instantly without manually reloading.

### **Frontend Rule — Every New Page Component**

**Step 1: Import the hook**
```js
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
```

**Step 2: Call the hook inside your component with the correct stale key**
```js
const { refreshTrigger } = useSilentRefresh('admin_orders'); // pick key from table below
```

**Step 3: Add `refreshTrigger` to your data-fetching `useEffect` dependency array**
```js
useEffect(() => {
    fetchData();
}, [page, search, refreshTrigger]); // ← always include refreshTrigger
```

**That's it.** When any backend mutation broadcasts that stale key, your component auto-refetches silently.

---

### **📋 Stale Key Reference Table**

Pick the key that matches the data your page displays:

| Stale Key | Used by | Triggered when |
|---|---|---|
| `admin_dashboard` | Dashboard, Reports, Analytics | Orders/sales change |
| `admin_orders` | Orders list, GCash Logs | Order created/updated |
| `admin_purchases` | Purchase Orders (admin) | PO created/approved/received |
| `admin_inventory` | Inventory (Stock/Purchase/Sales tabs) | Stock transferred, PO received |
| `admin_returns` | Returns page | Return requested/updated |
| `admin_reviews` | Reviews, Rating Analytics | Review submitted |
| `admin_users` | Users page | User created/suspended/restored |
| `admin_riders` | Riders page | Rider approved/scheduled |
| `admin_deliveries` | Delivery page, DeliveryTracking | Delivery status updated |
| `admin_products` | Products page | Product created/updated/deleted |
| `admin_notifications` | Admin notifications | Any notification |
| `supplier_dashboard` | Supplier Dashboard | PO status changes |
| `supplier_orders` | Supplier Orders | PO created/approved/received |
| `supplier_products` | Supplier Products, Supplier Catalog | Product/stock updated |
| `supplier_notifications` | Supplier notifications | PO accepted/rejected |
| `supplier_settings` | Supplier Settings | Settings saved |
| `customer_shop` | Customer home/shop | Product stock changes |
| `customer_orders` | Order history | Order placed/status changed |
| `customer_cart` | Shopping cart | Cart updated |
| `customer_returns` | Customer returns | Return status updated |
| `customer_notifications` | Customer notifications | Notification received |
| `rider_dashboard` | Rider dashboard | Delivery assigned |
| `rider_notifications` | Rider notifications | Notification received |
| `product_reviews` | Product reviews | Review submitted |

---

### **Backend Rule — Every New Controller Mutation**

Every `store`, `update`, `destroy`, and status-change method in a controller **MUST** call `broadcast()` after the DB operation succeeds.

**Step 1: Import the event at the top of your controller**
```php
use App\Events\DataMutated;
```

**Step 2: Add broadcast calls after the mutation**
```php
// Broadcast to admin channel
broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'order.created'));

// Broadcast to supplier channel (if supplier-specific)
broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_orders', 'supplier_dashboard'], 'order.created'));

// Broadcast to customer channel (if customer-specific)
broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'order.created'));
```

**Channel naming rules:**
- `private-admin` — for all admin users
- `private-supplier.{supplier_id}` — for a specific supplier
- `private-customer.{user_id}` — for a specific customer
- `private-rider.{user_id}` — for a specific rider

**Always include multiple stale keys** if the mutation affects multiple pages (e.g. creating a PO affects both `admin_purchases` AND `admin_dashboard`).

---

### **✅ New Page Checklist**

When adding any new page that fetches data:

- [ ] `useSilentRefresh` imported from `../../hooks/useSilentRefresh`
- [ ] Correct stale key selected from the reference table above
- [ ] `refreshTrigger` added to the `useEffect` dependency array
- [ ] If the page doesn't exist in the stale key table, add a new key to `resources/js/store/dataStore.js` under `STALE_KEYS`

### **✅ New Controller Method Checklist**

When adding any new backend mutation (create/update/delete/status change):

- [ ] `use App\Events\DataMutated;` imported
- [ ] `broadcast(new DataMutated(...))` called after successful DB operation
- [ ] Correct channel used (`private-admin`, `private-supplier.{id}`, etc.)
- [ ] All affected stale keys included in the array
- [ ] **No `str_starts_with` / `str_ends_with` / `str_contains`** — use `strpos()` instead (PHP 7.4 compatibility)

### **⚠️ PHP 7.4 Compatibility**

This project runs PHP 7.4. These PHP 8.0+ functions will cause silent broadcast failures:

| ❌ PHP 8.0+ (breaks on 7.4) | ✅ Use instead |
|---|---|
| `str_starts_with($s, 'x')` | `strpos($s, 'x') === 0` |
| `str_ends_with($s, 'x')` | `substr($s, -strlen('x')) === 'x'` |
| `str_contains($s, 'x')` | `strpos($s, 'x') !== false` |
| Arrow functions `fn() =>` | Regular `function() use (...)` |

---

## **🚀 TASK EXECUTION TEMPLATE**

### **Before Starting ANY Task:**
1. ✅ **Read requirements carefully**
2. ✅ **Check existing codebase** for similar functionality
3. ✅ **Identify shadcn components** needed
4. ✅ **Plan implementation approach**
5. ✅ **Identify potential risks/challenges**

### **During Implementation:**
1. ✅ **Follow all technical rules**
2. ✅ **Use shadcn components consistently**
3. ✅ **Test each component** as built
4. ✅ **Handle errors properly**
5. ✅ **Maintain code quality**

### **After Completion:**
1. ✅ **Test thoroughly** (all scenarios)
2. ✅ **Update documentation**
3. ✅ **Update `docs/HRMSBOSHET-System-Technical-Documentation.md`** — reflect new/changed APIs, database schemas, flowcharts, or security rules
4. ✅ **Verify success criteria**
5. ✅ **Get user confirmation**
6. ✅ **Clean up any temporary code**

---

## **📋 CHECKLIST FOR EVERY TASK**

### **Pre-Task Checklist:**
- [ ] Requirements fully understood?
- [ ] Existing code checked?
- [ ] shadcn components identified?
- [ ] Implementation planned?
- [ ] Risks identified?
- [ ] File type determined (.js vs .jsx)?
- [ ] Migration strategy planned?

### **During-Task Checklist:**
- [ ] Following all technical rules?
- [ ] Using shadcn components?
- [ ] Testing incrementally?
- [ ] Handling errors properly?
- [ ] Maintaining code quality?
- [ ] Using correct file extensions?
- [ ] Following migration rules?

### **Post-Task Checklist:**
- [ ] Functionality tested?
- [ ] Responsive design verified?
- [ ] Documentation updated?
- [ ] `docs/HRMSBOSHET-System-Technical-Documentation.md` updated to reflect changes?
- [ ] Success criteria met?
- [ ] User confirmed completion?

---

## **🎨 SHADCN COMPONENTS REFERENCE**

### **Commonly Used Components:**
- **Card, CardContent, CardHeader, CardTitle** - Layout structure
- **Badge** - Status indicators and counts
- **Button** - Actions and interactions
- **Progress** - Progress bars and meters
- **Tabs, TabsContent, TabsList, TabsTrigger** - Navigation
- **Separator** - Visual separation
- **Icons** - Star, Bell, Users, Settings, etc.

### **Component Usage Rules:**
1. **ALWAYS import from @/components/ui**
2. **NEVER mix with other UI libraries**
3. **ALWAYS use consistent styling**
4. **NEVER override shadcn styles** unless necessary
5. **✅ USE .JSX FILES** for shadcn UI components
6. **✅ USE .JS FILES** for general React components
7. **✅ NEVER CREATE MIGRATION FILES** for simple table changes
8. **✅ UPDATE ORIGINAL MIGRATION** and migrate only that file
9. **REMOVE UNUSED ATTRIBUTES** - Always remove database columns, API fields, and code attributes that are no longer needed after changes
10. **ALWAYS READ DEVELOPMENT RULES** - Review this file before starting any task or development work

---

## **✅ COMMITMENT TO RULES**

**I will follow these rules for EVERY task you assign:**
- ✅ Technical implementation rules
- ✅ UI/UX design rules  
- ✅ File organization rules
- ✅ API development rules
- ✅ Testing procedures
- ✅ Documentation standards
- ✅ Routing conventions
- ✅ Performance optimization
- ✅ Security best practices
- ✅ Task execution process
- ✅ Communication standards

**These rules ensure:**
- 🎯 **Consistent quality** across all implementations
- 🔧 **Maintainable code** following best practices
- 🎨 **Professional UI** using shadcn components
- 📊 **Proper documentation** and progress tracking
- 🧪 **Thorough testing** and verification
- 🚀 **Optimal performance** and security

---

## **📞 READY TO FOLLOW RULES**

**I'm ready to follow these rules for your next task!**

Just tell me what you need, and I'll:
1. ✅ Read and understand requirements
2. ✅ Check existing codebase
3. ✅ Plan with shadcn components
4. ✅ Implement following all rules
5. ✅ Test thoroughly
6. ✅ Update documentation
7. ✅ Confirm completion

**What task would you like me to work on following these rules?** 🎯
