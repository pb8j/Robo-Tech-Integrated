import React from 'react';
import { Link } from 'react-router-dom';
import Slider from 'react-slick';

import Robot1Image from '../assets/robot-1.jpg';
import Robot2Image from '../assets/robot-2.jpg';
import Robot3Image from '../assets/robot-3.jpg';


const HomePage = () => {
  // Hero carousel settings
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
  };

  // Blog data
  const blogs = [
    {
      title: "Robotics in Modern Healthcare",
      excerpt: "How ideas are transforming medical procedures, about future",
      image: "https://imgs.search.brave.com/VbSm6qwXdPbPb1YF95erJwVz0UK2lXydajWlPY5SqD8/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5pc3RvY2twaG90/by5jb20vaWQvOTIw/NzQzMDQ2L3Bob3Rv/L3JvYm90cy1jYWxs/LWNlbnRlci5qcGc_/cz02MTJ4NjEyJnc9/MCZrPTIwJmM9ZmRs/azhmOV9jWXEzSDAw/eEtUVTY3bnVncU4y/elJ6S1ZPQkpUZXFH/WjNXQT0"
    },
    {
      title: "The Ethics of AI",
      excerpt: "I can only read all courses in a school atmosphere, about future",
      image: "https://imgs.search.brave.com/UGY5gL585Viqusw9gCp4qIIlz-pGdC2Ma-RH7r3BayY/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMTU1/NzcxMTkxL3Bob3Rv/L3JvYm90LXdvcmtp/bmctaW4tb2ZmaWNl/LmpwZz9zPTYxMng2/MTImdz0wJms9MjAm/Yz1zM0NlX2JGSnZ6/MjhRZjRfM3pzLXhv/UFZLOURLaWlkVDBq/cU5Ya0FMSnBjPQ"
    }
  ];

  return (
    <div className="robot-home">
      {/* Hero Section */}
      <section className="hero bg-gradient-to-b from-robotDark to-robotLight text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">RoboTech</h1>
          <p className="text-2xl mb-6">Building The Future With Robots</p>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Discover cutting-edge robotics technology for home, industry, and research
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              to="/products" 
              className="bg-white text-robotDark px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
            >
              Explore Robots
            </Link>
            <Link 
              to="/products" 
              className="border-2 border-white text-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-robotDark transition"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* Our Robots Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-robotDark mb-12">Our Robots</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((robot) => (
              <div key={robot} className="bg-gray-50 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition">
                <img 
                    src={robot === 1 ? Robot1Image : 
                        robot === 2 ? Robot2Image : 
                        Robot3Image}
                    alt={`Robot ${robot}`}
                    className="w-full h-48 object-cover"
                  />
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">Robot Model {robot}</h3>
                  <p className="text-gray-600 mb-4">Advanced robotics solution for industrial applications</p>
                  <Link 
                    to={`/products/${robot}`}
                    className="text-robotLight font-semibold hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-robotDark mb-12">Why Choose Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
              <div className="w-16 h-16 bg-robotLight rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Advanced AI</h3>
              <p className="text-gray-600">Advanced machine learning algorithms</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
              <div className="w-16 h-16 bg-robotLight rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Predictor Engineering</h3>
              <p className="text-gray-600">Military-grade components</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
              <div className="w-16 h-16 bg-robotLight rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">24/7 Support</h3>
              <p className="text-gray-600">Dedicated technical team</p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Blogs Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-robotDark mb-12">Latest Blogs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {blogs.map((blog, index) => (
              <div key={index} className="bg-gray-50 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition">
                <img 
                  src={blog.image} 
                  alt={blog.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{blog.title}</h3>
                  <p className="text-gray-600 mb-4">{blog.excerpt}</p>
                  <Link 
                    to="/information" 
                    className="text-robotLight font-semibold hover:underline"
                  >
                    Read More →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-robotDark text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Stay Updated</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Subscribe to our newsletter for the latest updates in robotics technology
          </p>
          <div className="max-w-md mx-auto flex">
            <input 
              type="email" 
              placeholder="Your email address" 
              className="flex-grow px-4 py-3 rounded-l-lg focus:outline-none text-gray-800"
            />
            <button className="bg-robotLight text-robotDark px-6 py-3 rounded-r-lg font-bold hover:bg-robotAccent transition">
              Subscribe
            </button>
          </div>
          <p className="text-sm mt-4">Substitute the air newsletter for the initial 1 months</p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;