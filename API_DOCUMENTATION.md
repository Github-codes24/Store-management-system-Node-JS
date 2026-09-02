# 📘 Store Management ERP - Admin API Documentation

**Base URL**: `http://localhost:4000/api`

---

## 🔐 Authentication & Headers Standard

### Protected Endpoints Authorization
For all protected endpoints, pass authentication using **ONE** of the following methods:

1. **Bearer Token (Header)**:
   - `Authorization: Bearer <ADMIN_JWT_TOKEN>`
2. **Cookie (Header)**:
   - `Cookie: adminToken=<ADMIN_JWT_TOKEN>`

### Content-Type
- `Content-Type: application/json` (unless uploading `multipart/form-data`)

---

# 1. 🔑 Admin Authentication APIs (`/api/admin/auth`)

---

### 1.1 Register Admin
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/register`
- **Authorization**: Public (No Auth Required)
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Super Admin",
  "email": "admin@example.com",
  "password": "Password123",
  "phone": "+1234567890",
  "role": "superadmin"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Admin registered successfully",
  "data": {
    "admin": {
      "_id": "60d5ecb8b3b3a20015f8e123",
      "name": "Super Admin",
      "email": "admin@example.com",
      "phone": "+1234567890",
      "role": "superadmin",
      "status": "active",
      "profileImage": null,
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.2 Admin Login
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/login`
- **Authorization**: Public (No Auth Required)
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "email": "admin@example.com",
  "password": "Password123"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "_id": "60d5ecb8b3b3a20015f8e123",
      "name": "Super Admin",
      "email": "admin@example.com",
      "phone": "+1234567890",
      "role": "superadmin",
      "status": "active",
      "profileImage": null,
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.3 Forgot Password (Request OTP)
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/forgot-password`
- **Authorization**: Public (No Auth Required)
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "email": "admin@example.com"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "OTP sent to your registered email address",
  "data": {
    "email": "admin@example.com"
  }
}
```

---

### 1.4 Verify OTP
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/verify-otp`
- **Authorization**: Public (No Auth Required)
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "resetToken": "a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    "email": "admin@example.com"
  }
}
```

---

### 1.5 Reset Password
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/reset-password`
- **Authorization**: Public (No Auth Required)
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "email": "admin@example.com",
  "resetToken": "a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "password": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Your password has been successfully updated. You can now log in with your new credentials."
}
```

---

