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
3. ✅ **Verify success criteria**
4. ✅ **Get user confirmation**
5. ✅ **Clean up any temporary code**

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
