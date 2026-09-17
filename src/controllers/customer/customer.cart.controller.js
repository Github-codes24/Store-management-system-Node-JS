
import Cart from '../../models/cart.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { formatCustomerProduct } from './customer.product.controller.js';

/**
 * Format Cart Payload for Customer App
 */
export const buildCartPayload = async (customerId) => {
  const customer = await Customer.findById(customerId).select('name phone address addresses currentLocation');

  let cart = await Cart.findOne({ customer: customerId })
    .populate({
      path: 'items.product',
      populate: [
        { path: 'brand', select: 'name' },
        { path: 'unit', select: 'name shortName' },
      ],
    })
    .lean();

  if (!cart) {
    cart = { customer: customerId, items: [] };
  }

  const deliverToAddress = customer?.currentLocation || (customer?.addresses?.[0] || null);
  const deliverTo = deliverToAddress
    ? {
        addressId: deliverToAddress._id,
        name: customer.name || 'Customer',
        formattedAddress: deliverToAddress.formattedAddress || customer.address || '',
        phone: customer.phone || '',
        addressType: deliverToAddress.addressType || 'Home',
      }
    : {
        addressId: null,
        name: customer?.name || 'Customer',
        formattedAddress: customer?.address || '',
        phone: customer?.phone || '',
        addressType: 'Home',
      };

  let totalItemsCount = 0;
  let totalMrp = 0;
  let totalAmount = 0;

  const items = (cart.items || []).map((cartItem) => {
    const rawProd = cartItem.product;
    if (!rawProd) return null;

    const formattedProd = formatCustomerProduct(rawProd);
    const qty = Number(cartItem.quantity || 1);
    const mrp = Number(formattedProd.mrp || 0);
    const onlinePrice = Number(formattedProd.onlineSellingPrice || 0);

    const itemTotalMrp = mrp * qty;
    const itemTotalOnlinePrice = onlinePrice * qty;

    totalItemsCount += qty;
    totalMrp += itemTotalMrp;
    totalAmount += itemTotalOnlinePrice;

    let variantSubtitle = '';
    if (cartItem.selectedVariant) {
      if (typeof cartItem.selectedVariant === 'string') {
        variantSubtitle = cartItem.selectedVariant;
      } else if (typeof cartItem.selectedVariant === 'object') {
        variantSubtitle = Object.entries(cartItem.selectedVariant)
          .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
          .join(', ');
      }
    } else if (formattedProd.attributes && formattedProd.attributes.length > 0) {
      const firstAttr = formattedProd.attributes[0];
      if (firstAttr && firstAttr.value) {
        variantSubtitle = `${firstAttr.displayLabel || firstAttr.attributeKey}: ${
          typeof firstAttr.value === 'object' ? firstAttr.value.name || firstAttr.value.label : firstAttr.value
        }`;
      }
    }

    return {
      cartItemId: cartItem._id,
      productId: formattedProd._id,
      productName: formattedProd.productName,
      productImage: formattedProd.productImage,
      variantSubtitle: variantSubtitle || (formattedProd.unit?.name ? `${formattedProd.unit.name}` : ''),
      mrp,
      onlineSellingPrice: onlinePrice,
      discountPercentage: formattedProd.discountPercentage,
      discountTag: formattedProd.discountTag,
      quantity: qty,
      itemTotalMrp,
      itemTotalOnlinePrice,
      stockQuantity: formattedProd.stockQuantity,
      selectedVariant: cartItem.selectedVariant || null,
    };
  }).filter(Boolean);

  const totalDiscount = Math.max(0, totalMrp - totalAmount);
  const savingsBannerText = totalDiscount > 0 ? `You will save ₹ ${totalDiscount.toLocaleString('en-IN')} on this order` : null;

  return {
    deliverTo,
    items,
    summary: {
      totalItemsCount: items.length,
      totalQuantity: totalItemsCount,
      totalMrp,
      totalDiscount,
      totalAmount,
      savingsBannerText,
    },
  };
};

/**
 * Get Customer Cart Details
 * GET /api/customer/cart
 */
export const getCart = async (req, res, next) => {
  try {
    const payload = await buildCartPayload(req.customer._id);

    return res.status(200).json(
      successResponse({
        message: 'Cart details retrieved successfully',
        data: payload,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Add Item to Customer Cart
 * POST /api/customer/cart/add
 */
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, selectedVariant = null, productModel = 'AdminProduct' } = req.body;

    if (!productId) {
      return next(badRequest('Product ID is required'));
    }

    let prod = await AdminProduct.findOne({ _id: productId, isDeleted: false, status: 'active' });
    let resolvedModel = 'AdminProduct';

    if (!prod) {
      prod = await StoreProduct.findOne({ _id: productId, isDeleted: false, status: 'active' });
      resolvedModel = 'StoreProduct';
    }

    if (!prod) {
      return next(notFound('Product not found or unavailable'));
    }

    let cart = await Cart.findOne({ customer: req.customer._id });
    if (!cart) {
      cart = new Cart({ customer: req.customer._id, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    const addQty = Math.max(1, Number(quantity));

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += addQty;
      if (selectedVariant) {
        cart.items[existingIndex].selectedVariant = selectedVariant;
      }
    } else {
      cart.items.push({
        product: productId,
        productModel: resolvedModel,
        quantity: addQty,
        selectedVariant,
      });
    }

    await cart.save();

    const payload = await buildCartPayload(req.customer._id);

    return res.status(200).json(
      successResponse({
        message: 'Item added to cart successfully',
        data: payload,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Cart Item Quantity
 * PUT /api/customer/cart/update-quantity
 */
export const updateCartQuantity = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId) {
      return next(badRequest('Product ID is required'));
    }

    const cart = await Cart.findOne({ customer: req.customer._id });
    if (!cart) {
      return next(notFound('Cart is empty'));
    }

    const targetIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (targetIndex === -1) {
      return next(notFound('Item not found in cart'));
    }

    const newQty = Number(quantity);
    if (newQty <= 0) {
      cart.items.splice(targetIndex, 1);
    } else {
      cart.items[targetIndex].quantity = newQty;
    }

    await cart.save();

    const payload = await buildCartPayload(req.customer._id);

    return res.status(200).json(
      successResponse({
        message: 'Cart quantity updated successfully',
        data: payload,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Remove Item from Cart
 * DELETE /api/customer/cart/remove/:productId
 */
export const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ customer: req.customer._id });
    if (cart && Array.isArray(cart.items)) {
      cart.items = cart.items.filter((item) => item.product.toString() !== productId.toString());
      await cart.save();
    }

    const payload = await buildCartPayload(req.customer._id);

    return res.status(200).json(
      successResponse({
        message: 'Item removed from cart successfully',
        data: payload,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Clear Customer Cart
 * DELETE /api/customer/cart/clear
 */
export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ customer: req.customer._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    const payload = await buildCartPayload(req.customer._id);

    return res.status(200).json(
      successResponse({
        message: 'Cart cleared successfully',
        data: payload,
      })
    );
  } catch (error) {
    next(error);
  }
};