### 1.6 Get Current Admin Profile
- **Method**: `GET`
- **Endpoint**: `/api/admin/auth/me`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: None
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "admin": {
      "_id": "60d5ecb8b3b3a20015f8e123",
      "name": "Super Admin",
      "email": "admin@example.com",
      "phone": "+1234567890",
      "role": "superadmin",
      "status": "active",
      "profileImage": null,
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 1.7 Change Password
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/change-password`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 1.8 Admin Logout
- **Method**: `POST`
- **Endpoint**: `/api/admin/auth/logout`
- **Authorization**: Public / Protected
- **Body Type**: None
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

# 2. 🏷️ Product Types APIs (`/api/admin/product-management/product-types`)

---

### 2.1 Create Product Type
- **Method**: `POST`
- **Endpoint**: `/api/admin/product-management/product-types`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON` (or `multipart/form-data` with `image` file)
- **Request Body**:
```json
{
  "name": "Electronics",
  "description": "Consumer electronics & tech gadgets",
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Product Type created successfully",
  "data": {
    "productType": {
      "_id": "60d5ecb8b3b3a20015f8e456",
      "name": "Electronics",
      "description": "Consumer electronics & tech gadgets",
      "image": null,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 2.2 List Product Types
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/product-types`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Search by product type name
  - `status` (string, optional): `active` | `inactive`
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product Types fetched successfully",
  "data": {
    "productTypes": [
      {
        "_id": "60d5ecb8b3b3a20015f8e456",
        "name": "Electronics",
        "description": "Consumer electronics & tech gadgets",
        "image": null,
        "status": "active",
        "createdAt": "2026-08-21T12:00:00.000Z",
        "updatedAt": "2026-08-21T12:00:00.000Z"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 2.3 Get Product Type By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/product-types/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product Type details fetched successfully",
  "data": {
    "productType": {
      "_id": "60d5ecb8b3b3a20015f8e456",
      "name": "Electronics",
      "description": "Consumer electronics & tech gadgets",
      "image": null,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 2.4 Update Product Type
- **Method**: `PUT`
- **Endpoint**: `/api/admin/product-management/product-types/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Consumer Electronics",
  "description": "Updated description"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product Type updated successfully",
  "data": {
    "productType": {
      "_id": "60d5ecb8b3b3a20015f8e456",
      "name": "Consumer Electronics",
      "description": "Updated description",
      "image": null,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:05:00.000Z"
    }
  }
}
```

---

### 2.5 Toggle Product Type Status
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/product-management/product-types/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product Type status changed to inactive",
  "data": {
    "productType": {
      "_id": "60d5ecb8b3b3a20015f8e456",
      "name": "Consumer Electronics",
      "status": "inactive"
    }
  }
}
```

---

### 2.6 Delete Product Type
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/product-management/product-types/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product Type deleted successfully"
}
```

---

# 3. 📂 Categories APIs (`/api/admin/product-management/categories`)

---

### 3.1 Create Category
- **Method**: `POST`
- **Endpoint**: `/api/admin/product-management/categories`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Mobile Phones",
  "productType": "60d5ecb8b3b3a20015f8e456",
  "description": "Smartphones and devices",
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "category": {
      "_id": "60d5ecb8b3b3a20015f8e789",
      "name": "Mobile Phones",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e456",
        "name": "Electronics",
        "status": "active"
      },
      "description": "Smartphones and devices",
      "image": null,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 3.2 List Categories
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/categories`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional)
  - `productType` (ObjectId, optional)
  - `status` (string, optional)
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": {
    "categories": [
      {
        "_id": "60d5ecb8b3b3a20015f8e789",
        "name": "Mobile Phones",
        "productType": {
          "_id": "60d5ecb8b3b3a20015f8e456",
          "name": "Electronics",
          "status": "active"
        },
        "description": "Smartphones and devices",
        "image": null,
        "status": "active",
        "createdAt": "2026-08-21T12:00:00.000Z"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 3.3 Get Category By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/categories/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Category details fetched successfully",
  "data": {
    "category": {
      "_id": "60d5ecb8b3b3a20015f8e789",
      "name": "Mobile Phones",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e456",
        "name": "Electronics"
      },
      "description": "Smartphones and devices",
      "status": "active"
    }
  }
}
```

---

### 3.4 Update Category
- **Method**: `PUT`
- **Endpoint**: `/api/admin/product-management/categories/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Smartphones & Mobiles",
  "productType": "60d5ecb8b3b3a20015f8e456"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "category": {
      "_id": "60d5ecb8b3b3a20015f8e789",
      "name": "Smartphones & Mobiles",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e456",
        "name": "Electronics"
      },
      "status": "active"
    }
  }
}
```

---

### 3.5 Toggle Category Status
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/product-management/categories/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Category status changed to inactive",
  "data": {
    "category": {
      "_id": "60d5ecb8b3b3a20015f8e789",
      "name": "Smartphones & Mobiles",
      "status": "inactive"
    }
  }
}
```

---

### 3.6 Delete Category
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/product-management/categories/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

# 4. 🗂️ Subcategories APIs (`/api/admin/product-management/subcategories`)

---

### 4.1 Create Subcategory
- **Method**: `POST`
- **Endpoint**: `/api/admin/product-management/subcategories`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Smartphones",
  "productType": "60d5ecb8b3b3a20015f8e456",
  "category": "60d5ecb8b3b3a20015f8e789",
  "description": "Touchscreen smartphones",
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Subcategory created successfully",
  "data": {
    "subcategory": {
      "_id": "60d5ecb8b3b3a20015f8e999",
      "name": "Smartphones",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e456",
        "name": "Electronics"
      },
      "category": {
        "_id": "60d5ecb8b3b3a20015f8e789",
        "name": "Mobile Phones"
      },
      "description": "Touchscreen smartphones",
      "image": null,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 4.2 List Subcategories
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/subcategories`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional)
  - `productType` (ObjectId, optional)
  - `category` (ObjectId, optional)
  - `status` (string, optional)
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Subcategories fetched successfully",
  "data": {
    "subcategories": [
      {
        "_id": "60d5ecb8b3b3a20015f8e999",
        "name": "Smartphones",
        "productType": {
          "_id": "60d5ecb8b3b3a20015f8e456",
          "name": "Electronics"
        },
        "category": {
          "_id": "60d5ecb8b3b3a20015f8e789",
          "name": "Mobile Phones"
        },
        "status": "active"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 4.3 Get Subcategory By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/subcategories/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Subcategory details fetched successfully",
  "data": {
    "subcategory": {
      "_id": "60d5ecb8b3b3a20015f8e999",
      "name": "Smartphones",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e456",
        "name": "Electronics"
      },
      "category": {
        "_id": "60d5ecb8b3b3a20015f8e789",
        "name": "Mobile Phones"
      },
      "status": "active"
    }
  }
}
```

---

### 4.4 Update Subcategory
- **Method**: `PUT`
- **Endpoint**: `/api/admin/product-management/subcategories/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Flagship Smartphones"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Subcategory updated successfully",
  "data": {
    "subcategory": {
      "_id": "60d5ecb8b3b3a20015f8e999",
      "name": "Flagship Smartphones",
      "status": "active"
    }
  }
}
```

---

### 4.5 Toggle Subcategory Status
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/product-management/subcategories/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Subcategory status changed to inactive",
  "data": {
    "subcategory": {
      "_id": "60d5ecb8b3b3a20015f8e999",
      "name": "Flagship Smartphones",
      "status": "inactive"
    }
  }
}
```

---

### 4.6 Delete Subcategory
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/product-management/subcategories/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Subcategory deleted successfully"
}
```

---

# 5. 🏷️ Brands APIs (`/api/admin/product-management/brands`)

---

### 5.1 Create Brand
- **Method**: `POST`
- **Endpoint**: `/api/admin/product-management/brands`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Samsung",
  "description": "Consumer electronics manufacturer",
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Brand created successfully",
  "data": {
    "brand": {
      "_id": "60d5ecb8b3b3a20015f8eabc",
      "name": "Samsung",
      "description": "Consumer electronics manufacturer",
      "logo": null,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 5.2 List Brands
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/brands`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional)
  - `status` (string, optional)
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Brands fetched successfully",
  "data": {
    "brands": [
      {
        "_id": "60d5ecb8b3b3a20015f8eabc",
        "name": "Samsung",
        "description": "Consumer electronics manufacturer",
        "logo": null,
        "status": "active",
        "createdAt": "2026-08-21T12:00:00.000Z"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 5.3 Get Brand By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/brands/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Brand details fetched successfully",
  "data": {
    "brand": {
      "_id": "60d5ecb8b3b3a20015f8eabc",
      "name": "Samsung",
      "description": "Consumer electronics manufacturer",
      "status": "active"
    }
  }
}
```

---

### 5.4 Update Brand
- **Method**: `PUT`
- **Endpoint**: `/api/admin/product-management/brands/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Samsung Electronics",
  "description": "Global electronics brand"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Brand updated successfully",
  "data": {
    "brand": {
      "_id": "60d5ecb8b3b3a20015f8eabc",
      "name": "Samsung Electronics",
      "description": "Global electronics brand",
      "status": "active"
    }
  }
}
```

---

### 5.5 Toggle Brand Status
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/product-management/brands/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Brand status changed to inactive",
  "data": {
    "brand": {
      "_id": "60d5ecb8b3b3a20015f8eabc",
      "name": "Samsung Electronics",
      "status": "inactive"
    }
  }
}
```

---

### 5.6 Delete Brand
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/product-management/brands/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Brand deleted successfully"
}
```

---

# 6. ⚖️ Units APIs (`/api/admin/product-management/units`)

---

### 6.1 Create Unit
- **Method**: `POST`
- **Endpoint**: `/api/admin/product-management/units`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Kilogram",
  "shortName": "kg",
  "allowDecimal": true,
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Unit created successfully",
  "data": {
    "unit": {
      "_id": "60d5ecb8b3b3a20015f8edef",
      "name": "Kilogram",
      "shortName": "kg",
      "allowDecimal": true,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 6.2 List Units
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/units`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Searches by name or shortName
  - `status` (string, optional)
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Units fetched successfully",
  "data": {
    "units": [
      {
        "_id": "60d5ecb8b3b3a20015f8edef",
        "name": "Kilogram",
        "shortName": "kg",
        "allowDecimal": true,
        "status": "active",
        "createdAt": "2026-08-21T12:00:00.000Z"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 6.3 Get Unit By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/units/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Unit details fetched successfully",
  "data": {
    "unit": {
      "_id": "60d5ecb8b3b3a20015f8edef",
      "name": "Kilogram",
      "shortName": "kg",
      "allowDecimal": true,
      "status": "active"
    }
  }
}
```

---

### 6.4 Update Unit
- **Method**: `PUT`
- **Endpoint**: `/api/admin/product-management/units/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Kilograms",
  "shortName": "kg",
  "allowDecimal": true
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Unit updated successfully",
  "data": {
    "unit": {
      "_id": "60d5ecb8b3b3a20015f8edef",
      "name": "Kilograms",
      "shortName": "kg",
      "allowDecimal": true,
      "status": "active"
    }
  }
}
```

---

### 6.5 Toggle Unit Status
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/product-management/units/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Unit status changed to inactive",
  "data": {
    "unit": {
      "_id": "60d5ecb8b3b3a20015f8edef",
      "name": "Kilograms",
      "status": "inactive"
    }
  }
}
```

---

### 6.6 Delete Unit
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/product-management/units/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Unit deleted successfully"
}
```

---

# 7. 👥 Customer Management APIs (`/api/admin/user-management/customers`)

---

### 7.1 Create Customer
- **Method**: `POST`
- **Endpoint**: `/api/admin/user-management/customers`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Brooklyn Simmons",
  "email": "example@mail.com",
  "phone": "9876543210",
  "dateOfBirth": "1990-11-09",
  "address": "3517 W. Gray St",
  "totalPurchase": 18400,
  "amountDue": 4000,
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "customer": {
      "_id": "60d5ecb8b3b3a20015f8eff1",
      "name": "Brooklyn Simmons",
      "email": "example@mail.com",
      "phone": "9876543210",
      "dateOfBirth": "1990-11-09T00:00:00.000Z",
      "address": "3517 W. Gray St",
      "totalPurchase": 18400,
      "amountDue": 4000,
      "totalOrders": 8,
      "totalStoreVisits": 6,
      "status": "active",
      "createdAt": "2026-08-21T12:00:00.000Z",
      "updatedAt": "2026-08-21T12:00:00.000Z"
    }
  }
}
```

---

### 7.2 List Customers
- **Method**: `GET`
- **Endpoint**: `/api/admin/user-management/customers`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Searches by customer name, phone, or email
  - `status` (string, optional): `active` | `inactive`
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customers fetched successfully",
  "data": {
    "customers": [
      {
        "_id": "60d5ecb8b3b3a20015f8eff1",
        "name": "Brooklyn Simmons",
        "email": "example@mail.com",
        "phone": "9876543210",
        "totalPurchase": 18400,
        "amountDue": 4000,
        "address": "3517 W. Gray St",
        "status": "active"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 7.3 Get Customer Details & Purchase Summary
- **Method**: `GET`
- **Endpoint**: `/api/admin/user-management/customers/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer details fetched successfully",
  "data": {
    "customer": {
      "_id": "60d5ecb8b3b3a20015f8eff1",
      "name": "Brooklyn Simmons",
      "email": "example@mail.com",
      "phone": "9876543210",
      "dateOfBirth": "1990-11-09T00:00:00.000Z",
      "address": "2464 Royal Ln. Mesa, New Jersey 45463",
      "status": "active"
    },
    "purchaseInformation": {
      "totalOrders": 8,
      "totalBillAmount": 18400,
      "totalDueAmount": 4000
    },
    "summary": {
      "avgStoreVisitsPerMonth": 6,
      "totalStoreVisits": 6,
      "avgMonthlyBillValue": 2000
    },
    "spentChart": [
      { "month": "Jan", "amount": 2000 },
      { "month": "Feb", "amount": 3000 },
      { "month": "Mar", "amount": 1500 },
      { "month": "Apr", "amount": 2800 },
      { "month": "May", "amount": 4500 },
      { "month": "Jun", "amount": 3200 },
      { "month": "Jul", "amount": 3100 },
      { "month": "Aug", "amount": 3300 }
    ],
    "topPurchasedProducts": [
      { "item": "Product 1", "quantity": "150 pc" },
      { "item": "Product 2", "quantity": "50 kg" },
      { "item": "Product 3", "quantity": "150 pc" },
      { "item": "Product 4", "quantity": "150 pc" },
      { "item": "Product 5", "quantity": "150 pc" }
    ]
  }
}
```

---

### 7.4 Update Customer
- **Method**: `PUT`
- **Endpoint**: `/api/admin/user-management/customers/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Brooklyn Simmons",
  "address": "New Address Line 123",
  "phone": "9876543210"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer details updated successfully",
  "data": {
    "customer": {
      "_id": "60d5ecb8b3b3a20015f8eff1",
      "name": "Brooklyn Simmons",
      "address": "New Address Line 123",
      "phone": "9876543210"
    }
  }
}
```

---

### 7.5 Export Customers Data
- **Method**: `GET`
- **Endpoint**: `/api/admin/user-management/customers/export`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer export data generated successfully",
  "data": {
    "customers": [
      {
        "srNo": 1,
        "name": "Brooklyn Simmons",
        "mobile": "9876543210",
        "email": "example@mail.com",
        "totalPurchase": 18400,
        "amountDue": 4000,
        "address": "3517 W. Gray St",
        "status": "active"
      }
    ],
    "totalCount": 1
  }
}
```

---

### 7.6 Delete Customer
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/user-management/customers/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

---

# 8. 👤 Sub-Admin Management APIs (`/api/admin/user-management/sub-admins`)

---

### 8.1 Create Sub-Admin
- **Method**: `POST`
- **Endpoint**: `/api/admin/user-management/sub-admins`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Allowed Designation Enum Values**: `Warehouse Manager` | `Store Manager` | `Manager` | `Cashier` | `Billing Manager`
- **Request Body**:
```json
{
  "employeeName": "Clark Kent",
  "designation": "Warehouse Manager",
  "mobile": "9876543210",
  "email": "clark@example.com",
  "address": "3517 W. Gray St, Utica...",
  "password": "Store001@DOM",
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Sub-Admin created successfully",
  "data": {
    "subAdmin": {
      "_id": "60d5ecb8b3b3a20015f8f001",
      "employeeName": "Clark Kent",
      "email": "clark@example.com",
      "mobile": "9876543210",
      "designation": "Warehouse Manager",
      "address": "3517 W. Gray St, Utica...",
      "status": "active",
      "role": "subadmin",
      "createdAt": "2026-08-22T12:00:00.000Z",
      "updatedAt": "2026-08-22T12:00:00.000Z"
    }
  }
}
```

---

### 8.2 List Sub-Admins
- **Method**: `GET`
- **Endpoint**: `/api/admin/user-management/sub-admins`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Searches by employeeName, mobile, or email
  - `designation` (string, optional): Filter by designation enum (e.g. `Warehouse Manager`, `Store Manager`, `Manager`, `Cashier`, `Billing Manager`)
  - `status` (string, optional): `active` | `inactive` | `suspended`
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Sub-Admins fetched successfully",
  "data": {
    "subAdmins": [
      {
        "_id": "60d5ecb8b3b3a20015f8f001",
        "employeeName": "Clark Kent",
        "designation": "Warehouse Manager",
        "mobile": "9876543210",
        "email": "clark@example.com",
        "address": "3517 W. Gray St, Utica...",
        "status": "active"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 8.3 Get Sub-Admin Details By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/user-management/sub-admins/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Sub-Admin details fetched successfully",
  "data": {
    "subAdmin": {
      "_id": "60d5ecb8b3b3a20015f8f001",
      "employeeName": "Clark Kent",
      "designation": "Warehouse Manager",
      "mobile": "9876543210",
      "email": "clark@example.com",
      "address": "1901 Thornridge Cir. IL 853",
      "status": "active",
      "role": "subadmin",
      "createdAt": "2026-08-22T12:00:00.000Z"
    }
  }
}
```

---

### 8.4 Update Sub-Admin
- **Method**: `PUT`
- **Endpoint**: `/api/admin/user-management/sub-admins/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "employeeName": "Clark Kent",
  "designation": "Store Manager",
  "mobile": "9876543210",
  "email": "clark@example.com",
  "address": "Updated Address 123",
  "password": "NewStorePassword123"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Sub-Admin updated successfully",
  "data": {
    "subAdmin": {
      "_id": "60d5ecb8b3b3a20015f8f001",
      "employeeName": "Clark Kent",
      "designation": "Store Manager",
      "mobile": "9876543210",
      "email": "clark@example.com",
      "address": "Updated Address 123",
      "status": "active"
    }
  }
}
```

---

### 8.5 Delete Sub-Admin
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/user-management/sub-admins/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Sub-Admin deleted successfully"
}
```

---

# 9. 🏷️ Attribute Management APIs (`/api/admin/product-management/attributes`)

---

### 9.1 Create Attribute
- **Method**: `POST`
- **Endpoint**: `/api/admin/product-management/attributes`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Allowed Field Type Enum Values**: `Text` | `Number` | `Decimal` | `Dropdown` | `Multi-select` | `Checkbox` | `Color Picker` | `Date`
- **Request Body**:
```json
{
  "displayLabel": "Size",
  "attributeKey": "size",
  "fieldType": "Multi-select",
  "productTypes": ["60d5ecb8b3b3a20015f8e001"],
  "categories": ["60d5ecb8b3b3a20015f8e002"],
  "subcategories": ["60d5ecb8b3b3a20015f8e003"],
  "placeholder": "Select sizes...",
  "isRequired": true,
  "optionValues": ["XS", "S", "M", "L", "XL"],
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Attribute created successfully",
  "data": {
    "attribute": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "displayLabel": "Size",
      "attribute": "Size",
      "attributeKey": "size",
      "key": "size",
      "fieldType": "Multi-select",
      "productTypes": [
        {
          "_id": "60d5ecb8b3b3a20015f8e001",
          "name": "Fashion"
        }
      ],
      "categories": [
        {
          "_id": "60d5ecb8b3b3a20015f8e002",
          "name": "Men's Fashion"
        }
      ],
      "subcategories": [
        {
          "_id": "60d5ecb8b3b3a20015f8e003",
          "name": "Jeans"
        }
      ],
      "appliesTo": ["Fashion", "Men's Fashion", "Jeans"],
      "placeholder": "Select sizes...",
      "isRequired": true,
      "options": ["XS", "S", "M", "L", "XL"],
      "optionValues": ["XS", "S", "M", "L", "XL"],
      "status": "active",
      "isDeleted": false,
      "createdAt": "2026-08-24T12:00:00.000Z",
      "updatedAt": "2026-08-24T12:00:00.000Z"
    }
  }
}
```

---

### 9.2 List Attributes
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/attributes`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Searches displayLabel, attributeKey, fieldType, or appliesTo
  - `fieldType` (string, optional): Filter by field type (e.g. `Text`, `Decimal`, `Multi-select`, `Checkbox`)
  - `status` (string, optional): `active` | `inactive`
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Attributes fetched successfully",
  "data": {
    "attributes": [
      {
        "_id": "60d5ecb8b3b3a20015f8f999",
        "displayLabel": "Size",
        "attributeKey": "size",
        "fieldType": "Multi-select",
        "appliesTo": ["Shirts", "Jeans", "Pant"],
        "status": "active",
        "isRequired": true,
        "placeholder": "Select sizes..."
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 9.3 Get Attribute Details By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/attributes/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Attribute details fetched successfully",
  "data": {
    "attribute": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "displayLabel": "Size",
      "attributeKey": "size",
      "fieldType": "Multi-select",
      "productTypes": [{ "_id": "60d5ecb8b3b3a20015f8e001", "name": "Fashion" }],
      "categories": [{ "_id": "60d5ecb8b3b3a20015f8e002", "name": "Men's Fashion" }],
      "subcategories": [{ "_id": "60d5ecb8b3b3a20015f8e003", "name": "Jeans" }],
      "placeholder": "Select sizes...",
      "isRequired": true,
      "optionValues": ["XS", "S", "M", "L", "XL"],
      "status": "active"
    }
  }
}
```

---

### 9.4 Update Attribute
- **Method**: `PUT`
- **Endpoint**: `/api/admin/product-management/attributes/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "displayLabel": "Clothing Size",
  "placeholder": "Select clothing sizes...",
  "isRequired": true,
  "optionValues": ["XS", "S", "M", "L", "XL", "XXL"]
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Attribute updated successfully",
  "data": {
    "attribute": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "displayLabel": "Clothing Size",
      "placeholder": "Select clothing sizes...",
      "isRequired": true,
      "optionValues": ["XS", "S", "M", "L", "XL", "XXL"]
    }
  }
}
```

---

### 9.5 Toggle Attribute Status
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/product-management/attributes/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Attribute status changed to inactive",
  "data": {
    "attribute": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "displayLabel": "Clothing Size",
      "status": "inactive"
    }
  }
}
```

