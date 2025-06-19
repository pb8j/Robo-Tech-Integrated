// backend/controllers/paymentController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async (req, res) => {
  const { amount } = req.body; // Amount should be in the smallest currency unit (e.g., cents for USD)

  // Basic validation
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount provided.' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents (or smallest currency unit)
      currency: 'usd', // Change this to your desired currency (e.g., 'inr' for Indian Rupees)
      metadata: { integration_check: 'accept_a_payment' }, // Optional: useful for tracking
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPaymentIntent,
};