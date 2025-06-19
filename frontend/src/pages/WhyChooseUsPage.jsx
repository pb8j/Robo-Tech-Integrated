import React from 'react';

const WhyChooseUsPage = () => {
  const features = [
    {
      title: "Advanced AI Integration",
      description: "Our robots utilize cutting-edge machine learning algorithms that continuously improve performance through experience.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>
      )
    },
    {
      title: "Military-Grade Engineering",
      description: "Built with predictor technology and components designed to withstand extreme conditions and rigorous use.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
        </svg>
      )
    },
    {
      title: "Unparalleled Support",
      description: "Our dedicated technical team provides 24/7 support to ensure your operations never experience downtime.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="robot-why-us py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-robotDark mb-4">Why Choose <span className="text-robotLight">RoboTech</span></h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover what makes our robotics solutions the preferred choice for industry leaders worldwide
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-robotLight bg-opacity-10 rounded-full flex items-center justify-center mb-6 text-robotLight">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-robotDark">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-robotDark to-robotLight text-white rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Operations?</h2>
          <p className="mb-6 max-w-2xl mx-auto">
            Our team is ready to help you implement the perfect robotic solution for your specific needs.
          </p>
          <button className="bg-white text-robotDark px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition">
            Contact Our Experts
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhyChooseUsPage;