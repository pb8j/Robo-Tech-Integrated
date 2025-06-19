// backend/controllers/emailOtpController.js
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs'); // For hashing, even if we don't store in DB in this simple example

// Configure Nodemailer Transporter (connects to your email service)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // For Gmail. Change if using another service (e.g., 'smtp.sendgrid.net')
    port: 587,              // Standard port for TLS/STARTTLS
    secure: false,          // 'true' for port 465 (SSL), 'false' for other ports (TLS/STARTTLS)
    auth: {
        user: process.env.EMAIL_USER, // Your email from .env
        pass: process.env.EMAIL_PASS, // Your App Password from .env
    },
});

const sendOtpEmail = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required to send OTP.' });

    try {
        const otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });

        // OPTIONAL: You can hash the OTP before saving if you want more security
        await Otp.create({ email, otp });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your One-Time Password (OTP)',
            html: `<p>Your OTP is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`,
        });

        res.status(200).json({ message: 'OTP sent to your email.' });

    } catch (error) {
        console.error('Error sending OTP email:', error);
        res.status(500).json({ message: 'Failed to send OTP email.', error: error.message });
    }
};

const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    try {
        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        // Optional: mark user as verified in DB if this is tied to user accounts
        // await User.updateOne({ email }, { isVerified: true });

        // Delete OTP after successful verification
        await Otp.deleteMany({ email });

        res.status(200).json({ message: 'OTP verified successfully.' });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'OTP verification failed.', error: error.message });
    }
};

module.exports = { sendOtpEmail, verifyOtp };


