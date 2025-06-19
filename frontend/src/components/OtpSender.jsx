// frontend/src/components/OtpSender.jsx
import React, { useState } from 'react';

const OtpSender = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendOtp = async () => {
        setMessage(''); // Clear previous messages
        setIsLoading(true); // Show loading state

        if (!email) {
            setMessage('Please enter your email address.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/auth/send-otp-email', { // <-- YOUR BACKEND URL HERE
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message); // e.g., "OTP sent to your email."
            } else {
                setMessage(`Error: ${data.message || 'Failed to send OTP.'}`);
            }
        } catch (error) {
            console.error('Network error sending OTP:', error);
            setMessage('Network error. Could not send OTP.');
        } finally {
            setIsLoading(false); // End loading state
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Send OTP to Email</h2>
            <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                style={{ width: '100%', padding: '10px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <button
                onClick={handleSendOtp}
                disabled={!email || isLoading}
                style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                {isLoading ? 'Sending...' : 'Send OTP'}
            </button>
            {message && <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}
        </div>
    );
};

export default OtpSender;