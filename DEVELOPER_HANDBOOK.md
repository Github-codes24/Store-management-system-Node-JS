# Store Management System (ERP & POS) - Backend Developer Handbook

> **Welcome to the Team!**  
> This handbook serves as the definitive engineering and architectural guide for the **Store Management System Backend**. It documents everything built, designed, and maintained across the platform, including system architecture, business logic rules, database schemas, role-based access control (RBAC), POS billing workflows, offer calculations, stock safeguards, and deployment practices.

---

## Table of Contents
1. [Project Overview & System Architecture](#1-project-overview--system-architecture)
2. [Technology Stack & Key Dependencies](#2-technology-stack--key-dependencies)
3. [Repository Structure & Code Layout](#3-repository-structure--code-layout)
4. [Environment Variables & Setup Guide](#4-environment-variables--setup-guide)
5. [Authentication & Store Employee RBAC](#5-authentication--store-employee-rbac)
6. [POS Billing & Multi-Bill Session Engine](#6-pos-billing--multi-bill-session-engine)
7. [Promotions, Offers & Dynamic Pricing Engine](#7-promotions-offers--dynamic-pricing-engine)
8. [Inventory, Multi-Batch & Overselling Prevention](#8-inventory-multi-batch--overselling-prevention)
9. [Returns & Refund Management Engine](#9-returns--refund-management-engine)
10. [Customer Metrics & Real-time Synchronization](#10-customer-metrics--real-time-synchronization)
11. [API Endpoints Reference](#11-api-endpoints-reference)
12. [Testing & Quality Assurance](#12-testing--quality-assurance)
13. [Deployment, Git Workflow & CI/CD](#13-deployment-git-workflow--cicd)
14. [Important Gotchas, Edge Cases & Troubleshooting](#14-important-gotchas-edge-cases--troubleshooting)

---

## 1. Project Overview & System Architecture

The **Store Management System** is an enterprise-grade ERP & Point-of-Sale (POS) backend serving a multi-store retail chain. It powers three distinct client applications:
1. **Admin Web Panel**: High-level store management, inventory purchases, role assignments, financial reports (PnL), category/brand catalogs, distributor/retailer relationships, and global marketing offers.
2. **Store Employee POS Panel**: Fast counter-billing, dynamic UPI QR generation, barcode scanner integration, inventory management, return & refund processing, and store-specific reports.
3. **Customer Mobile/Web App**: Product discovery, catalog browsing, cart management, order placement, Razorpay checkout, and order tracking.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT SURFACES                                   |
|   Admin Web Portal            Store Employee POS (Netlify)         Customer App   |
+-----------------------------------------------------------------------------------+
                                         │ (REST API / WebSockets)
                                         ▼
+-----------------------------------------------------------------------------------+
|                          EXPRESS 5.1 BACKEND (Node.js 22)                         |
|                                                                                   |
|  [Security & Rate Limit]  ->  [Auth & RBAC Middleware]  ->  [Zod Validation]      |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  |     POS Billing Engine  |  |  Offers & Pricing Engine |  | Inventory Engine |  |
|  |  - Multi-Bill Session   |  |  - BOGO / BXGY / % / Flat|  | - Multi-Batch    |  |
|  |  - Dynamic POS UPI QR   |  |  - Promotional Pricing   |  | - FIFO Deduction |  |
|  |  - Cash Change Tender   |  |  - Timezone Boundary     |  | - Oversell Guard |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  |  Returns & Refund Policy|  |  Customer Metrics Sync   |  | Real-Time Events |  |
|  |  - Strict BOGO Pair Rule|  |  - Real-time Total Spent |  | - Socket.io Sync |  |
|  |  - BXGY Free Item ₹0    |  |  - Purchase Frequency    |  | - Low Stock Alert|  |
|  |  - Financial Paid Cap   |  |  - Walk-in Exemption     |  | - POS Live Bills |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
+-----------------------------------------------------------------------------------+
                                         │
                   +---------------------+---------------------+
                   ▼                                           ▼
+-------------------------------------+     +-------------------------------------+
|        MONGODB ATLAS CLOUD          |     |          EXTERNAL SERVICES          |
|  Mongoose 8 ODM with Indexes & ACID |     |  - Razorpay (Payments & Refunds)    |
|  Transactions for Inventory / Sales |     |  - AWS S3 (Images & Invoices)       |
|                                     |     |  - MSG91 (Email & Notifications)    |
+-------------------------------------+     +-------------------------------------+
```

---

## 2. Technology Stack & Key Dependencies

| Component | Library / Tool | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | `>=22.0.0` | High-performance JS runtime (Native ES Modules: `"type": "module"`) |
| **Framework** | Express.js | `5.1.0` | HTTP routing, middleware pipeline, and error handling |
| **Database ODM** | Mongoose | `8.19.2` | MongoDB object modeling, schema validation, indexing, and aggregations |
| **Real-time WebSockets** | Socket.io | `4.8.3` | Instant event broadcasting to Admin and POS Panels |
| **Payment Gateway** | Razorpay SDK | `2.9.8` | Digital payments, dynamic POS UPI QR code generation, automated refunds |
| **Validation** | Zod | `4.3.6` | Runtime request body and query parameter validation schemas |
| **Security** | Helmet, Bcryptjs, Cookie-Parser | Latest | HTTP security headers, password hashing, and cookie parsing |
| **Traffic Control** | express-rate-limit | `8.5.2` | Distributed rate limiting across public API endpoints |
| **Queue & Scheduling** | BullMQ & node-cron | `5.61.2` / `4.2.1` | Asynchronous job queues and scheduled background tasks |
| **Barcode & Documents** | JsBarcode, PDFKit, ExcelJS | Latest | Code128 barcode generation, POS invoice PDF export, Excel reports |
| **Cloud Storage** | `@aws-sdk/client-s3` | `3.1028.0` | Direct S3 object upload and signed media access |
| **Testing** | Jest, Supertest, MongoMemoryServer | `30.3.0` | Unit & integration testing with `--experimental-vm-modules` |

---

## 3. Repository Structure & Code Layout

```
Store-management-system-admin-Node-JS/
├── server.js                      # Application entry point, HTTP server, and Socket.io bootstrap
├── package.json                   # Project metadata, ES modules configuration, and npm scripts
├── .env                           # Environment variables configuration file
├── src/
│   ├── config/                    # Database, Cloud Storage, Razorpay, and Environment configurations
│   │   ├── db.js                  # Mongoose MongoDB Atlas connection lifecycle & logging
│   │   ├── env.js                 # Centralized type-safe environment variable parser & defaults
│   │   ├── razorpay.js            # Razorpay SDK initialization
│   │   ├── s3.js                  # AWS S3 Client setup
│   │   └── socket.js              # Socket.io connection handlers and room broadcasting
│   ├── constants/                 # Status constants, payment modes, and order enum values
│   ├── controllers/               # Business logic controllers categorized by domain
│   │   ├── admin/                 # Admin operations (Catalogs, Users, Roles, Stock, Purchases, Reports)
│   │   ├── customer/              # Customer mobile app APIs (Auth, Cart, Orders, Checkout)
│   │   └── store-employee/        # POS & Store Panel operations
│   │       ├── storeBilling.controller.js   # ⭐ CORE: POS Billing, Multi-Bill, QR & Returns
│   │       ├── storeEmployee.auth.controller.js # Employee login & JWT token generation
│   │       ├── storeEmployee.offer.controller.js # Store-specific offer management
│   │       ├── storeProduct.controller.js   # Product inventory, batches & barcode lookup
│   │       └── storeReport.controller.js    # Store P&L and daily settlement reports
│   ├── middlewares/               # Express middleware functions
│   │   ├── admin.auth.middleware.js         # JWT verify for Admin accounts
│   │   ├── storeEmployee.auth.middleware.js # JWT verify for Store Employees
│   │   ├── storePermission.middleware.js    # ⭐ RBAC: 8-module granular permissions check
│   │   ├── customer.auth.middleware.js      # Customer JWT authentication
│   │   ├── error.middleware.js              # Global centralized error handler
│   │   └── validate.middleware.js           # Zod schema validation middleware
│   ├── models/                    # Mongoose schemas & data models
│   │   ├── storeOrder.model.js    # ⭐ Master schema for Orders, Bills, Items, Returns, & Payments
│   │   ├── storeProduct.model.js  # ⭐ Inventory, Multi-batch stock, Barcode & Pricing
│   │   ├── storeEmployee.model.js # Store employee credentials, roles, and permissions
│   │   ├── offer.model.js         # BOGO, BXGY, Flat, %, and Special Price rules
│   │   ├── customer.model.js      # Customer profile, ledger balances, and lifetime metrics
│   │   └── store.model.js         # Physical store locations and settings
│   ├── routes/                    # API route declarations
│   │   ├── admin/                 # Routes mounted under /api/admin/*
│   │   ├── customer/              # Routes mounted under /api/customer/*
│   │   └── store-employee/        # Routes mounted under /api/store-employee/*
│   │       └── storeBilling.routes.js # POS Billing & Return routes
│   └── utils/                     # Helper utilities
│       ├── api-response.js        # Standardized { success, message, data } JSON response helpers
│       ├── api-error.js           # Custom operational error classes (badRequest, notFound, forbidden)
│       ├── customerMetrics.util.js# Automated sync for customer purchase statistics
│       ├── offerHelper.js         # Promotional pricing resolution & expiration checks
│       └── timezone.js            # Indian Standard Time (Asia/Kolkata) date helpers
├── scripts/                       # Database seed scripts (seedAdmin.js, seedStores.js, etc.)
└── tests/                         # Automated test suite
    ├── unit/                      # Fast unit tests for RBAC, Returns, Stock, Change calculations
    └── integration/               # Multi-module API integration tests
```

---

## 4. Environment Variables & Setup Guide

### 4.1 Prerequisites
* **Node.js**: `v22.0.0` or higher (Required for ES Modules & modern crypto/VM features).
* **MongoDB**: MongoDB 6.0+ or MongoDB Atlas Cluster.
* **Package Manager**: `npm` (v10+).

### 4.2 `.env` Configuration Reference
Create a `.env` file in the root directory based on the following template:

```env
NODE_ENV=development
PORT=4000

# MongoDB Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/store_management_db?retryWrites=true&w=majority

# JWT Authentication Secrets & Expirations
ADMIN_JWT_SECRET=super-secret-admin-jwt-key-change-in-prod
ADMIN_JWT_EXPIRES_IN=7d
STORE_EMPLOYEE_JWT_SECRET=super-secret-employee-jwt-key-change-in-prod
STORE_EMPLOYEE_JWT_EXPIRES_IN=7d
CUSTOMER_JWT_SECRET=super-secret-customer-jwt-key-change-in-prod
CUSTOMER_JWT_EXPIRES_IN=30d

# CORS & Frontend Origins (Comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,https://store-management-system-store-panel.netlify.app
FRONTEND_URL=https://store-management-system-store-panel.netlify.app

# AWS S3 Cloud Storage
S3_REGION=ap-south-1
S3_ENDPOINT=
S3_ACCESS_KEY=your-aws-access-key
S3_SECRET_KEY=your-aws-secret-key
S3_BUCKET=store-management-assets
S3_PUBLIC_URL=https://store-management-assets.s3.ap-south-1.amazonaws.com

# Razorpay Payment Gateway & POS UPI
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
STORE_UPI_ID=store@okicici

# MSG91 Mailer
MSG91_AUTH_KEY=your-msg91-auth-key
MSG91_DOMAIN=yourdomain.com
MSG91_SENDER_NAME="Maruti Mart"
MSG91_FROM_EMAIL=no-reply@yourdomain.com
```

### 4.3 Setup & Startup Commands

```bash
# 1. Install all dependencies
npm install

# 2. Seed initial Super Admin and basic store data
npm run seed:admin
npm run seed:stores
npm run seed:store-employees

# 3. Start development server with live reload
npm run dev

# 4. Start production server
npm start
```

---

## 5. Authentication & Store Employee RBAC

The system enforces strict multi-tenant, role-based access control. Store employees log in using their credentials and receive a JWT token containing their `employeeId`, `storeId`, and assigned permissions.

### 5.1 The 8 Core Modules & Permissions
Store Employees can be assigned permissions across **8 distinct functional modules**:

```javascript
permissions: {
  dashboard:        { viewOnly: true },
  customers:        { viewOnly: true, create: true, modify: false, delete: false },
  billing:          { viewOnly: true, create: true },
  offlineSales:     { viewOnly: true, delete: false },
  onlineOrders:     { viewOnly: true, modifyStatus: true, delete: false },
  productInventory: { viewOnly: true, create: false, modify: false, delete: false },
  offers:           { viewOnly: true, create: false, modify: false, delete: false },
  reports:          { viewOnly: false }
}
```

### 5.2 Granular Middleware (`storePermission.middleware.js`)
Permissions are evaluated using `requireStorePermission(moduleName, action)`:
* **Admin / Unassigned Employee**: If an employee has no role restriction (`isFullAccess: true` or legacy profile), all requests are allowed.
* **Array of Modules (`OR` logic)**: If an endpoint is shared (e.g. Order view shared by `billing`, `onlineOrders`, and `offlineSales`), pass an array:
  ```javascript
  requireStorePermission(['billing', 'onlineOrders', 'offlineSales'], 'viewOnly')
  ```
  The user is granted access if they possess permission for **at least one** of the specified modules.

### 5.3 POS Counter Helper Exemptions (Crucial Architecture Rule)
In physical retail, a Cashier (who only has `billing` permission) must still be able to operate the register without having full management rights over inventory or customer databases. The middleware provides **counter-level exemptions**:
1. **Product Autocomplete & Barcode Scan**: When querying `GET /api/store-employee/products` with `search=...`, `/barcode/:barcode`, or `/options`, Cashiers are granted read-only access to find products and prices. However, exporting inventory or `POST /products` remains strictly blocked with `403 Forbidden`.
2. **Active Offers on Billing**: Cashiers can fetch `GET /api/store-employee/offers?status=active` to apply discounts to bills. Access to general offer management (creating or editing offers) remains blocked.
3. **Walk-in Customer Creation**: Cashiers can create walk-in customers directly from the register (`POST /billing/customers`).

### 5.4 Routing Gotcha: Granular vs Top-Level Middleware
> [!WARNING]
> **Never place `router.use(requireStorePermission('billing', 'viewOnly'))` at the top level of `storeBilling.routes.js`.**  
> Endpoints such as `GET /orders?saleType=online` and `GET /orders/:id` are shared with Sales Associates who may only have `onlineOrders` permission (and `billing: false`). Top-level middleware blocks them with `Access denied. You do not have permission to access 'billing'`. Always attach permissions granularly to each individual route.

---

## 6. POS Billing & Multi-Bill Session Engine

The POS Billing Engine ([storeBilling.controller.js](file:///d:/technokrate/Store-management-system-admin-Node-JS/src/controllers/store-employee/storeBilling.controller.js)) supports multi-bill sessions within a single customer purchase visit.

```
StoreOrder (orderId: "SODR00001")
├── customer: { name: "Walk-in Customer", phone: "0000000000" }
├── totalOrderGross: 240
├── totalOrderNet: 100
├── totalOrderPaid: 100
├── bills: [
│     ├── Bill #1 (billId: "INV-SODR00001-1", saleType: "Offline")
│     │     ├── items: [ { product, productName, sellingPrice: 50, quantity: 2, totalAmount: 100 } ]
│     │     ├── discountType: "BOGO", discountAmount: 50
│     │     ├── netAmount: 50, paidAmount: 50
│     │     └── payments: [ { mode: "Cash", amount: 50 } ]
│     └── Bill #2 (billId: "INV-SODR00001-2", saleType: "Offline")
│           └── ...
└── returns: [ ... ]
```

### 6.1 Sequential Order ID Generation
Order IDs are generated atomically using prefix patterns (`SODR` for Offline Counter sales, `OODR` for Online App orders):
```javascript
// Matches highest numerical suffix and increments by 1:
const prefix = isOnline ? 'OODR' : 'SODR';
const nextNumber = highestExistingSequence + 1;
const orderId = `${prefix}${String(nextNumber).padStart(5, '0')}`; // e.g. SODR06740
```

### 6.2 Digital Payments vs Cash Tender Calculation
* **Digital Payments (UPI, Card, Net Banking, Wallet)**: Digital payments **cannot exceed the Net Payable amount**. Cash change cannot be issued for digital transactions:
  ```javascript
  if (totalNonCash > finalNetAmount) {
    throw badRequest(`UPI/Card payment amount cannot exceed Net Payable amount. Cash change cannot be issued for digital payments.`);
  }
  ```
* **Cash Tender & Change Return**: When cash is tendered, change is automatically computed and recorded:
  ```javascript
  const cashDue = Math.max(0, finalNetAmount - totalNonCash);
  const changeReturn = Math.max(0, cashTendered - cashDue);
  ```

### 6.3 Dynamic POS UPI QR Code Generation
To accept direct counter UPI payments without an expensive physical EDC machine:
1. POS calls `POST /api/store-employee/billing/generate-qr` with `amount`, `orderId`, and `billId`.
2. Backend generates a standard UPI Intent payload (`upi://pay?pa=...&pn=...&am=...&tr=...`) and registers a dynamic tracking ID in memory/cache.
3. The frontend renders the QR code on the customer-facing screen.
4. POS polls `GET /api/store-employee/billing/qr-status/:qrId` until payment is confirmed or timed out.

---

## 7. Promotions, Offers & Dynamic Pricing Engine

The system supports five distinct offer types defined in [offer.model.js](file:///d:/technokrate/Store-management-system-admin-Node-JS/src/models/offer.model.js):

### 7.1 Offer Types & Mathematical Formulations
1. **BOGO (Buy X Get Y Free)**:
   * Setup: `buyQuantity: 1`, `freeQuantity: 1`. Set size = $1 + 1 = 2$.
   * Calculation:
     $$\text{totalFreeQty} = \left\lfloor \frac{\text{purchasedQty}}{\text{setSize}} \right\rfloor \times \text{freeQuantity}$$
     $$\text{discountAmount} = \text{totalFreeQty} \times \text{unitSellingPrice}$$
2. **BXGY (Buy Product A, Get Product B Free)**:
   * Setup: Buy Product A (qty: $Q_A$), Get Product B (qty: $Q_B$) free.
   * Calculation:
     $$\text{numSets} = \left\lfloor \frac{\text{qty}_A}{Q_A} \right\rfloor$$
     $$\text{freeQtyApplied} = \min(\text{qty}_B, \text{numSets} \times Q_B)$$
     $$\text{discountAmount} = \text{freeQtyApplied} \times \text{unitSellingPrice}_B$$
3. **Percentage (`%`)**:
   * Evaluated across eligible products or entire cart subtotal:
     $$\text{discountAmount} = \frac{\text{eligibleSubtotal} \times \text{discountValue}}{100}$$
4. **Flat Amount (`₹`)**:
   * Flat rupee deduction capped at eligible subtotal:
     $$\text{discountAmount} = \min(\text{eligibleSubtotal}, \text{discountValue})$$
5. **Special Price (`special_price`)**:
   * Directly overrides product selling price in active pricing map.

### 7.2 Timezone-Aware Validity (Asia/Kolkata)
All offer start and end dates are evaluated using IST boundaries via [timezone.js](file:///d:/technokrate/Store-management-system-admin-Node-JS/src/utils/timezone.js). An offer expiring on `2026-11-05` remains valid until `23:59:59.999 IST` on that day.

---

## 8. Inventory, Multi-Batch & Overselling Prevention

Inventory is managed per-store in `StoreProduct`. Products may have standard stock or multiple distinct batches (with individual expiry dates, MRP, and selling prices).

### 8.1 Two-Phase Atomic Billing (Overselling Prevention)
To completely prevent overselling (e.g. selling 100 units when only 70 exist in stock), billing operates in **two distinct phases**:

```
[Incoming POST /bills Request with Items]
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: PRE-VALIDATION (No database mutations)             │
│ 1. Resolve all product IDs and barcodes                     │
│ 2. Aggregate requested quantities per product               │
│    (Row 1: 40 qty + Row 2: 40 qty = Total 80)              │
│ 3. Check: Is availableStock >= totalRequestedQty?           │
│    - If NO: THROW 400 Bad Request immediately!              │
│             Zero stock is deducted. No bill is created.     │
│    - If YES: Proceed to Phase 2                             │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: ATOMIC DEDUCTION & PERSISTENCE                     │
│ 1. Deduct stock across active batches via FIFO logic        │
│ 2. Clean up 0-stock batches and update active batch name    │
│ 3. Recalculate storeProduct.stockQuantity                   │
│ 4. Persist updated inventory and create bill record         │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Safe FIFO Batch Deduction
When a product has multiple batches and the cashier performs a general scan (batch: `Default`), stock is deducted First-In, First-Out across active batches:
```javascript
let remainingToDeduct = qty;
for (const b of storeProd.batches) {
  if (remainingToDeduct <= 0) break;
  const bStock = Number(b.stockQuantity) || 0;
  if (bStock <= 0) continue;
  const deductAmt = Math.min(bStock, remainingToDeduct);
  b.stockQuantity = bStock - deductAmt;
  remainingToDeduct -= deductAmt;
}
```

---

## 9. Returns & Refund Management Engine

The Returns Engine ([storeBilling.controller.js](file:///d:/technokrate/Store-management-system-admin-Node-JS/src/controllers/store-employee/storeBilling.controller.js#L1250-L1490)) ensures that returns restore physical stock to the correct batch while strictly adhering to retail financial protection rules.

### 9.1 The Golden Rules of Retail Returns
1. **Strict BOGO Pair Rule**:
   * If a customer returns **both items (complete pair)** of a BOGO purchase $\rightarrow$ Refund = **Full Paid Amount** (e.g. ₹50).
   * If a customer returns **only 1 item** of a BOGO pair $\rightarrow$ Inventory stock is restored (+1), but refund = **₹0** (No refund for incomplete promotional pairs).
2. **BXGY Free Item Rule**:
   * Returning the **FREE item** (e.g. TEST 1) $\rightarrow$ Refund = **₹0** (Customer paid nothing for it).
   * Returning **BOTH items (Buy + Free)** $\rightarrow$ Refund = **Full Paid Amount** (e.g. ₹90).
   * Returning only the paid item while keeping the free gift $\rightarrow$ Refund = **₹0**.
3. **Universal Financial Safeguard (Paid Cap)**:
   * Under **no circumstances** can `totalRefund` exceed the remaining paid balance of the bill:
     $$\text{maxPossibleRefund} = \text{bill.paidAmount} - \text{alreadyRefundedOnBill}$$
   * Even if a client sends an inflated refund amount, the backend automatically caps it at `maxPossibleRefund`.

### 9.2 Lookup API (`GET /lookup-bill/:identifier`)
When an order is fetched for return:
* `discountValue`: Automatically populated with `discountAmount` for BOGO/BXGY bills so frontend discount input displays the actual offer deduction instead of `0`.
* `maxRefundableAmount`: Informs the POS UI of the maximum remaining cash/gateway refund allowed.

---

## 10. Customer Metrics & Real-time Synchronization

Customer purchase history and statistics are kept in real-time sync via [customerMetrics.util.js](file:///d:/technokrate/Store-management-system-admin-Node-JS/src/utils/customerMetrics.util.js).

### 10.1 Tracked Metrics
* `totalSpent`: Lifetime rupee value spent across all completed orders.
* `totalOrders`: Count of successfully completed orders.
* `averageOrderValue`: $\frac{\text{totalSpent}}{\text{totalOrders}}$.
* `lastOrderDate`: Timestamp of most recent purchase.

### 10.2 Walk-in Customer Exemption
Orders created for the generic walk-in profile (`phone: "0000000000"` or `isWalkInCustomer()`) bypass customer database linking and metric updates to keep the customer collection clean and performant.

---

## 11. API Endpoints Reference

### 11.1 Store Employee / POS APIs (`/api/store-employee/*`)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Employee login with email & password |
| `GET` | `/products` | `productInventory: viewOnly`* | Search products & batches (*counter exemption for search) |
| `GET` | `/products/barcode/:barcode`| `billing: viewOnly` | Instant barcode scan lookup for POS register |
| `POST` | `/billing/bills` | `billing: create` | Create or append a bill in POS session with stock deduction |
| `GET` | `/billing/applicable-offers`| `billing: viewOnly` | Fetch offers eligible for current cart products |
| `POST` | `/billing/generate-qr` | `billing: create` | Generate dynamic POS UPI QR code |
| `GET` | `/billing/qr-status/:qrId` | `billing: viewOnly` | Poll dynamic UPI payment status |
| `GET` | `/billing/lookup-bill/:id` | `billing: viewOnly` | Fetch bill details & returnable item quantities |
| `POST` | `/billing/returns` | `billing: create` | Process return, restock batch, & issue refund |
| `GET` | `/billing/orders` | Granular | List orders (filters by `saleType=online` or `offline`) |
| `GET` | `/billing/orders/:id` | Shared | Fetch complete order invoice details |
| `PATCH`| `/billing/orders/:id/status`| Granular | Update order status (Accepted, Packed, Shipped, Delivered) |

### 11.2 Admin APIs (`/api/admin/*`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Super Admin / Sub-Admin login |
| `GET` | `/store-employees` | List all store employees across stores |
| `POST` | `/store-employees` | Create new store employee and assign role |
| `PATCH`| `/store-employees/:id/permissions` | Update granular 8-module employee permissions |
| `GET` | `/roles-and-permissions/stores-dropdown` | Stores dropdown list (filters `isDeleted: false`) |
| `GET` | `/offers` / `POST /offers` | Global and store-level marketing offer management |
| `GET` | `/reports/pnl` | Chain-wide Profit & Loss report |

---

## 12. Testing & Quality Assurance

The codebase includes comprehensive unit and integration tests using **Jest 30** with native ES Modules enabled.

### 12.1 Running Tests
```bash
# Run complete unit test suite (74 tests across 12 suites)
npm run test:unit

# Run specific unit test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/storeReturnOffer.test.js

# Run integration tests
npm run test:integration

# Run tests with coverage report
npm run test:coverage
```

### 12.2 Key Test Suites to Run Before Any Commit
1. `tests/unit/storeEmployeeRolesPermissions.test.js`: Verifies granular RBAC access across all 8 modules and counter exemptions.
2. `tests/unit/storeBillingStockValidation.test.js`: Verifies two-phase overselling prevention and multi-row cart aggregate quantity limits.
3. `tests/unit/storeReturnOffer.test.js`: Verifies BOGO pair refund rules, BXGY free item rules, and paid cap safeguards.
4. `tests/unit/cashTenderedChange.test.js`: Verifies cash change calculations and digital payment validation.

---

## 13. Deployment, Git Workflow & CI/CD

### 13.1 Deployment Environments
* **Hosting Platform**: Render Cloud Application Hosting.
* **Auto-Deploy**: Configured via GitHub Webhooks on the `master` branch. Pushing a commit to `origin master` automatically triggers a live build and zero-downtime deployment.
* **Live POS Panel**: Hosted on Netlify (`store-management-system-store-panel.netlify.app`).

### 13.2 Git Branching Workflow
* `master`: The production-ready source of truth. Always kept 100% stable and fully passing all unit tests.
* `feature/store-roles-and-permissions`: Main feature tracking branch for store panel customizations.
* **Always sync branches after feature completion**:
  ```bash
  git checkout feature/store-roles-and-permissions
  git merge master
  git push origin feature/store-roles-and-permissions
  git checkout master
  ```

---

## 14. Important Gotchas, Edge Cases & Troubleshooting

### 14.1 ES Modules & Jest Execution
Because this project uses native ES Modules (`"type": "module"` in `package.json`), Jest must be executed with the `--experimental-vm-modules` flag:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js ...
```
Never run standard `jest` directly without this flag, or Node will throw `SyntaxError: Cannot use import statement outside a module`.

### 14.2 Store Model Deletion Flag
The `Store` collection does **not** have a `status: 'active'` field. It exclusively uses `isDeleted: false`. When filtering active stores for dropdowns, always query:
```javascript
Store.find({ isDeleted: false }) // CORRECT
Store.find({ status: 'active' }) // WRONG: Returns empty array []
```

### 14.3 BOGO and BXGY `discountValue` in Frontend Forms
In MongoDB, BOGO and BXGY offers store `discountValue: 0` because they are conditional sets, not a flat 10% or ₹50. The actual monetary discount is calculated and saved in `discountAmount`. When returning bill data for display or returns, `lookupBillForReturn` automatically bridges `discountValue = bill.discountAmount` so client inputs do not display ₹0 discount.

### 14.4 Windows Terminal Git Lock Files
On Windows operating systems in sandboxed terminal environments, Git operations (`git add`, `git commit`) attempting to write to `.git/index.lock` may fail with permission denied. Ensure developer tools run with proper elevated filesystem access.

---

*Handbook maintained by the Backend Engineering Team. For questions or architectural reviews, refer to the commit history on `master`.*
