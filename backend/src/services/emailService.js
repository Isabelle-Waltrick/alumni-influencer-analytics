const transporter = require('../config/email');

const frontendOrigin = () => process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const sendVerificationEmail = async (to, token) => {
  const link = `${frontendOrigin()}/verify-email/${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Verify your Westminster Alumni account',
    html: `<p>Click the link below to verify your email. This link expires in 24 hours.</p>
           <a href="${link}">${link}</a>`,
  });
};

const sendPasswordResetEmail = async (to, token) => {
  const link = `${frontendOrigin()}/reset-password/${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Reset your password',
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
           <a href="${link}">${link}</a>
           <p>If you didn't request this, ignore this email.</p>`,
  });
};

const sendBidResultEmail = async (to, won, date) => {
  const subject = won ? `You won the featured slot for ${date}!` : `Bid result for ${date}`;
  const body = won
    ? `<p>Congratulations! Your bid was the highest and your profile will be featured on ${date}.</p>`
    : `<p>Unfortunately your bid wasn't the highest for ${date}. Better luck next time!</p>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html: body,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendBidResultEmail };
