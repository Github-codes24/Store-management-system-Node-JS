import { jest } from '@jest/globals';
import { getStorePnLReport } from '../../src/controllers/store-employee/storeReport.controller.js';
import StoreOrder from '../../src/models/storeOrder.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import ProductType from '../../src/models/productType.model.js';

describe('Store Employee P&L Report Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      storeEmployee: {
        store: '60c72b2f9b1d8b2884a282f1',
      },
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getStorePnLReport should calculate summaryCards and productTypeBreakdown correctly', async () => {
    const mockStoreProducts = [
      {
        _id: '60c72b2f9b1d8b2884a282f2',
        productName: 'Rice 5kg',
        purchasePrice: 200,
        productType: '60c72b2f9b1d8b2884a282f3',
      },
    ];

    const mockProductTypes = [
      {
        _id: '60c72b2f9b1d8b2884a282f3',
        name: 'Groceries',
      },
    ];

    const mockOrders = [
      {
        _id: '60c72b2f9b1d8b2884a282f4',
        store: '60c72b2f9b1d8b2884a282f1',
        createdAt: new Date(),
        bills: [
          {
            netAmount: 300,
            items: [
              {
                product: '60c72b2f9b1d8b2884a282f2',
                productName: 'Rice 5kg',
                sellingPrice: 300,
                purchasePrice: 200,
                quantity: 1,
                returnedQuantity: 0,
                totalAmount: 300,
              },
            ],
          },
        ],
      },
    ];

    jest.spyOn(StoreProduct, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockStoreProducts),
    });

    jest.spyOn(ProductType, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProductTypes),
    });

    jest.spyOn(StoreOrder, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockOrders),
    });

    await getStorePnLReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.summaryCards).toBeDefined();
    expect(responseBody.data.summaryCards.totalRevenue.value).toBe(300);
    expect(responseBody.data.summaryCards.productCost.value).toBe(200);
    expect(responseBody.data.summaryCards.netProfit.value).toBe(100);
    expect(responseBody.data.summaryCards.profitMargin.value).toBe(33.33);
  });
});
