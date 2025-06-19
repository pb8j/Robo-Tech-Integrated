// frontend/src/components/Navbar.jsx (assuming this is your path)
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLogout } from '../hooks/useLogout'; // Import your useLogout hook
import { useAuthContext } from '../hooks/useAuthContext'; // Import your useAuthContext hook

const Navbar = () => {
  const { logout } = useLogout(); // Get the logout function
  const { user } = useAuthContext(); // Get the user state from the context

  const handleClick = () => {
    logout(); // Call the logout function
  };

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Partners', path: '/partners' },
    { name: 'Information', path: '/information' },
    { name: 'Tools', path: '/tools' },
  ];

  return (
    <div className="backdrop-blur-md bg-blue-900/70 text-white px-6 py-4 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">

        {/* Brand Logo */}
        <Link to="/" className="text-3xl font-extrabold tracking-wide text-white hover:text-blue-300 transition duration-300">
          Robo Tech
        </Link>

        {/* Navigation Links */}
        <nav className="flex flex-wrap justify-center gap-6 text-lg">
          {navItems.map(({ name, path }) => (
            <NavLink
              key={name}
              to={path}
              className={({ isActive }) =>
                `transition-all duration-200 ease-in-out hover:text-blue-300 hover:scale-105 ${
                  isActive
                    ? 'text-blue-300 font-semibold border-b-2 border-blue-300 pb-1'
                    : 'text-white'
                }`
              }
            >
              {name}
            </NavLink>
          ))}
        </nav>

        {/* Authentication Buttons (Conditional Rendering) */}
        <div className="flex items-center gap-4">
          {user ? ( // If a user is logged in
            <>
              <span className="text-white text-lg">Welcome, {user.email}!</span> {/* Display user's email */}
              <button
                onClick={handleClick} // Call logout function on click
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out"
              >
                Logout
              </button>
            </>
          ) : ( // If no user is logged in
            <>
              <Link to="/login">
                <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out">
                  Login
                </button>
              </Link>
              <Link to="/signup">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out">
                  Signup
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;