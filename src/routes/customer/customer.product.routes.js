import { Router } from 'express';
import {
  getCustomerProductTypes,
  getCustomerCategories,
  getCustomerSubcategories,
  getCustomerProducts,
  getCustomerProductById,
  getCustomerOffers,
} from '../../controllers/customer/customer.product.controller.js';

const router = Router();

// Public / Customer Product & Catalog Endpoints
router.get('/product-types', getCustomerProductTypes);
router.get('/categories', getCustomerCategories);
router.get('/subcategories', getCustomerSubcategories);
router.get('/offers', getCustomerOffers);
router.get('/products', getCustomerProducts);
router.get('/products/:id', getCustomerProductById);

export default router;
