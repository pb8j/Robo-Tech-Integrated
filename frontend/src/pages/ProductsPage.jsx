// frontend/src/pages/ProductsPage.jsx
import React, { useState, useEffect } from 'react'; // Added useEffect
import { Link, useNavigate } from 'react-router-dom';
import '../assets/prod.css'

// Import your images from the src/assets folder
// Make sure these filenames and paths match your actual files
import industrialRobotImg from '../assets/product-1.jpg';   // For 'Industrial Robots'
import homeAssistantImg from '../assets/product-2.jpg';     // For 'Home Assistants'
import researchBotImg from '../assets/product-3.jpg';     // For 'Research & Development Bots'
import droneImg from '../assets/product-4.jpg';           // <--- IMPORTANT: Verify this filename in src/assets/
import humanoidRobotImg from '../assets/product-5.jpg';   // <--- IMPORTANT: Verify this filename in src/assets/
import medicalRobotImg from '../assets/product-6.jpg';     // <--- IMPORTANT: Verify this filename in src/assets/


// Make sure your CSS is linked. If using import, put it here too:
// import '../styles/ShopPage.css'; // Adjust path if needed

const ProductsPage = () => {
    const navigate = useNavigate();

    const [selectedItems, setSelectedItems] = useState([]);
    const [isCartModalOpen, setIsCartModalOpen] = useState(false); // State for modal visibility

    const addItemToCart = (product) => {
        const existingItemIndex = selectedItems.findIndex(item => item.name === product.name);

        if (existingItemIndex > -1) {
            const updatedItems = [...selectedItems];
            updatedItems[existingItemIndex] = {
                ...updatedItems[existingItemIndex],
                quantity: (updatedItems[existingItemIndex].quantity || 1) + 1
            };
            setSelectedItems(updatedItems);
        } else {
            setSelectedItems([...selectedItems, { ...product, quantity: 1 }]);
        }
    };

    const removeItemFromCart = (productName) => {
        // Close modal if the last item is removed from the cart
        if (selectedItems.length === 1 && selectedItems[0].name === productName) {
            closeCartModal();
        }
        setSelectedItems(selectedItems.filter(item => item.name !== productName));
    };

    const productCategories = [
        {
            name: 'Industrial Robots',
            description: 'Automated arms for manufacturing and assembly.',
            image: industrialRobotImg, // Using the imported variable
            price: 150000.00,
            id: 'industrial-robots'
        },
        {
            name: 'Home Assistants',
            description: 'AI-powered robots for daily household tasks and companionship.',
            image: homeAssistantImg, // Using the imported variable
            price: 5000.00,
            id: 'home-assistants'
        },
        {
            name: 'Research & Development Bots',
            description: 'Advanced, programmable robots for scientific exploration.',
            image: researchBotImg, // Using the imported variable
            price: 75000.00,
            id: 'research-bots'
        },
        {
            name: 'Drones',
            description: 'Aerial robots for surveillance, delivery, and photography.',
            image: droneImg, // Using the imported variable
            price: 2500.00,
            id: 'drones'
        },
        {
            name: 'Humanoid Robots',
            description: 'Bipedal robots designed for complex human-like interactions.',
            image: humanoidRobotImg, // Using the imported variable
            price: 500000.00,
            id: 'humanoid-robots'
        },
        {
            name: 'Medical Robots',
            description: 'Precision robots for surgical assistance and patient care.',
            image: medicalRobotImg, // Using the imported variable
            price: 300000.00,
            id: 'medical-robots'
        },
    ];

    const calculateTotal = () => {
        return selectedItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
    };

    const totalItemsInCart = selectedItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    const handleCheckout = () => {
        navigate('/checkout', { state: { selectedItems, total: calculateTotal() } });
    };

    // Functions to control modal visibility
    const openCartModal = () => {
        setIsCartModalOpen(true);
    };

    const closeCartModal = () => {
        setIsCartModalOpen(false);
    };

    // Effect to handle closing modal when clicking outside (optional, but good UX)
    useEffect(() => {
        const handleClickOutside = (event) => {
            const modalContent = document.querySelector('.modal-content');
            const modalOverlay = document.getElementById('cartModal');

            // Check if the modal is open, if the click is on the overlay, but not inside the content
            if (isCartModalOpen && modalOverlay && modalContent && !modalContent.contains(event.target) && modalOverlay.contains(event.target)) {
                closeCartModal();
            }
        };

        if (isCartModalOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCartModalOpen]);


    return (
        <div className="product-page-wrapper">
            <section className="product-listing">
                <div className="container">
                    <h2 className="section-title">Explore Our <span>Products</span></h2>

                    <div className="product-grid">
                        {productCategories.map((product) => (
                            <div key={product.id} className="product-card">
                                {/* Use the imported image variable here as the src */}
                                <img src={product.image} alt={product.name} />
                                <div className="product-content">
                                    <h3>{product.name}</h3>
                                    <p>{product.description}</p>
                                    <p className="product-price">${product.price.toFixed(2)}</p>
                                    <button onClick={() => addItemToCart(product)} className="btn-primary add-to-cart-btn">
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Floating Cart Summary - only show if items are in cart */}
            {totalItemsInCart > 0 && (
                <div className="cart-summary-floating">
                    <p>{totalItemsInCart} items in cart | Total: ${calculateTotal().toFixed(2)}</p>
                    <button onClick={handleCheckout} className="btn-primary checkout-btn">
                        Checkout
                    </button>
                </div>
            )}

            {/* Cart Modal - visibility controlled by isCartModalOpen state */}
            <div id="cartModal" className="modal" style={{ display: isCartModalOpen ? 'flex' : 'none' }}>
                <div className="modal-content">
                    {/* Close button with onClick handler linked to state */}
                    <span className="close-cart-modal" onClick={closeCartModal}>&times;</span>
                    <h2>Your Cart</h2>
                    {selectedItems.length === 0 ? (
                        <p>Your cart is empty.</p>
                    ) : (
                        <div className="cart-items-list">
                            {selectedItems.map((item, index) => (
                                <div key={item.name + index} className="cart-item">
                                    <div>
                                        <p className="item-name">{item.name}</p>
                                        <p className="item-details">${item.price.toFixed(2)} {item.quantity > 1 && `(x${item.quantity})`}</p>
                                    </div>
                                    <button
                                        onClick={() => removeItemFromCart(item.name)}
                                        className="remove-item-btn"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {selectedItems.length > 0 && (
                        <div className="cart-total-section">
                            <p>Total: <span className="total-amount">${calculateTotal().toFixed(2)}</span></p>
                            <button onClick={handleCheckout} className="btn-primary checkout-modal-btn">
                                Proceed to Checkout
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* Cart Icon Button to open modal - always visible */}
            <button className="cart-icon-btn" onClick={openCartModal}>
                <i className="fas fa-shopping-cart"></i> ({totalItemsInCart})
            </button>
        </div>
    );
};

export default ProductsPage;