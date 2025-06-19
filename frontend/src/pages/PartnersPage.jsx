// frontend/src/pages/PartnersPage.jsx
import React from 'react';
import { Link } from 'react-router-dom'; 

const PartnersPage = () => {
  const partners = [
    { name: 'Siemens AG', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Siemens_logo.svg/2560px-Siemens_logo.svg.png' },
    { name: 'ABB Robotics', logo: 'https://new.abb.com/images/default-source/default-album/new-abb-logo-rgb.png?sfvrsn=b644b910_0' },
    { name: 'KUKA Robotics', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/KUKA_Roboter_GmbH_Logo.svg/2560px-KUKA_Roboter_GmbH_Logo.svg.png' },
    { name: 'Fanuc Corporation', logo: 'https://www.fanuc.eu/uk/en/-/media/fanuc/logos/fanuc-logo.png?as=0&dmc=0&h=202&w=700&la=en&hash=73103D37F21F6D0992383832B669F9B5' },
    { name: 'NVIDIA', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Nvidia_logo.svg/2560px-Nvidia_logo.svg.png' },
    { name: 'Intel Corporation', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Intel-logo.svg/2560px-Intel-logo.svg.png' },
    { name: 'Boston Dynamics', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Boston_Dynamics_logo.svg/2560px-Boston_Dynamics_logo.svg.png' },
    { name: 'Universal Robots', logo: 'https://www.universal-robots.com/media/252277/logo.png' },
    { name: 'Qualcomm', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Qualcomm_logo.svg/2560px-Qualcomm_logo.svg.png' },
    { name: 'Rockwell Automation', logo: 'https://cdn.worldvectorlogo.com/logos/rockwell-automation.svg' },
    { name: 'Keyence Corporation', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/KEYENCE_logo.svg/2560px-KEYENCE_logo.svg.png' },
    { name: 'Cognex Corporation', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Cognex_Logo.svg/2560px-Cognex_Logo.svg.png' },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center text-apexDarkBlue mb-8">Our Valued Partners</h1>
      <p className="text-center text-gray-700 mb-10 max-w-2xl mx-auto">
        We collaborate with leading companies across various sectors to deliver comprehensive and innovative robotic solutions. Our partners are crucial to our success and ability to serve diverse industry needs.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8"> 
        {partners.map((partner, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-center transition-transform transform hover:scale-105 border border-gray-200">

            <div className="h-20 w-full flex items-center justify-center mb-4">
              <img src={partner.logo} alt={partner.name} className="max-h-full max-w-full object-contain" />
            </div>
            <h3 className="text-md font-semibold text-apexBlue text-center leading-tight">{partner.name}</h3> 
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <h2 className="text-2xl font-bold text-apexDarkBlue mb-4">Become a Partner</h2>
        <p className="text-gray-700 max-w-xl mx-auto mb-6">
          Interested in partnering with Apex Robotics? We are always looking for synergistic collaborations to expand our reach and capabilities.
        </p>
        <Link
          to="/contactus" 
          className="bg-apexBlue text-white px-6 py-3 rounded-full text-lg font-semibold hover:bg-apexDarkBlue transition-colors inline-block" // inline-block to allow padding
        >
          Inquire About Partnership
        </Link>
      </div>
    </div>
  );
};

export default PartnersPage;