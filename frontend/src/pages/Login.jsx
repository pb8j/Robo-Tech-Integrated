// // frontend/src/pages/Login.jsx
// import React, { useState } from 'react';
// import { Link } from 'react-router-dom';
// import { useLogin } from "../hooks/useLogin"; // Make sure path is correct

// export default function Login() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const { login, error, isLoading } = useLogin(); // Destructure error and isLoading

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     await login(email, password); // Call the login function from the hook
//   };

//   return (
//     <div className="flex flex-col md:flex-row h-screen m-4 md:m-20">

//       {/* Left section: Image and "New member?" link */}
//       <div
//         className="w-full md:w-1/2 bg-cover bg-center flex items-center justify-center rounded-md relative"
//         style={{
//           backgroundImage: `url('https://wevolver-project-images.s3.us-west-1.amazonaws.com/0.znmq5oj21rautomated_robotic_arms.jpg')`,
//         }}
//       >
//         <div className="absolute bg-black bg-opacity-50 p-6 rounded-md text-white text-center">
//           <p className="text-2xl md:text-5xl font-bold mb-2 md:mb-5">
//             New member?
//           </p>
//           <p className="text-md md:text-lg">
//             <Link to="/signup" className="underline">Sign up now</Link>
//           </p>
//         </div>
//       </div>

//       {/* Right section: Login Form */}
//       <form
//         className="w-full md:w-1/2 border border-gray-300 p-4 md:p-10 rounded-md shadow-md flex flex-col items-center justify-center mx-auto mt-4 md:mt-0"
//         onSubmit={handleSubmit}
//       >
//         <h3 className="text-2xl md:text-5xl font-bold mb-4 md:mb-7">Log In</h3>

//         {/* Email Input */}
//         <div className="w-full md:w-2/3 mb-3">
//           <label className="block mb-2 text-sm md:text-2xl">Email address:</label>
//           <input
//             type="email"
//             className="w-full p-3 border border-gray-300 rounded-md"
//             placeholder="Enter your email"
//             onChange={(e) => setEmail(e.target.value)}
//             value={email}
//           />
//         </div>

//         {/* Password Input */}
//         <div className="mt-4 w-full md:w-2/3 mb-4">
//           <label className="mt-2 block mb-2 text-sm md:text-2xl">Password:</label>
//           <input
//             type="password"
//             className="w-full p-3 border border-gray-300 rounded-md"
//             placeholder="Enter your password"
//             onChange={(e) => setPassword(e.target.value)}
//             value={password}
//           />
//         </div>

//         {/* Submit Button */}
//         <button
//           type="submit"
//           disabled={isLoading} // Disable button when loading
//           className="mt-4 focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 md:px-8 md:py-3 me-2 mb-2 md:mb-0 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
//         >
//           {isLoading ? 'Logging In...' : 'Login'} {/* Show loading text */}
//         </button>

//         {/* Error Display */}
//         {error && (
//           <div className="text-red-500 text-sm mt-4 p-2 rounded bg-red-50 border border-red-300">
//             {error} {/* Display error directly, not error.message */}
//           </div>
//         )}
//       </form>
//     </div>
//   );
// }

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from "../hooks/useLogin"; // Make sure path is correct

export default function Login() {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, error: loginError, isLoading } = useLogin();

  // Send OTP to email
  const sendOtp = async () => {
    if (!email) {
      setError("Please enter your email first.");
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      setOtpSent(true);
      setMessage('OTP sent to your email. Please enter it below.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOtp = async () => {
    if (!otp) {
      setError('Please enter the OTP.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');

      setOtpVerified(true);
      setMessage('Email verified! Now enter your password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle final login submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otpVerified) {
      setError('Please verify your email first.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      await login(email, password);
      // success message handled by useLogin hook or redirect etc.
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen m-4 md:m-20">

      {/* Left section: Image and "New member?" link */}
      <div
        className="w-full md:w-1/2 bg-cover bg-center flex items-center justify-center rounded-md relative"
        style={{
          backgroundImage: `url('https://imgs.search.brave.com/SBSH96_e6Sg7fMnUe3YVgTxQ-aVTVGBzpzNNB00BmWs/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9zdC5k/ZXBvc2l0cGhvdG9z/LmNvbS8xMDA4NzY4/LzMzNzcvaS80NTAv/ZGVwb3NpdHBob3Rv/c18zMzc3NzIxOS1z/dG9jay1waG90by1y/ZWdpc3Rlci1oZXJl/LXNpZ24uanBn')`,
        }}
      >
        <div className="absolute bg-black bg-opacity-50 p-6 rounded-md text-white text-center">
          <p className="text-2xl md:text-5xl font-bold mb-2 md:mb-5">
            New member?
          </p>
          <p className="text-md md:text-lg">
            <Link to="/signup" className="underline">Sign up now</Link>
          </p>
        </div>
      </div>

      {/* Right section: Login Form */}
      <form
        className="w-full md:w-1/2 border border-gray-300 p-4 md:p-10 rounded-md shadow-md flex flex-col items-center justify-center mx-auto mt-4 md:mt-0"
        onSubmit={handleSubmit}
      >
        <h3 className="text-2xl md:text-5xl font-bold mb-4 md:mb-7">Log In</h3>

        {/* Email input + Send OTP button */}
        <div className="w-full md:w-2/3 mb-3 flex items-center">
          <input
            type="email"
            className="w-full p-3 border border-gray-300 rounded-md"
            placeholder="Enter your email"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
            disabled={otpSent}
            required
          />
          <button
            type="button"
            onClick={sendOtp}
            disabled={loading || otpSent}
            className={`ml-2 px-4 py-3 rounded-md text-white font-semibold ${
              otpSent ? 'bg-green-500 cursor-default' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {otpSent ? 'OTP Sent' : 'Send OTP'}
          </button>
        </div>

        {/* OTP input and verify button */}
        {otpSent && !otpVerified && (
          <div className="w-full md:w-2/3 mb-3 flex items-center">
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-md"
              placeholder="Enter OTP"
              onChange={(e) => setOtp(e.target.value)}
              value={otp}
              required
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={loading}
              className="ml-2 px-4 py-3 rounded-md text-white font-semibold bg-green-600 hover:bg-green-700"
            >
              Verify OTP
            </button>
          </div>
        )}

        {/* Password input only after OTP verified */}
        {otpVerified && (
          <div className="mt-4 w-full md:w-2/3 mb-4">
            <label className="mt-2 block mb-2 text-sm md:text-2xl">Password:</label>
            <input
              type="password"
              className="w-full p-3 border border-gray-300 rounded-md"
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              required
            />
          </div>
        )}

        {/* Login button */}
        <button
          type="submit"
          disabled={loading || !otpVerified || isLoading}
          className={`mt-4 focus:outline-none text-white ${
            otpVerified
              ? 'bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300'
              : 'bg-gray-400 cursor-not-allowed'
          } font-medium rounded-lg text-sm px-5 py-2.5 md:px-8 md:py-3 me-2 mb-2 md:mb-0`}
        >
          {loading || isLoading ? 'Processing...' : 'Login'}
        </button>

        {/* Messages */}
        {message && <p className="mt-4 text-green-600">{message}</p>}
        {(error || loginError) && (
          <div className="text-red-500 text-sm mt-4 p-2 rounded bg-red-50 border border-red-300">
            {error || loginError}
          </div>
        )}
      </form>
    </div>
  );
}
