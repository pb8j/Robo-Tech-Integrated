import React from 'react';
import { Link } from 'react-router-dom';

const InformationPage = () => {
  const infoCards = [
    {
      title: 'Blog & News',
      description: 'Stay updated with the latest trends, news, and insights in robotics and automation.',
      link: '/information/blogs',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
        </svg>
      )
    },
    {
      title: 'Case Studies',
      description: 'Discover how RoboTech has transformed operations across industries.',
      link: '/information/case-studies',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      )
    },
    {
      title: 'Deployment Process',
      description: 'Our step-by-step approach to implementing robotic solutions.',
      link: '/information/deployment',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
        </svg>
      )
    },
    {
      title: 'Technology White Papers',
      description: 'In-depth technical documentation of our core technologies.',
      link: '/information/white-papers',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      )
    },
    {
      title: 'Robotics Basics',
      description: 'Fundamental concepts for those new to robotics and automation.',
      link: '/information/basics',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.523 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.523 18.246 18 16.5 18s-3.332.477-4.5 1.253"></path>
        </svg>
      )
    },
    {
      title: 'FAQ & Support',
      description: 'Answers to common questions and technical support resources.',
      link: '/information/faq',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="robot-info-hub py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-robotDark mb-4">RoboTech Information Hub</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive resources to help you understand and leverage robotic automation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {infoCards.map((card, index) => (
            <Link
              key={index}
              to={card.link}
              className="bg-gray-50 rounded-xl p-6 flex flex-col h-full transform hover:-translate-y-2 transition duration-300 hover:shadow-lg border border-gray-200 hover:border-robotLight"
            >
              <div className="w-12 h-12 bg-robotLight bg-opacity-10 rounded-lg flex items-center justify-center mb-4 text-robotLight">
                {card.icon}
              </div>
              <h3 className="text-xl font-bold text-robotDark mb-2">{card.title}</h3>
              <p className="text-gray-600 mb-4 flex-grow">{card.description}</p>
              <div className="text-robotLight font-medium flex items-center">
                Explore
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InformationPage;