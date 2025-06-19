// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controller/paymentController');

// Route to create a Payment Intent
router.post('/create-payment-intent', paymentController.createPaymentIntent);

module.exports = router;