---

### 9.6 Delete Attribute
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/product-management/attributes/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Attribute deleted successfully"
}
```

---

# 10. ⚙️ System Settings APIs (`/api/admin/settings`)

---

### 10.1 Get Settings
- **Method**: `GET`
- **Endpoint**: `/api/admin/settings`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Settings fetched successfully",
  "data": {
    "settings": {
      "_id": "60d5ecb8b3b3a20015f8fa11",
      "deliveryRangeKm": 5,
      "supportNumber": "+91 9876543210",
      "supportEmail": "support@companyname.com",
      "createdAt": "2026-08-24T12:00:00.000Z",
      "updatedAt": "2026-08-24T12:00:00.000Z"
    }
  }
}
```

---

### 10.2 Update Settings
- **Method**: `PUT`
- **Endpoint**: `/api/admin/settings`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "deliveryRangeKm": 12,
  "supportNumber": "+91 9988776655",
  "supportEmail": "help@companyname.com"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "settings": {
      "_id": "60d5ecb8b3b3a20015f8fa11",
      "deliveryRangeKm": 12,
      "supportNumber": "+91 9988776655",
      "supportEmail": "help@companyname.com",
      "updatedBy": {
        "_id": "60d5ecb8b3b3a20015f8e001",
        "name": "Super Admin",
        "email": "admin@example.com",
        "role": "superadmin"
      },
      "updatedAt": "2026-08-24T12:30:00.000Z"
    }
  }
}
```


---

# 11. 🏪 Store Employee Customer Management APIs (`/api/store-employee/customers`)

---

### 11.1 Create Customer (Store Scoped)
- **Method**: `POST`
- **Endpoint**: `/api/store-employee/customers`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Brooklyn Simmons",
  "email": "example@mail.com",
  "phone": "9876543210",
  "dateOfBirth": "1990-09-11",
  "address": "3517 W. Gray St",
  "totalPurchase": 18400,
  "amountDue": 4000,
  "totalOrders": 8,
  "totalStoreVisits": 6,
  "status": "active"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "customer": {
      "_id": "66b1a234f9a12c0012345678",
      "storeId": "66b1a000f9a12c0012345000",
      "name": "Brooklyn Simmons",
      "email": "example@mail.com",
      "phone": "9876543210",
      "dateOfBirth": "1990-09-11T00:00:00.000Z",
      "address": "3517 W. Gray St",
      "totalPurchase": 18400,
      "amountDue": 4000,
      "totalOrders": 8,
      "totalStoreVisits": 6,
      "status": "active",
      "createdAt": "2026-08-28T16:00:00.000Z",
      "updatedAt": "2026-08-28T16:00:00.000Z"
    }
  }
}
```

