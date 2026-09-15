import { Router } from 'express';
import {
  getCustomerProductTypes,
  getCustomerCategories,
  getCustomerSubcategories,
  getCustomerProducts,
  getCustomerProductById,
  getCustomerOffers,
  getCategoryTree,
  getHomeDashboard,
  getBestDiscounts,
  getRecommendedProducts,
  getPreviouslyBought,
} from '../../controllers/customer/customer.product.controller.js';
import customerAuthMiddleware, { optionalCustomerAuth } from '../../middlewares/customer.auth.middleware.js';

const router = Router();

// Public / Customer Product & Catalog Endpoints
router.get('/category-tree', getCategoryTree);
router.get('/home-dashboard', optionalCustomerAuth, getHomeDashboard);
router.get('/best-discounts', getBestDiscounts);
router.get('/recommended', getRecommendedProducts);
router.get('/previously-bought', customerAuthMiddleware, getPreviouslyBought);

router.get('/product-types', getCustomerProductTypes);
router.get('/categories', getCustomerCategories);
router.get('/subcategories', getCustomerSubcategories);
router.get('/offers', getCustomerOffers);
router.get('/products', getCustomerProducts);
router.get('/products/:id', getCustomerProductById);

export default router;
