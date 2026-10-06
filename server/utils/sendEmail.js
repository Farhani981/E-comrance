import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const emailPassword = process.env.EMAIL_PASS?.replace(/\s+/g, '');

const allowInsecureTls = process.env.SMTP_ALLOW_INVALID_CERT === 'true' || 
  (process.env.NODE_ENV !== 'production' && process.env.SMTP_ALLOW_INVALID_CERT !== 'false');

// ✅ Configurable Secure SMTP Configuration
const transporter = process.env.EMAIL_USER && emailPassword
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: emailPassword,
      },
      tls: {
        rejectUnauthorized: !allowInsecureTls,
      },
    })
  : null;

export const verifyEmailTransport = async () => {
  if (!transporter) {
    console.warn('Email notifications disabled: EMAIL_USER or EMAIL_PASS is missing.');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ Email SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ Email SMTP verification failed:', error.message);
    return false;
  }
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const sendOrderStatusEmail = async (
  toEmail,
  customerName,
  orderId,
  newStatus,
  items,
  totalAmount,
  trackingNumber = '',
  trackingLink = '',
  shippingDetails = {}
) => {
  const recipientEmail = String(toEmail || '').trim().toLowerCase();
  if (!transporter || !recipientEmail) {
    console.warn('Order status email skipped: email credentials or recipient is missing.');
    return;
  }

  const safeItems = Array.isArray(items) ? items : [];
  const itemsListHtml = safeItems.map((item) => `
    <tr>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e3e8f2; color: #4b5790; font-size: 13px;">
        ${escapeHtml(item.product_name || item.title || 'Product')}
      </td>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e3e8f2; color: #4b5790; font-size: 13px; text-align: center;">
        ${escapeHtml(item.quantity || 1)}
      </td>
      <td style="padding: 14px 12px; border-bottom: 1px solid #e3e8f2; color: #4b5790; font-size: 13px; text-align: right;">
        Rs. ${escapeHtml(item.price || 0)}
      </td>
    </tr>
  `).join('');
  
  const itemsText = safeItems
    .map((item) => `${item.product_name || item.title || 'Product'} x ${item.quantity || 1} - Rs. ${item.price || 0}`)
    .join('\n');

  const safeTrackingLink = escapeHtml(trackingLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders`);
  const logoHtml = '<div style="color:#ffffff; font-size:28px; font-weight:700; letter-spacing:1px;">ShopHub</div>';
  
  const plainText = [
    `ShopHub delivery update for order #${orderId}`,
    '',
    `Hello ${customerName},`,
    `Your order status is now: ${newStatus}.`,
    '',
    `Shipping details:`,
    `Name: ${shippingDetails.name || customerName}`,
    `Email: ${recipientEmail}`,
    `Phone: ${shippingDetails.phone || 'N/A'}`,
    `Address: ${shippingDetails.address || 'N/A'}${shippingDetails.city ? `, ${shippingDetails.city}` : ''}`,
    '',
    'Items:',
    itemsText || 'No items listed',
    `Total: Rs. ${totalAmount}`,
    '',
    `Track your order: ${trackingLink || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders`}`,
    '',
    'Thank you for shopping with ShopHub.',
  ].join('\n');

  // ✅ FIX 2: Clean Headers & Professional Mail Options
  const mailOptions = {
    from: `"ShopHub Customer Care" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `ShopHub Order Status Update - #${orderId}`,
    text: plainText,
    headers: {
      'X-Mailer': 'ShopHub Express Service',
      'X-Priority': '3',
    },
    html: `
      <div style="margin:0; padding:28px 10px; background:#f3f5f8; font-family:Arial,Helvetica,sans-serif; color:#252b55;">
        <div style="max-width:620px; margin:0 auto; background:#ffffff;">
          <div style="padding:25px 20px; text-align:center; background:#252653;">
            ${logoHtml}
          </div>
          <div style="padding:34px 28px 20px; text-align:center;">
            <h1 style="margin:0; color:#454b91; font-size:30px; line-height:1.2;">Delivery Note</h1>
            <p style="margin:12px 0 0; color:#68729e; font-size:15px;">Your ShopHub order has been updated.</p>
          </div>
          <div style="padding:24px 28px 28px; background:#eef3f9;">
            <h2 style="margin:0 0 14px; color:#252b55; font-size:19px;">Shipping Details:</h2>
            <p style="margin:7px 0; font-size:13px;">Order Number: <strong>${escapeHtml(orderId)}</strong></p>
            <p style="margin:7px 0; font-size:13px;">Delivered to: <strong>${escapeHtml(shippingDetails.name || customerName)}</strong></p>
            <p style="margin:7px 0; font-size:13px;">Email: <strong>${escapeHtml(recipientEmail)}</strong></p>
            <p style="margin:7px 0; font-size:13px;">Phone: <strong>${escapeHtml(shippingDetails.phone || 'N/A')}</strong></p>
            <p style="margin:7px 0 18px; font-size:13px;">Address: <strong>${escapeHtml(shippingDetails.address || 'N/A')}${shippingDetails.city ? `, ${escapeHtml(shippingDetails.city)}` : ''}</strong></p>
            <p style="margin:7px 0; font-size:13px;">Order Status: <strong style="color:#454b91;">${escapeHtml(newStatus)}</strong></p>
            ${trackingNumber ? `<p style="margin:7px 0 18px; font-size:13px;">Tracking Number: <strong>${escapeHtml(trackingNumber)}</strong></p>` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; background:#ffffff;">
              <thead>
                <tr style="background:#6d75b4; color:#ffffff;">
                  <th style="padding:12px; text-align:left; font-size:12px;">Description</th>
                  <th style="padding:12px; text-align:center; font-size:12px;">Quantity</th>
                  <th style="padding:12px; text-align:right; font-size:12px;">Price</th>
                </tr>
              </thead>
              <tbody>${itemsListHtml}</tbody>
            </table>
            <div style="padding:18px 12px 0; text-align:right; color:#454b91; font-size:16px;">
              <strong>TOTAL: Rs. ${escapeHtml(totalAmount)}</strong>
            </div>
          </div>
          <div style="padding:26px 28px; background:#ffffff;">
            <h2 style="margin:0 0 10px; color:#252b55; font-size:19px;">Track Your Order</h2>
            <p style="margin:0 0 18px; color:#59627e; font-size:14px; line-height:1.6;">View the latest delivery status and order details on our website.</p>
            <a href="${safeTrackingLink}" style="display:inline-block; padding:13px 28px; background:#6d75b4; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px;">Track Order</a>
            <h2 style="margin:28px 0 10px; color:#252b55; font-size:19px;">Terms &amp; Conditions:</h2>
            <p style="margin:0; color:#59627e; font-size:13px; line-height:1.7;">Please keep your order number for future reference. Delivery times may vary depending on your location and courier availability.</p>
          </div>
          <div style="padding:30px 20px; text-align:center; background:#252653; color:#ffffff;">
            <p style="margin:0 0 16px; font-size:20px;">Thank You for shopping with us!</p>
            <p style="margin:0; color:#d8dbf0; font-size:12px;">If you have any questions, please contact our support team.</p>
            <p style="margin:12px 0 0; color:#d8dbf0; font-size:12px;">ShopHub &copy; ${new Date().getFullYear()} &middot; All Rights Reserved</p>
          </div>
        </div>
      </div>
    `,
  };

  const deliveryInfo = await transporter.sendMail(mailOptions);
  console.log(
    `✅ Order email accepted by SMTP: order=${orderId}, recipient=${recipientEmail}, messageId=${deliveryInfo.messageId}`
  );
};