---

### 11.2 Get All Customers (Store Scoped)
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/customers?search=Brooklyn&status=active&page=1&limit=10`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (optional): Filter by name, phone, or email
  - `status` (optional): `active` or `inactive`
  - `startDate` (optional): Creation start date (`YYYY-MM-DD`)
  - `endDate` (optional): Creation end date (`YYYY-MM-DD`)
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `10`)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store customers fetched successfully",
  "data": {
    "customers": [
      {
        "_id": "66b1a234f9a12c0012345678",
        "storeId": "66b1a000f9a12c0012345000",
        "name": "Brooklyn Simmons",
        "email": "example@mail.com",
        "phone": "9876543210",
        "dateOfBirth": "1990-09-11T00:00:00.000Z",
        "address": "3517 W. Gray St",
        "totalPurchase": 18400,
        "amountDue": 4000,
        "totalOrders": 8,
        "totalStoreVisits": 6,
        "status": "active",
        "createdAt": "2026-08-28T16:00:00.000Z",
        "updatedAt": "2026-08-28T16:00:00.000Z"
      }
    ]
  },
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 11.3 Get Customer Details & Analytics
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/customers/:id`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer details fetched successfully",
  "data": {
    "customer": {
      "_id": "66b1a234f9a12c0012345678",
      "storeId": "66b1a000f9a12c0012345000",
      "name": "Brooklyn Simmons",
      "email": "example@mail.com",
      "phone": "9876543210",
      "dateOfBirth": "1990-09-11T00:00:00.000Z",
      "address": "3517 W. Gray St",
      "totalPurchase": 18400,
      "amountDue": 4000,
      "totalOrders": 8,
      "totalStoreVisits": 6,
      "status": "active"
    },
    "purchaseInformation": {
      "totalOrders": 8,
      "totalBillAmount": 18400,
      "totalDueAmount": 4000
    },
    "summary": {
      "avgStoreVisitsPerMonth": 1,
      "totalStoreVisits": 6,
      "avgMonthlyBillValue": 2300
    },
    "spentChart": [
      { "month": "Jan", "amount": 1840 },
      { "month": "Feb", "amount": 2760 },
      { "month": "Mar", "amount": 1472 },
      { "month": "Apr", "amount": 2576 },
      { "month": "May", "amount": 4048 },
      { "month": "Jun", "amount": 2944 },
      { "month": "Jul", "amount": 2760 }
    ],
    "topPurchasedProducts": [
      { "item": "Product 1", "quantity": "150 pc" },
      { "item": "Product 2", "quantity": "50 kg" },
      { "item": "Product 3", "quantity": "150 pc" },
      { "item": "Product 4", "quantity": "150 pc" },
      { "item": "Product 5", "quantity": "150 pc" }
    ]
  }
}
```

---

### 11.4 Update Customer
- **Method**: `PUT`
- **Endpoint**: `/api/store-employee/customers/:id`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "Brooklyn Simmons Updated",
  "email": "updated@mail.com",
  "address": "4517 Washington Ave"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer details updated successfully",
  "data": {
    "customer": {
      "_id": "66b1a234f9a12c0012345678",
      "name": "Brooklyn Simmons Updated",
      "email": "updated@mail.com",
      "phone": "9876543210",
      "address": "4517 Washington Ave"
    }
  }
}
```

