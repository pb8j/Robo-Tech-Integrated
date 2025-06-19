import React from 'react';
import { useParams, Link } from 'react-router-dom';

const ProductDetailPage = () => {
  const { productId } = useParams();

  // Product data
  const product = {
    id: productId,
    name: `RoboTech Model ${productId}`,
    description: `The RoboTech Model ${productId} represents the cutting edge of industrial robotics technology. Designed for precision and durability, this model features our latest AI integration and modular components that allow for complete customization to your specific operational requirements.`,
    price: `₹${(1000000 + (parseInt(productId) * 100000)).toLocaleString()}`,
    imageUrl: `https://via.placeholder.com/800x600/1a237e/ffffff?text=RoboTech+${productId}`,
    details: [
      'Advanced Neural Network Processing',
      'Military-Grade Titanium Alloy Frame',
      'Modular Component System',
      '360° Environmental Sensors',
      'Self-Diagnostic Maintenance System',
      '24/7 Remote Monitoring Capability'
    ],
    specs: {
      weight: '145 kg',
      dimensions: '1.8m × 0.9m × 0.6m',
      power: '2.4 kW',
      payload: '25 kg',
      repeatability: '±0.02 mm'
    }
  };

  return (
    <div className="robot-product-detail bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4">
        <Link 
          to="/products" 
          className="inline-flex items-center text-robotLight hover:text-robotDark mb-6 transition"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Products
        </Link>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Product Image */}
            <div className="lg:w-1/2 bg-gray-100 p-8 flex items-center justify-center">
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-auto max-h-96 object-contain"
              />
            </div>

            {/* Product Info */}
            <div className="lg:w-1/2 p-8">
              <h1 className="text-3xl font-bold text-robotDark mb-2">{product.name}</h1>
              <p className="text-gray-600 mb-6">{product.description}</p>
              
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-robotDark mb-3">Key Features</h3>
                <ul className="space-y-2">
                  {product.details.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-robotLight mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Specifications */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-robotDark mb-3">Technical Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">{key}</div>
                      <div className="font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price and CTA */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-2xl font-bold text-robotDark">{product.price}</span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    In Stock
                  </span>
                </div>
                <button className="w-full bg-robotLight hover:bg-robotAccent text-white py-4 rounded-lg font-bold text-lg transition">
                  Request a Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;