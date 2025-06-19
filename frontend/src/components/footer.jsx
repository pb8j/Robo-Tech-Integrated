// frontend/src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaLinkedin, FaYoutube, FaTwitter, FaInstagram } from 'react-icons/fa'; 

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white p-8 mt-auto"> 
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        <div>
          <h3 className="text-xl font-bold mb-4">Robo Tech</h3>
          <p className="text-sm mt-2">
            H R Mahajani Rd, Matunga East, <br />
            Mumbai, Maharashtra 400019, India
          </p>
          
        </div>

        
        <div>
          <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
          <ul>
            <li className="mb-2"><Link to="/about" className="hover:text-blue-300 transition-colors">About Us</Link></li>
            <li className="mb-2"><Link to="/products" className="hover:text-blue-300 transition-colors">Products</Link></li>
            <li className="mb-2"><Link to="/information/case-studies" className="hover:text-blue-300 transition-colors">Case Studies</Link></li>
            <li className="mb-2"><Link to="/contact" className="hover:text-blue-300 transition-colors">Contact Us</Link></li>
          </ul>
        </div>

        {/* Resources (aligned with Information section) */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Resources</h3>
          <ul>
            <li className="mb-2"><Link to="/information/blogs" className="hover:text-blue-300 transition-colors">Blog</Link></li>
            <li className="mb-2"><Link to="/information/deployment-steps" className="hover:text-blue-300 transition-colors">Deployment Steps</Link></li>
            <li className="mb-2"><Link to="/information/why-choose-us" className="hover:text-blue-300 transition-colors">Why Choose Us</Link></li>
            <li className="mb-2"><Link to="/support" className="hover:text-blue-300 transition-colors">Support</Link></li>
          </ul>
        </div>

        {/* Social Media & Newsletter */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Connect With Us</h3>
          <div className="flex space-x-4 mb-4">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors text-2xl">
              <FaLinkedin />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors text-2xl">
              <FaYoutube />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-300 transition-colors text-2xl">
              <FaTwitter />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors text-2xl">
              <FaInstagram />
            </a>
          </div>
          <h3 className="text-lg font-semibold mb-2">Newsletter</h3>
          <p className="text-sm mb-4">Stay updated with our latest innovations.</p>
          <form className="flex">
            <input
              type="email"
              placeholder="Your email"
              className="p-2 rounded-l-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 flex-grow"
            />
            <button
              type="submit"
              className="bg-apexBlue hover:bg-blue-700 text-white p-2 rounded-r-md transition-colors"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm">
        &copy; {new Date().getFullYear()} ROBO TECH. | <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link> | <Link to="/terms-of-service" className="hover:underline">Terms of Service</Link>
      </div>
    </footer>
  );
};

export default Footer;