// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
// Assuming you have other routes/controllers like signup, login etc.
// const { signup, login } = require('../controllers/authController');

const { sendOtpEmail, verifyOtp } = require('../controller/emailOtpController');

router.post('/send-otp-email', sendOtpEmail);
router.post('/verify-otp', verifyOtp);

module.exports = router;