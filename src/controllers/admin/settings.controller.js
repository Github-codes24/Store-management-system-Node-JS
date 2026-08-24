import Settings from '../../models/settings.model.js';
import { successResponse } from '../../utils/api-response.js';

/**
 * Get Settings details
 */
export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne().populate('updatedBy', 'name email role');

    if (!settings) {
      settings = await Settings.create({
        deliveryRangeKm: 5,
        supportNumber: '+91 9876543210',
        supportEmail: 'support@companyname.com',
      });
    }

    return res.status(200).json(
      successResponse({
        message: 'Settings fetched successfully',
        data: { settings },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Settings details
 */
export const updateSettings = async (req, res, next) => {
  try {
    const { deliveryRangeKm, supportNumber, supportEmail } = req.body;

    const updates = {};
    if (deliveryRangeKm !== undefined) updates.deliveryRangeKm = Number(deliveryRangeKm);
    if (supportNumber !== undefined) updates.supportNumber = supportNumber.trim();
    if (supportEmail !== undefined) updates.supportEmail = supportEmail.trim().toLowerCase();
    updates.updatedBy = req.admin?._id;

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email role');

    return res.status(200).json(
      successResponse({
        message: 'Settings updated successfully',
        data: { settings },
      })
    );
  } catch (error) {
    next(error);
  }
};
