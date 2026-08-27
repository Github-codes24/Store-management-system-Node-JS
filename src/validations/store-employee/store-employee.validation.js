import { z } from 'zod';



export const createStoreEmployeeSchema = {
    body: z.object({

    name: z.string().min(1, "Name is required").max(255, "Name must be less than 255 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").max(255, "Password must be less than 255 characters"),
    phone: z.string().min(10, "Phone number must be at least 10 digits").max(10, "Phone number must be less than 10 digits").optional(),
    designation: z.string().min(1, "Designation is required").max(255, "Designation must be less than 255 characters"),
    address: z.string().min(1, "Address is required").max(255, "Address must be less than 255 characters").optional(),
    storeId: z.string().min(1, "Store ID is required").max(255, "Store ID must be less than 255 characters"),
    username: z.string()
      .max(255, "Username must be less than 255 characters")
      .optional()
      .transform(val => {
        if (!val) return val;
        return val
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s-]+/g, '_');
      }),
    })
}


export const storeEmployeeLoginSchema = {
    body: z.object({
        username: z.preprocess(
            (val) => (val === '' ? undefined : val),
            z.string().min(1, "Username is required").max(255).optional()
        ),
        email: z.preprocess(
            (val) => (val === '' ? undefined : val),
            z.string().email("Invalid email address").optional()
        ),
        password: z.string().min(6, "Password must be at least 6 characters").max(255),
    }).refine(data => data.username || data.email, {
        message: "Please provide either username or email",
        path: ["username"]
    })
}