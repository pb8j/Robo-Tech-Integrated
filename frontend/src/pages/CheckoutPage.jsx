// frontend/src/pages/CheckoutPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import '../assets/check.css'; // Your custom CSS for the page layout

// Load Stripe outside of a component’s render to avoid recreating the Stripe object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = ({ totalAmount, orderDetails }) => {
    // ... (rest of CheckoutForm component code)
};

const CheckoutPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedItems, total } = location.state || { selectedItems: [], total: 0 };

    const [clientSecret, setClientSecret] = useState("");
    const [loadingClientSecret, setLoadingClientSecret] = useState(true);
    const [errorClientSecret, setErrorClientSecret] = useState(null);

    useEffect(() => {
        if (total <= 0) {
            navigate('/shop'); // Redirect if no items or total is zero
            return;
        }

        const fetchClientSecret = async () => {
            setLoadingClientSecret(true);
            setErrorClientSecret(null);
            try {
                // Replace with your actual backend endpoint for creating payment intent
                const response = await fetch("/api/payments/create-payment-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: Math.round(total * 100), items: selectedItems }), // Amount in cents
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                setClientSecret(data.clientSecret);
            } catch (error) {
                console.error("Error fetching client secret:", error);
                setErrorClientSecret("Failed to load payment form. Please try again.");
            } finally {
                setLoadingClientSecret(false);
            }
        };

        fetchClientSecret();
    }, [total, selectedItems, navigate]);

    // Stripe appearance configuration to match your theme
    const appearance = {
        theme: 'stripe',
        variables: {
            colorPrimary: '#0066ff', // Directly use hex code for --primary
            colorBackground: '#f8f9fa', // Directly use hex code for --light
            colorText: '#1e1e2c', // Directly use hex code for --dark
            colorDanger: '#dc3545', // Directly use hex code for --danger
            fontFamily: 'Arial, sans-serif', // Match your body font-family from main.css
            spacingUnit: '4px',
            borderRadius: '8px',
        },
        rules: {
            '.Input': {
                boxShadow: 'none',
                borderColor: '#ccc',
            },
            '.Input--invalid': {
                borderColor: '#dc3545', // Directly use hex code for --danger
            },
            '.Label': {
                color: '#1e1e2c', // Directly use hex code for --dark
            },
            '.Button': {
                backgroundColor: '#0066ff', // Directly use hex code for --primary
                color: 'white',
                '&:hover': {
                    backgroundColor: '#0056e6', /* Slightly darker primary on hover */
                },
            },
        },
    };

    if (loadingClientSecret) {
        return (
            <div className="loading-state">
                <p>Loading payment form...</p>
            </div>
        );
    }

    if (errorClientSecret) {
        return (
            <div className="error-state">
                <p>Error: {errorClientSecret}</p>
                <button onClick={() => navigate('/products')} className="btn-primary">
                    Back to Products
                </button>
            </div>
        );
    }

    return (
        <section className="checkout-section">
            <div className="container">
                <h2 className="section-title">Complete Your <span>Order</span></h2>
                <div className="checkout-content-wrapper">
                    <div className="order-summary-card">
                        <h3>Order Summary</h3>
                        {selectedItems.length === 0 ? (
                            <p>No items in order.</p>
                        ) : (
                            <ul className="order-items-list">
                                {selectedItems.map((item, index) => (
                                    <li key={item.name + index}>
                                        <span>{item.name} (x{item.quantity})</span>
                                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="order-total-line">
                            <strong>Total:</strong>
                            <strong>${total.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div className="payment-form-card">
                        <h3>Payment Details</h3>
                        {clientSecret && total > 0 && (
                            <Elements options={{ clientSecret, appearance }} stripe={stripePromise}>
                                <CheckoutForm totalAmount={total} orderDetails={selectedItems} />
                            </Elements>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CheckoutPage;