---

### 11.5 Pay Customer Due Amount
- **Method**: `POST`
- **Endpoint**: `/api/store-employee/customers/:id/pay-due`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "amount": 1500
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Payment of ₹1500 applied successfully",
  "data": {
    "customer": {
      "_id": "66b1a234f9a12c0012345678", 
      "name": "Brooklyn Simmons",
      "amountDue": 2500
    },
    "paidAmount": 1500,
    "remainingDue": 2500
  }
}
```

---

### 11.6 Export Store Customers
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/customers/export`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store customer export data generated successfully",
  "data": {
    "customers": [
      {
        "srNo": 1,
        "name": "Brooklyn Simmons",
        "mobile": "9876543210",
        "email": "example@mail.com",
        "totalPurchase": 18400,
        "amountDue": 2500,
        "address": "3517 W. Gray St",
        "status": "active",
        "createdAt": "2026-08-28T16:00:00.000Z"
      }
    ],
    "totalCount": 1
  }
}
```

---

### 11.7 Delete Customer
- **Method**: `DELETE`
- **Endpoint**: `/api/store-employee/customers/:id`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

---

# 12. 🧾 Tax Management APIs (`/api/admin/offers-and-tax-management/taxes`)

---

### 12.1 Create Tax Rule
- **Method**: `POST`
- **Endpoint**: `/api/admin/offers-and-tax-management/taxes`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "productType": "60d5ecb8b3b3a20015f8e001",
  "category": "60d5ecb8b3b3a20015f8e002",
  "subcategory": "60d5ecb8b3b3a20015f8e003",
  "cgst": 5,
  "sgst": 5
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Tax created successfully",
  "data": {
    "tax": {
      "_id": "60d5ecb8b3b3a20015f8fb11",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e001",
        "name": "Electronics"
      },
      "category": {
        "_id": "60d5ecb8b3b3a20015f8e002",
        "name": "Mobile Phones"
      },
      "subcategory": {
        "_id": "60d5ecb8b3b3a20015f8e003",
        "name": "Smartphones"
      },
      "cgst": 5,
      "sgst": 5,
      "isDeleted": false,
      "createdAt": "2026-08-29T12:00:00.000Z",
      "updatedAt": "2026-08-29T12:00:00.000Z"
    }
  }
}
```

