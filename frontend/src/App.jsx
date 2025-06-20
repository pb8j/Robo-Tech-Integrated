// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/footer';
import HomePage from './pages/HomePage';
import UrdfUploader from './pages/UrdfUploader'; // Adjust path if needed
import ProductsPage from './pages/ProductsPage';
import ControlPanel from './pages/controlPanel'; // Using lowercase 'c'
import ContactUsPage from './pages/ContactUsPage';
import PartnersPage from './pages/PartnersPage';
import InformationPage from './pages/InformationPage';
import WhyChooseUsPage from './pages/WhyChooseUsPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CheckoutPage from './pages/CheckoutPage';
import OtpSender from './components/OtpSender';
import { useAuthContext } from './hooks/useAuthContext'; // Assume this is where AuthContext is consumed
import PhoneCam from './pages/PhoneCam';

function App() {
    const { user, loading } = useAuthContext(); // <-- Destructure loading here

    console.log('--- App.jsx Render Cycle ---');
    console.log('Path:', window.location.pathname);
    console.log('User:', user);
    console.log('Loading:', loading);
    console.log('---------------------------');

    // CRITICAL: Don't render routes until authentication state is known
    if (loading) {
        console.log('App.jsx: Authentication is still loading...');
        return <div>Loading authentication...</div>; // Or a spinner
    }

    // Now, if loading is false and user is null, they aren't logged in.
    // This helps prevent the flicker by waiting for the initial check.
    // If you also want to redirect to / if user is null after loading, you can add:
    // if (!user && window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/') {
    // 	 	console.log('App.jsx: User is null and not loading, redirecting to /login');
    // 	 	return <Navigate to="/login" />;
    // }


    return (
        <Router>
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
                    <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
                    <Route
                        path="/products"
                        element={user ? <ProductsPage /> : <Navigate to="/login" />}
                    />
                    <Route path="/send-otp" element={<OtpSender />} />
                    
                    <Route path="/upload-urdf" element={<UrdfUploader />} /> {/* New Route */}

                    <Route
                        path="/contact"
                        element={user ? <ContactUsPage /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/tools"
                        element={user ? <ControlPanel /> : <Navigate to="/login" />}
                    />
                    <Route
                        // FIX: Changed path from "/phone-camera" to "/phonecam" to match the error in the console.
                        // Alternatively, if you want the path to be "/phone-camera", you would need to ensure
                        // all internal links (e.g., the "Go to Phone Camera Page" button) point to "/phone-camera".
                        // Based on the error "No routes matched location "/phonecam"", it seems your browser
                        // or an internal link is trying to access "/phonecam".
                        path="/phonecam" 
                        element={user ? <PhoneCam /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/partners"
                        element={user ? <PartnersPage /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/information"
                        element={user ? <InformationPage /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/why-choose-us"
                        element={user ? <WhyChooseUsPage /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/checkout"
                        element={user ? <CheckoutPage /> : <Navigate to="/login" />}
                    />
                </Routes>
            </main>
            <Footer />
        </Router>
    );
}
export default App;
