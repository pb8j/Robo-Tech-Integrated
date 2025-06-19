import React from 'react';
import { Link } from 'react-router-dom';
import '../assets/tools.css'; // Make sure this CSS file exists and is imported

const ToolsPage = () => {
    // Use your deployed Render.com URL as the base URL for the Flask app
    const FLASK_APP_BASE_URL = 'https://remote-character-control.onrender.com';

    return (
        <div className="tools-page-container">
            <section className="tools-hero-section">
                <div className="container">
                    <h2 className="section-title">Our Interactive <span>Tools</span></h2>
                    <p className="section-description">
                        Explore our experimental robotics control interfaces.
                    </p>
                </div>
            </section>

            <section className="tools-list-section">
                <div className="container">
                    <div className="tools-grid">
                        <div className="tool-card">
                            <h3>Robot Control Panel (Laptop)</h3>
                            <p>Access the main control interface to move the character and view the mobile camera feed.</p>
                            <a
                                href={`${FLASK_APP_BASE_URL}`} // Direct link to the base URL for PC control
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary tool-link"
                            >
                                Open Control Panel
                            </a>
                        </div>

                        <div className="tool-card">
                            <h3>Mobile Camera View (Phone)</h3>
                            <p>Open this link on your mobile device to display the character and stream its camera.</p>
                            <a
                                href={`${FLASK_APP_BASE_URL}/mobile`} // Direct link to the /mobile endpoint for phones
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary tool-link"
                            >
                                Open Mobile View
                            </a>
                            <p className="note">**Important:** Open this link on your actual mobile phone's browser for camera functionality.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ToolsPage;