---

### 12.2 List Tax Rules
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/taxes`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Searches product type, category, or subcategory name
  - `productType` (string, optional): Filter by ProductType ObjectId (Filter Modal)
  - `category` (string, optional): Filter by Category ObjectId (Filter Modal)
  - `subcategory` (string, optional): Filter by Subcategory ObjectId (Filter Modal)
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Taxes fetched successfully",
  "data": {
    "taxes": [
      {
        "_id": "60d5ecb8b3b3a20015f8fb11",
        "productType": {
          "_id": "60d5ecb8b3b3a20015f8e001",
          "name": "Electronics"
        },
        "category": {
          "_id": "60d5ecb8b3b3a20015f8e002",
          "name": "Mobile Phones"
        },
        "subcategory": {
          "_id": "60d5ecb8b3b3a20015f8e003",
          "name": "Smartphones"
        },
        "cgst": 5,
        "sgst": 5
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

---

### 12.3 Get Tax Details By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/taxes/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Tax details fetched successfully",
  "data": {
    "tax": {
      "_id": "60d5ecb8b3b3a20015f8fb11",
      "productType": {
        "_id": "60d5ecb8b3b3a20015f8e001",
        "name": "Electronics"
      },
      "category": {
        "_id": "60d5ecb8b3b3a20015f8e002",
        "name": "Mobile Phones"
      },
      "subcategory": {
        "_id": "60d5ecb8b3b3a20015f8e003",
        "name": "Smartphones"
      },
      "cgst": 5,
      "sgst": 5
    }
  }
}
```

---

### 12.4 Update Tax Rule
- **Method**: `PUT`
- **Endpoint**: `/api/admin/offers-and-tax-management/taxes/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "cgst": 9,
  "sgst": 9
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Tax updated successfully",
  "data": {
    "tax": {
      "_id": "60d5ecb8b3b3a20015f8fb11",
      "cgst": 9,
      "sgst": 9
    }
  }
}
```

---

### 12.5 Delete Tax Rule
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/offers-and-tax-management/taxes/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Tax deleted successfully"
}
```

---

### 12.6 Get Tax Filter Options (Populate Filter Modal & Form Dropdowns)
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/taxes/filter-options`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Description**: Returns all active Product Types, Categories, and Subcategories in dropdown `{ label, value }` format with relational mapping for cascading dropdowns.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Tax filter options fetched successfully",
  "data": {
    "productTypes": [
      {
        "label": "Electronics",
        "value": "60d5ecb8b3b3a20015f8e001"
      },
      {
        "label": "Fashion",
        "value": "60d5ecb8b3b3a20015f8e002"
      }
    ],
    "categories": [
      {
        "label": "Mobile Phones",
        "value": "60d5ecb8b3b3a20015f8e003",
        "productType": "60d5ecb8b3b3a20015f8e001"
      }
    ],
    "subcategories": [
      {
        "label": "Smartphones",
        "value": "60d5ecb8b3b3a20015f8e004",
        "category": "60d5ecb8b3b3a20015f8e003",
        "productType": "60d5ecb8b3b3a20015f8e001"
      }
    ]
  }
}
```

---

### 12.7 Get Categories By Product Type (Cascading Dropdown)
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/categories/by-product-type/:productTypeId`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Categories fetched by Product Type successfully",
  "data": [
    {
      "label": "Mobile Phones",
      "value": "60d5ecb8b3b3a20015f8e003",
      "productType": "60d5ecb8b3b3a20015f8e001"
    }
  ]
}
```

---

### 12.8 Get Subcategories By Category (Cascading Dropdown)
- **Method**: `GET`
- **Endpoint**: `/api/admin/product-management/subcategories/by-category/:categoryId`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Subcategories fetched by Category successfully",
  "data": [
    {
      "label": "Smartphones",
      "value": "60d5ecb8b3b3a20015f8e004",
      "category": "60d5ecb8b3b3a20015f8e003",
      "productType": "60d5ecb8b3b3a20015f8e001"
    }
  ]
}
```

---

# 13. 🏷️ Offers Management APIs (`/api/admin/offers-and-tax-management/offers`)

---

### 13.1 Get Offer Form Options (Pre-Populate Stores & Push Target Customers)
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers/options`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `storeId` (string, optional): Filter push target customers by single Store ObjectId
  - `storeIds` (string, optional): Filter push target customers by comma-separated Store ObjectIds (e.g. `?storeIds=60d5ecb8b3b3a20015f8e001,60d5ecb8b3b3a20015f8e002`)
- **Description**: Returns stores multiselect list, customer push offer selection list (filterable by selected store/stores), and live products/categories for Create/Edit Offer forms.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offer form options fetched successfully",
  "data": {
    "stores": [
      {
        "label": "Daily Choice Mart",
        "value": "60d5ecb8b3b3a20015f8e001",
        "storeCode": "ST-001"
      }
    ],
    "customers": [
      {
        "id": "60d5ecb8b3b3a20015f8c001",
        "name": "Brooklyn Simmons",
        "mobile": "9876543210",
        "storeId": "60d5ecb8b3b3a20015f8e001",
        "totalPurchase": 18400,
        "amountDue": 4000
      }
    ],
    "products": [
      { "id": "ALL_PRODUCTS", "name": "All Products", "type": "general" },
      { "id": "60d5ecb8b3b3a20015f8e005", "name": "All Mobile Phones", "type": "category" }
    ]
  }
}
```

