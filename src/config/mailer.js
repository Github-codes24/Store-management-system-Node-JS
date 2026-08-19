import env from './env.js';

/**
 * Sends an email using the MSG91 v5 Email API.
 * In development, if MSG91 is not configured, it falls back to stub logging.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} [options.toName] - Recipient name
 * @param {string} options.subject - Email subject
 * @param {Object} [options.variables] - Template dynamic placeholders/variables
 * @param {string} options.templateId - Approved MSG91 Template ID
 */
export const sendMail = async ({ to, toName, subject, variables = {}, templateId }) => {
  // Check if MSG91 is configured. Fallback to stub logging if in development/not configured
  if (
    !env.MSG91_AUTH_KEY || 
    env.MSG91_AUTH_KEY === 'dev-auth-key' || 
    !env.MSG91_DOMAIN || 
    env.MSG91_DOMAIN === 'storemanagement.com'
  ) {
    console.log(
      `[MSG91 STUB] Email Logged:\n` +
      `  - To: ${toName ? `${toName} <${to}>` : to}\n` +
      `  - Subject: ${subject}\n` +
      `  - Template ID: ${templateId || 'N/A'}\n` +
      `  - Variables: ${JSON.stringify(variables, null, 2)}`
    );
    return { success: true, stubbed: true };
  }

  if (!templateId) {
    console.error('❌ MSG91 Email Sending Error: Template ID is required.');
    throw new Error('Template ID is required to send emails via MSG91');
  }

  const url = 'https://control.msg91.com/api/v5/email/send';

  const payload = {
    recipients: [
      {
        to: [
          {
            name: toName || to.split('@')[0],
            email: to,
          },
        ],
        variables: {
          subject,
          ...variables,
        },
      },
    ],
    from: {
      name: env.MSG91_SENDER_NAME,
      email: env.MSG91_FROM_EMAIL,
    },
    domain: env.MSG91_DOMAIN,
    template_id: templateId,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: env.MSG91_AUTH_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || result.status === 'error' || result.hasError) {
      console.error('❌ MSG91 API response error:', result);
      throw new Error(result.message || 'Error response received from MSG91 Email API');
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Error executing MSG91 Email send:', error.message);
    throw error;
  }
};

export default sendMail;