export const sendContactReplyEmail = async ({
  toEmail,
  customerName = 'Customer',
  subject,
  replyMessage,
  originalMessage = '',
}) => {
  const recipientEmail = String(toEmail || '').trim().toLowerCase();
  if (!transporter || !recipientEmail) {
    console.warn('Contact reply email skipped: email transporter or recipient is missing.');
    return { success: false, reason: 'transporter_not_configured' };
  }

  const safeSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  const mailOptions = {
    from: `"ShopHub Customer Support" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: safeSubject,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">ShopHub Support</h1>
            <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Customer Care Team</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 15px; margin: 0 0 16px;">Dear <strong>${escapeHtml(customerName)}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.7; color: #334155; margin: 0 0 24px;">Thank you for contacting ShopHub. Here is our response to your inquiry regarding <strong>${escapeHtml(subject)}</strong>:</p>
            
            <div style="background: #f1f5f9; border-left: 4px solid #0ea5e9; padding: 18px 20px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #0f172a; white-space: pre-wrap; margin-bottom: 24px;">${escapeHtml(replyMessage)}</div>

            ${originalMessage ? `
              <div style="border-top: 1px dashed #cbd5e1; padding-top: 20px; margin-top: 20px;">
                <p style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; margin: 0 0 8px;">Your Original Message:</p>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #64748b; font-style: italic; white-space: pre-wrap;">${escapeHtml(originalMessage)}</div>
              </div>
            ` : ''}

            <p style="font-size: 13px; color: #64748b; margin: 28px 0 0; line-height: 1.5;">If you have any further questions or require additional assistance, feel free to reply directly to this email or reach out via our contact page.</p>
          </div>
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">ShopHub &copy; ${new Date().getFullYear()} &middot; Support &amp; Customer Care</p>
          </div>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Support reply email sent to ${recipientEmail}: messageId=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('⚠️ Failed to send support reply email:', err.message);
    return { success: false, error: err.message };
  }
};