---

### 13.2 Create Offer
- **Method**: `POST`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "5 % Discount On All Products",
  "description": "Special store wide promotion",
  "offerType": "store_wide",
  "offersOn": "both",
  "stores": ["60d5ecb8b3b3a20015f8e001"],
  "applyToAllStores": false,
  "validFrom": "2026-08-01",
  "validTo": "2026-12-31",
  "discountType": "percentage",
  "discountValue": 5,
  "appliesTo": "all",
  "sendToAllCustomers": true,
  "targetCustomers": ["60d5ecb8b3b3a20015f8c001"]
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Offer created successfully",
  "data": {
    "offer": {
      "_id": "60d5ecb8b3b3a20015f8f900",
      "name": "5 % Discount On All Products",
      "offerType": "store_wide",
      "offersOn": "both",
      "validFrom": "2026-08-01T00:00:00.000Z",
      "validTo": "2026-12-31T00:00:00.000Z",
      "discountType": "percentage",
      "discountValue": 5,
      "status": "active",
      "isDeleted": false
    }
  }
}
```

---

### 13.3 List Offers
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Search offer name
  - `status` (string, optional): `active`, `inactive`, or `expired`
  - `startDate` (string, optional): Filter by `validFrom` date
  - `endDate` (string, optional): Filter by `validTo` date
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offers fetched successfully",
  "data": {
    "offers": [
      {
        "_id": "60d5ecb8b3b3a20015f8f900",
        "name": "5 % Discount On All Products",
        "product": "All Product",
        "pushOfferTo": "All Customer",
        "discountLabel": "5%",
        "validTo": "2026-12-31T00:00:00.000Z",
        "status": "active",
        "isExpired": false
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 13.4 Get Offer Details By ID
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offer details fetched successfully",
  "data": {
    "offer": {
      "_id": "60d5ecb8b3b3a20015f8f900",
      "name": "5 % Discount On All Products",
      "discountType": "percentage",
      "discountValue": 5,
      "status": "active"
    }
  }
}
```

---

### 13.5 Update Offer
- **Method**: `PUT`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "discountValue": 10
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offer updated successfully",
  "data": {
    "offer": {
      "_id": "60d5ecb8b3b3a20015f8f900",
      "discountValue": 10
    }
  }
}
```

---

### 13.6 Toggle Offer Status (Active/Inactive)
- **Method**: `PATCH`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers/:id/status`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offer status changed to inactive",
  "data": {
    "id": "60d5ecb8b3b3a20015f8f900",
    "status": "inactive"
  }
}
```

---

### 13.7 Delete Offer
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers/:id`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offer deleted successfully"
}
```

---

### 13.8 Export Offers List
- **Method**: `GET`
- **Endpoint**: `/api/admin/offers-and-tax-management/offers/export`
- **Authorization**: `Bearer <ADMIN_JWT_TOKEN>` OR `Cookie: adminToken=<ADMIN_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Offers export data generated successfully",
  "data": {
    "offers": [
      {
        "srNo": 1,
        "offerName": "5 % Discount On All Products",
        "product": "All Product",
        "pushOfferTo": "All Customer",
        "discount": "5%",
        "expiryDate": "2026-12-31",
        "status": "Active"
      }
    ],
    "totalCount": 1
  }
}
```

---

# 14. 🏬 Store Panel Offers APIs (`/api/store-employee/offers`)

---

### 14.1 Get Store Offer Form Options
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/offers/options`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Description**: Returns live database customers registered at the logged-in employee's assigned store, plus live master products and categories.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offer form options fetched successfully",
  "data": {
    "storeId": "60d5ecb8b3b3a20015f8e001",
    "customers": [
      {
        "id": "60d5ecb8b3b3a20015f8c001",
        "name": "Brooklyn Simmons",
        "mobile": "9876543210",
        "storeId": "60d5ecb8b3b3a20015f8e001",
        "totalPurchase": 18400,
        "amountDue": 4000
      }
    ],
    "products": [
      { "id": "ALL_PRODUCTS", "name": "All Products", "type": "general" },
      { "id": "60d5ecb8b3b3a20015f8e005", "name": "All Mobile Phones", "type": "category" }
    ]
  }
}
```

---

### 14.2 Create Store Offer
- **Method**: `POST`
- **Endpoint**: `/api/store-employee/offers`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "name": "10% Store Discount",
  "description": "Special offer for in-store customers",
  "offerType": "store_wide",
  "offersOn": "both",
  "validFrom": "2026-09-01",
  "validTo": "2026-12-31",
  "discountType": "percentage",
  "discountValue": 10,
  "appliesTo": "all",
  "sendToAllCustomers": false,
  "targetCustomers": ["60d5ecb8b3b3a20015f8c001"]
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Store offer created successfully",
  "data": {
    "offer": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "name": "10% Store Discount",
      "validFrom": "2026-09-01T00:00:00.000Z",
      "validTo": "2026-12-31T00:00:00.000Z",
      "discountType": "percentage",
      "discountValue": 10,
      "status": "active"
    }
  }
}
```

---

### 14.3 List Store Offers
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/offers`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**:
  - `search` (string, optional): Search offer name
  - `status` (string, optional): `active`, `inactive`, or `expired`
  - `startDate` (string, optional): Filter by `validFrom` date
  - `endDate` (string, optional): Filter by `validTo` date
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offers fetched successfully",
  "data": {
    "offers": [
      {
        "_id": "60d5ecb8b3b3a20015f8f999",
        "name": "10% Store Discount",
        "product": "All Product",
        "pushOfferTo": "1 Customer",
        "discountLabel": "10%",
        "validTo": "2026-12-31T00:00:00.000Z",
        "status": "active",
        "isExpired": false
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 14.4 Get Store Offer Details By ID
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/offers/:id`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offer details fetched successfully",
  "data": {
    "offer": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "name": "10% Store Discount",
      "discountType": "percentage",
      "discountValue": 10,
      "status": "active"
    }
  }
}
```

---

### 14.5 Update Store Offer
- **Method**: `PUT`
- **Endpoint**: `/api/store-employee/offers/:id`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "discountValue": 15
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offer updated successfully",
  "data": {
    "offer": {
      "_id": "60d5ecb8b3b3a20015f8f999",
      "discountValue": 15
    }
  }
}
```

