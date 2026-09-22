import CmsPage from '../../models/cmsPage.model.js';
import Settings from '../../models/settings.model.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, notFound } from '../../utils/api-error.js';

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
 * Get Help & Support Contact Details for Customer App
 * GET /api/customer/cms/support
 */
export const getCustomerSupportInfo = async (_req, res, next) => {
  try {
    let settings = await Settings.findOne().lean();
    if (!settings) {
      settings = {
        supportNumber: '+91 9876543210',
        supportEmail: 'support@companyname.com',
        supportTitle: "We're here to help!",
        supportSubtitle: 'Contact us using the options below.',
      };
    }

    const cleanNumber = (settings.supportNumber || '+91 9876543210').replace(/\s+/g, '');

    return res.status(200).json(
      successResponse({
        message: 'Support contact information retrieved successfully',
        data: {
          title: settings.supportTitle || "We're here to help!",
          subtitle: settings.supportSubtitle || 'Contact us using the options below.',
          supportNumber: settings.supportNumber || '+91 9876543210',
          supportEmail: settings.supportEmail || 'support@companyname.com',
          callActionUrl: `tel:${cleanNumber}`,
          emailActionUrl: `mailto:${settings.supportEmail || 'support@companyname.com'}`,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get CMS Page Content (Terms & Conditions, Privacy Policy) for Customer App
 * GET /api/customer/cms/:slug
 */
export const getCustomerCmsPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const cleanSlug = (slug || '').toLowerCase().trim();

    if (!cleanSlug) {
      return next(badRequest('Page slug is required.'));
    }

    let page = await CmsPage.findOne({ slug: cleanSlug }).lean();

    if (!page) {
      const template = defaultCmsTemplates[cleanSlug];
      if (!template) {
        return next(notFound('Page content not found.'));
      }

      page = await CmsPage.create({
        slug: cleanSlug,
        title: template.title,
        effectiveDate: template.effectiveDate,
        content: template.content,
      });
    }

    return res.status(200).json(
      successResponse({
        message: `${page.title} retrieved successfully`,
        data: {
          slug: page.slug,
          title: page.title,
          effectiveDate: page.effectiveDate || '1st September, 2026',
          content: page.content,
          updatedAt: page.updatedAt,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
