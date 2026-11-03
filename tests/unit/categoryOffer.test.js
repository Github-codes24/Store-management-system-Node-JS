import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import Offer from '../../src/models/offer.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import AdminProduct from '../../src/models/adminProduct.model.js';
import Category from '../../src/models/category.model.js';
import { enrichOffersWithProducts } from '../../src/utils/offerHelper.js';

describe('Category-based Store Offers', () => {
  const dummyCatId = new mongoose.Types.ObjectId();

  beforeAll(() => {
    jest.spyOn(StoreProduct, 'find').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    jest.spyOn(AdminProduct, 'find').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    jest.spyOn(Category, 'find').mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: dummyCatId, name: 'Beverages' }]),
      }),
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should support category field in Offer schema and default appliesTo to category when category is provided', () => {
    const catId = new mongoose.Types.ObjectId();
    const offer = new Offer({
      name: '10% Discount on Grocery',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 86400000 * 5),
      discountType: 'percentage',
      discountValue: 10,
      offerType: 'store_wide',
      appliesTo: 'category',
      category: catId,
      categories: [catId],
    });

    expect(offer.appliesTo).toBe('category');
    expect(String(offer.category)).toBe(String(catId));
    expect(offer.categories).toHaveLength(1);
  });

  it('should correctly enrich offer with category label and product name', async () => {
    const rawOffer = {
      _id: new mongoose.Types.ObjectId(),
      name: '10% Discount on Beverages',
      offerType: 'store_wide',
      appliesTo: 'category',
      discountType: 'percentage',
      discountValue: 10,
      category: dummyCatId,
      products: [],
      productPricing: [],
    };

    const enriched = await enrichOffersWithProducts(rawOffer);
    expect(enriched.categoryName).toBe('Beverages');
    expect(enriched.product).toBe('All Beverages');
  });

  it('should calculate discount only on items belonging to the matching category', () => {
    const targetCatId = new mongoose.Types.ObjectId().toString();
    const otherCatId = new mongoose.Types.ObjectId().toString();

    const appliedOffer = {
      appliesTo: 'category',
      category: targetCatId,
      discountType: 'percentage',
      discountValue: 10,
    };

    const processedItems = [
      { product: 'p1', category: targetCatId, sellingPrice: 100, quantity: 2, totalAmount: 200 },
      { product: 'p2', category: otherCatId, sellingPrice: 50, quantity: 1, totalAmount: 50 },
    ];

    const eligibleSubtotal = processedItems
      .filter((p) => String(p.category) === String(appliedOffer.category))
      .reduce((sum, p) => sum + p.totalAmount, 0);

    expect(eligibleSubtotal).toBe(200);

    const discountAmount = parseFloat(((eligibleSubtotal * appliedOffer.discountValue) / 100).toFixed(2));
    expect(discountAmount).toBe(20);
  });
});