---

### 14.6 Toggle Store Offer Status
- **Method**: `PATCH`
- **Endpoint**: `/api/store-employee/offers/:id/status`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Body Type**: `Raw JSON`
- **Request Body**:
```json
{
  "status": "inactive"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offer status changed to inactive",
  "data": {
    "id": "60d5ecb8b3b3a20015f8f999",
    "status": "inactive"
  }
}
```

---

### 14.7 Delete Store Offer
- **Method**: `DELETE`
- **Endpoint**: `/api/store-employee/offers/:id`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offer deleted successfully"
}
```

---

### 14.8 Export Store Offers List
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/offers/export`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store offers export data generated successfully",
  "data": {
    "offers": [
      {
        "srNo": 1,
        "offerName": "10% Store Discount",
        "product": "All Product",
        "pushOfferTo": "1 Customer",
        "discount": "10%",
        "expiryDate": "2026-12-31",
        "status": "Active"
      }
    ],
    "totalCount": 1
  }
}
```

---

# 15. 📊 Store Panel Dashboard APIs (`/api/store-employee/dashboard`)

---

### 15.1 Main Dashboard Overview
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/dashboard`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Description**: Returns top store greeting, 5 summary metric cards, monthly analytics charts (Customer, Order & Revenue Growth), and top 5 preview widgets.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Store dashboard overview fetched successfully",
  "data": {
    "storeInfo": {
      "name": "Daily Choice Mart",
      "greeting": "Welcome To Daily Choice Mart",
      "subtitle": "Manage Store"
    },
    "metrics": {
      "availableStocks": 10657,
      "totalProducts": 10657,
      "totalCustomers": 664254,
      "totalOrders": 5487404,
      "totalRevenue": 85487404
    },
    "charts": {
      "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      "customerGrowth": {
        "thisYear": [2000, 3000, 2500, 3000, 3200, 6000, 10000, 8000, 9000, 10000, 11000, 12000],
        "lastYear": [2000, 3000, 3000, 4500, 2500, 2200, 5000, 8000, 9000, 10000, 11000, 13000]
      },
      "orderGrowth": {
        "thisYear": [3000, 2500, 3000, 3200, 6000, 10000, 8000, 9000, 10000, 11000, 12000, 14000],
        "lastYear": [2000, 3000, 3000, 4500, 2500, 2200, 5000, 8000, 9000, 10000, 11000, 13000]
      },
      "revenueGrowth": {
        "thisYear": [30000, 25000, 30000, 32000, 60000, 100000, 80000, 90000, 100000, 110000, 120000, 140000],
        "lastYear": [20000, 30000, 30000, 45000, 25000, 22000, 50000, 80000, 90000, 100000, 110000, 130000]
      }
    },
    "recentOrders": [
      {
        "_id": "60d5ecb8b3b3a20015f8e001",
        "orderId": "ORD-1001",
        "amount": 1250,
        "time": "06:35 AM",
        "date": "2026-09-02"
      }
    ],
    "recentCustomers": [
      {
        "_id": "60d5ecb8b3b3a20015f8c001",
        "customerName": "Kathryn Murphy",
        "mobile": "9876543210",
        "date": "2026-09-02"
      }
    ],
    "lowStockProducts": [
      {
        "_id": "60d5ecb8b3b3a20015f8p001",
        "productName": "Amul Milk",
        "quantity": "1 L",
        "stock": 5
      }
    ],
    "expiringProducts": [
      {
        "_id": "60d5ecb8b3b3a20015f8p001",
        "productName": "Amul Milk",
        "expiryDate": "2026-09-05",
        "daysLeft": "3 Days",
        "stock": 5
      }
    ],
    "mostDemandingProducts": [
      {
        "_id": "60d5ecb8b3b3a20015f8p001",
        "productName": "Amul Milk",
        "category": "Dairy",
        "totalUnitsSold": 420
      }
    ]
  }
}
```

---

### 15.2 See All Recent Orders (Paginated)
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/dashboard/recent-orders`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**: `search`, `page`, `limit`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Recent orders fetched successfully",
  "data": {
    "orders": [
      {
        "_id": "60d5ecb8b3b3a20015f8e001",
        "orderId": "ORD-1001",
        "amount": 1250,
        "grossAmount": 1250,
        "paymentStatus": "Paid",
        "time": "06:35 AM",
        "date": "2026-09-02"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 15.3 See All Recent Customers (Paginated)
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/dashboard/recent-customers`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**: `search`, `page`, `limit`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Recent customers fetched successfully",
  "data": {
    "customers": [
      {
        "_id": "60d5ecb8b3b3a20015f8c001",
        "customerName": "Kathryn Murphy",
        "mobile": "9876543210",
        "totalPurchase": 18400,
        "amountDue": 4000,
        "date": "2026-09-02"
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 15.4 See All Low Stock Products (Paginated)
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/dashboard/low-stock-products`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**: `search`, `threshold`, `page`, `limit`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Low stock products fetched successfully",
  "data": {
    "products": [
      {
        "_id": "60d5ecb8b3b3a20015f8p001",
        "productName": "Amul Milk",
        "category": "Dairy",
        "quantity": "1 L",
        "stock": 5,
        "alertQuantity": 10
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 15.5 See All Expiring Products (Paginated)
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/dashboard/expiring-products`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**: `search`, `days`, `page`, `limit`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Expiring products fetched successfully",
  "data": {
    "products": [
      {
        "_id": "60d5ecb8b3b3a20015f8p001",
        "productName": "Amul Milk",
        "batch": "B240701A",
        "expiryDate": "2026-09-05",
        "daysLeft": "3 Days",
        "stock": 5
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 15.6 See All Most Demanding Products (Paginated)
- **Method**: `GET`
- **Endpoint**: `/api/store-employee/dashboard/most-demanding-products`
- **Authorization**: `Bearer <STORE_EMPLOYEE_JWT_TOKEN>` OR `Cookie: storeEmployeeToken=<STORE_EMPLOYEE_JWT_TOKEN>`
- **Query Parameters**: `page`, `limit`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Most demanding products fetched successfully",
  "data": {
    "products": [
      {
        "_id": "60d5ecb8b3b3a20015f8p001",
        "productName": "Amul Milk",
        "category": "Dairy",
        "totalUnitsSold": 420
      }
    ]
  },
  "pagination": {
    "skip": 0,
    "limit": 10,
    "totalItems": 1,
    "page": 1,
    "totalPages": 1
  }
}
```










