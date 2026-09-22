import CmsPage from '../../models/cmsPage.model.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest } from '../../utils/api-error.js';

const defaultCmsTemplates = {
  'terms-and-conditions': {
    title: 'Terms & Conditions',
    effectiveDate: '1st September, 2026',
    content: `<p><strong>Effective Date: 1st September, 2026</strong></p><p>Welcome to ApnaMart ("we," "our," "us"). By accessing or using our mobile application ("App") and related services, you agree to comply with and be bound by the following Terms and Conditions ("Terms"). Please read them carefully before using our Service.</p><h3>1. Eligibility</h3><ul><li>You must be 18 years or older to register and use this App.</li><li>By creating an account, you confirm that you are legally competent to enter into a binding contract.</li></ul><h3>2. Account Registration</h3><ul><li>You must provide accurate, complete, and current information during registration.</li><li>You are responsible for maintaining the confidentiality of your account credentials.</li></ul><h3>3. User Obligations</h3><ul><li>You will use the App for lawful commercial and personal shopping purposes only.</li><li>You will not impersonate any person or entity or attempt unauthorized access.</li></ul><h3>4. Content & Privacy</h3><ul><li>Personal data is collected and processed according to our Privacy Policy.</li></ul>`,
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    effectiveDate: '1st September, 2026',
    content: `<p><strong>Effective Date: 1st September, 2026</strong></p><p>Welcome to ApnaMart. We value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit or use our mobile application and related services.</p><h3>1. Information We Collect</h3><ul><li>Personal information such as name, email address, phone number, and delivery address.</li><li>Order history, transaction details, and location data to route orders to nearby stores.</li></ul><h3>2. How We Use Your Information</h3><ul><li>To process and deliver your orders efficiently.</li><li>To provide customer support and improve our service offerings.</li></ul><h3>3. Data Protection</h3><ul><li>We implement secure encryption and strict access controls to safeguard your data.</li></ul>`,
  },
};

/**
 * Get CMS Page Details (Admin)
 * GET /api/admin/cms/:slug
 */
export const getCmsPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cleanSlug = (slug || '').toLowerCase().trim();

    if (!cleanSlug) {
      return next(badRequest('CMS page slug is required.'));
    }

    let page = await CmsPage.findOne({ slug: cleanSlug }).populate('updatedBy', 'name email role');

    if (!page) {
      const template = defaultCmsTemplates[cleanSlug] || {
        title: cleanSlug.replace(/-/g, ' ').toUpperCase(),
        effectiveDate: '1st September, 2026',
        content: '<p>Content coming soon...</p>',
      };

      page = await CmsPage.create({
        slug: cleanSlug,
        title: template.title,
        effectiveDate: template.effectiveDate,
        content: template.content,
      });
    }

    return res.status(200).json(
      successResponse({
        message: 'CMS page retrieved successfully',
        data: { page },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update CMS Page Content (Admin)
 * PUT /api/admin/cms/:slug
 */
export const updateCmsPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { title, effectiveDate, content } = req.body;
    const cleanSlug = (slug || '').toLowerCase().trim();

    if (!cleanSlug) {
      return next(badRequest('CMS page slug is required.'));
    }

    if (content === undefined || content === null) {
      return next(badRequest('Content is required.'));
    }

    const updates = {
      content: String(content),
      updatedBy: req.admin?._id || null,
    };

    if (title !== undefined) updates.title = String(title).trim();
    if (effectiveDate !== undefined) updates.effectiveDate = String(effectiveDate).trim();

    const page = await CmsPage.findOneAndUpdate(
      { slug: cleanSlug },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email role');

    return res.status(200).json(
      successResponse({
        message: `${page.title} updated successfully`,
        data: { page },
      })
    );
  } catch (error) {
    next(error);
  }
};
