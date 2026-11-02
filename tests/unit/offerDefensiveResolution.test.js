import { jest } from '@jest/globals';
import { resolveProductDocument, sanitizeProductIds, enrichOffersWithProducts, isValidObjectId } from '../../src/utils/offerHelper.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import AdminProduct from '../../src/models/adminProduct.model.js';
import Category from '../../src/models/category.model.js';
import mongoose from 'mongoose';

describe('Offer Defensive Product Resolution and CastError Prevention', () => {
  const dummyProdId = new mongoose.Types.ObjectId();
  const dummyStoreId = new mongoose.Types.ObjectId();

  beforeAll(() => {
    jest.spyOn(StoreProduct, 'findById').mockImplementation((id) => {
      if (!isValidObjectId(id)) {
        throw new mongoose.Error.CastError('ObjectId', id, '_id');
      }
      if (String(id) === String(dummyProdId)) {
        return {
          lean: () => Promise.resolve({
            _id: dummyProdId,
            productName: 'Test Product 100 - Diwali Special',
            barcode: '8908000100099',
            mrp: 120,
            offlineSellingPrice: 100,
          }),
        };
      }
      return { lean: () => Promise.resolve(null) };
    });

    jest.spyOn(StoreProduct, 'findOne').mockImplementation((query) => {
      if (query?.$or) {
        const matchesName = query.$or.some(
          (cond) => cond.productName === 'Test Product 100 - Diwali Special' ||
                    (cond.productName?.$regex && cond.productName.$regex.test('Test Product 100 - Diwali Special'))
        );
        if (matchesName) {
          return {
            lean: () => Promise.resolve({
              _id: dummyProdId,
              productName: 'Test Product 100 - Diwali Special',
              barcode: '8908000100099',
              mrp: 120,
              offlineSellingPrice: 100,
            }),
          };
        }
      }
      return { lean: () => Promise.resolve(null) };
    });

    jest.spyOn(AdminProduct, 'findById').mockReturnValue({ lean: () => Promise.resolve(null) });
    jest.spyOn(AdminProduct, 'findOne').mockReturnValue({ lean: () => Promise.resolve(null) });

    jest.spyOn(StoreProduct, 'find').mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([
          {
            _id: dummyProdId,
            productName: 'Test Product 100 - Diwali Special',
            barcode: '8908000100099',
            mrp: 120,
            offlineSellingPrice: 100,
          },
        ]),
      }),
    });
    jest.spyOn(AdminProduct, 'find').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    jest.spyOn(Category, 'find').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('resolveProductDocument', () => {
    it('should resolve product by valid ObjectId string', async () => {
      const doc = await resolveProductDocument(dummyProdId.toString());
      expect(doc).toBeDefined();
      expect(doc._id).toEqual(dummyProdId);
    });

    it('should resolve product by product name string without throwing CastError', async () => {
      const doc = await resolveProductDocument('Test Product 100 - Diwali Special');
      expect(doc).toBeDefined();
      expect(doc._id).toEqual(dummyProdId);
      expect(doc.productName).toBe('Test Product 100 - Diwali Special');
    });

    it('should resolve product when comma-separated duplicate string is provided', async () => {
      const doc = await resolveProductDocument('Test Product 100 - Diwali Special, Test Product 100 - Diwali Special');
      expect(doc).toBeDefined();
      expect(doc._id).toEqual(dummyProdId);
    });

    it('should return null cleanly for non-existent product without throwing CastError', async () => {
      const doc = await resolveProductDocument('Non Existent Product Name XYZ');
      expect(doc).toBeNull();
    });
  });

  describe('sanitizeProductIds', () => {
    it('should resolve and deduplicate comma-separated product names into valid ObjectId strings', async () => {
      const rawProducts = [
        'Test Product 100 - Diwali Special, Test Product 100 - Diwali Special',
        dummyProdId.toString(),
      ];
      const sanitized = await sanitizeProductIds(rawProducts);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0]).toBe(dummyProdId.toString());
      expect(isValidObjectId(sanitized[0])).toBe(true);
    });
  });

  describe('enrichOffersWithProducts deduplication', () => {
    it('should avoid duplicating product names in productLabel when raw products have duplicates', async () => {
      const mockOffer = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Offer',
        discountType: 'percentage',
        products: [
          'Test Product 100 - Diwali Special',
          dummyProdId.toString(),
        ],
        productPricing: [
          {
            product: dummyProdId,
            productName: 'Test Product 100 - Diwali Special',
            updatedSellingPrice: 120,
          },
        ],
      };

      const enriched = await enrichOffersWithProducts(mockOffer);
      expect(enriched.product).toBe('Test Product 100 - Diwali Special');
      expect(enriched.productLabel).toBe('Test Product 100 - Diwali Special');
      expect(enriched.resolvedProducts).toHaveLength(1);
    });
  });
});
