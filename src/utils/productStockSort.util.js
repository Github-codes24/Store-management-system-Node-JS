/**
 * Utility to build an aggregation pipeline for prioritizing products by:
 * 1. Expiring soon (expiry date within each product's specific expiryAlert window, default 30 days) - earliest expiry date first
 * 2. Low stock (stockQuantity <= minStockAlert or alertQuantity or reorderPoint) - lowest stock first
 * 3. Out of stock (stockQuantity === 0)
 * 4. Future expiring products (expiry date > expiryAlert threshold) - earliest expiry date
 * 5. Normal products - lowest stock first, then newest
 */
export const buildExpiringAndLowStockPipeline = ({
  filter = {},
  pagination = { skip: 0, limit: 10 },
  sortBy = null,
  sortOrder = 'desc',
}) => {
  const isCustomSort =
    sortBy &&
    !['createdAt', 'expiring', 'low_stock', 'expiring_low_stock', 'default'].includes(sortBy);

  if (isCustomSort) {
    const customSortStage = {};
    customSortStage[sortBy] = sortOrder === 'asc' ? 1 : -1;
    return [
      { $match: filter },
      { $sort: customSortStage },
      { $skip: pagination.skip },
      { $limit: pagination.limit },
      { $project: { _id: 1 } },
    ];
  }

  const now = new Date();

  return [
    { $match: filter },
    {
      $addFields: {
        effectiveExpiry: {
          $cond: [
            {
              $and: [
                { $ne: ['$expiryDate', null] },
                { $ne: [{ $type: '$expiryDate' }, 'missing'] },
              ],
            },
            '$expiryDate',
            new Date('9999-12-31T23:59:59.999Z'),
          ],
        },
        alertCutoffDate: {
          $add: [
            now,
            {
              $multiply: [
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$expiryAlert', null] },
                        { $ne: [{ $type: '$expiryAlert' }, 'missing'] },
                        { $gt: ['$expiryAlert', 0] },
                      ],
                    },
                    '$expiryAlert',
                    30,
                  ],
                },
                86400000,
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        sortPriority: {
          $switch: {
            branches: [
              // Priority 1: Expiring soon (within product's individual expiryAlert window)
              {
                case: {
                  $and: [
                    { $ne: ['$expiryDate', null] },
                    { $ne: [{ $type: '$expiryDate' }, 'missing'] },
                    { $lte: ['$expiryDate', '$alertCutoffDate'] },
                  ],
                },
                then: 1,
              },
              // Priority 2: Low stock (> 0 and <= minStockAlert or alertQuantity or reorderPoint)
              {
                case: {
                  $and: [
                    { $gt: ['$stockQuantity', 0] },
                    {
                      $or: [
                        {
                          $and: [
                            { $gt: [{ $ifNull: ['$minStockAlert', 0] }, 0] },
                            { $lte: ['$stockQuantity', '$minStockAlert'] },
                          ],
                        },
                        {
                          $and: [
                            { $gt: [{ $ifNull: ['$alertQuantity', 0] }, 0] },
                            { $lte: ['$stockQuantity', '$alertQuantity'] },
                          ],
                        },
                        {
                          $and: [
                            { $gt: [{ $ifNull: ['$reorderPoint', 0] }, 0] },
                            { $lte: ['$stockQuantity', '$reorderPoint'] },
                          ],
                        },
                      ],
                    },
                  ],
                },
                then: 2,
              },
              // Priority 3: Out of stock (stock == 0)
              {
                case: { $lte: ['$stockQuantity', 0] },
                then: 3,
              },
              // Priority 4: Future expiry (beyond product's expiryAlert window)
              {
                case: {
                  $and: [
                    { $ne: ['$expiryDate', null] },
                    { $ne: [{ $type: '$expiryDate' }, 'missing'] },
                  ],
                },
                then: 4,
              },
            ],
            default: 5,
          },
        },
      },
    },
    {
      $sort: {
        sortPriority: 1,
        effectiveExpiry: 1,
        expiryAlert: 1,
        stockQuantity: 1,
        createdAt: -1,
      },
    },
    { $skip: pagination.skip },
    { $limit: pagination.limit },
    { $project: { _id: 1 } },
  ];
};
