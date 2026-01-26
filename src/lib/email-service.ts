import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
});

const getBaseHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { background-color: #000000; padding: 24px; text-align: center; }
        .logo { color: #ffffff; font-size: 24px; font-weight: 700; text-decoration: none; letter-spacing: 0.05em; }
        .content { padding: 40px 32px; text-align: center; }
        .button { display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; transition: background-color 0.2s; }
        .button:hover { background-color: #222222; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        h2 { color: #111827; margin-bottom: 16px; font-size: 24px; }
        p { margin-bottom: 16px; font-size: 16px; color: #4b5563; }
        .divider { border-top: 1px solid #e5e7eb; margin: 32px 0; }
        .link-text { color: #6b7280; font-size: 13px; word-break: break-all; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="logo">CHAPAL</a>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} CHAPAL. All rights reserved.</p>
            <p>If you have any questions, reply to this email.</p>
        </div>
    </div>
</body>
</html>
`;

export const sendVerificationEmail = async (email: string, url: string) => {
  const html = getBaseHtml(`
        <h2 style="margin-top: 0;">Verify your email</h2>
        <p>Thanks for signing up for CHAPAL! Please click the button below to verify your email address.</p>
        <div style="text-align: center;">
            <a href="${url}" class="button">Verify Email</a>
        </div>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
            If you didn't create an account, you can safely ignore this email.
        </p>
    `);

  try {
    console.log(
      `[Email Service] Attempting to send verification email to ${email}`,
    );
    await transporter.sendMail({
      from: `"CHAPAL" <${process.env.BREVO_USER}>`,
      to: email,
      subject: 'Verify your email address',
      html,
    });
    console.log(
      `[Email Service] Verification email sent successfully to ${email}`,
    );
  } catch (error) {
    console.error('[Email Service] FAILED to send verification email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, url: string) => {
  const html = getBaseHtml(`
        <h2 style="margin-top: 0;">Reset your password</h2>
        <p>We received a request to reset your password. Click the button below to create a new one.</p>
        <div style="text-align: center;">
            <a href="${url}" class="button">Reset Password</a>
        </div>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
            If you didn't request a password reset, you can safely ignore this email.
        </p>
    `);

  try {
    console.log(
      `[Email Service] Attempting to send password reset email to ${email}`,
    );
    await transporter.sendMail({
      from: `"CHAPAL" <${process.env.BREVO_USER}>`,
      to: email,
      subject: 'Reset your password',
      html,
    });
    console.log(
      `[Email Service] Password reset email sent successfully to ${email}`,
    );
  } catch (error) {
    console.error(
      '[Email Service] FAILED to send password reset email:',
      error,
    );
    throw error;
  }
};
