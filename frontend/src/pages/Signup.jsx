import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSignup } from "../hooks/useSignup";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signup } = useSignup();

  // Send OTP to email
  const sendOtp = async () => {
    if (!email) {
      setError("Please enter your email first.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");

      setOtpSent(true);
      setMessage("OTP sent to your email. Please enter it below.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOtp = async () => {
    if (!otp) {
      setError("Please enter the OTP.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed");

      setOtpVerified(true);
      setMessage("Email verified! Now set your password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Final signup submit (email, password)
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (!otpVerified) {
      setError("Please verify your email first.");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      setLoading(false);
      return;
    }

    try {
      await signup(email, password);
      setMessage("Signup successful! You can now login.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen m-4 md:m-20">
      <div
        className="w-full md:w-1/2 bg-cover bg-center flex items-center justify-center rounded-md relative"
        style={{
          backgroundImage:
            "url('https://imgs.search.brave.com/9zIRG_91TyKJOLikq6Xw-hLNywInFeB5jBXtpLzPU5M/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5pc3RvY2twaG90/by5jb20vaWQvMTM1/NDgyODM5Ny9waG90/by9mb3VyLXJvYm90/cy13b3JraW5nLXdp/dGgtbGFwdG9wLmpw/Zz9zPTYxMng2MTIm/dz0wJms9MjAmYz1S/a1FuUG10Z2JuQjk1/V0RkTlc0WjZLeDhm/V0VkUy1SenVPVHdw/RnpzM3hVPQ')",
        }}
      >
        <div className="absolute bg-black bg-opacity-50 p-6 rounded-md text-white text-center">
          <p className="text-2xl md:text-5xl font-bold mb-2 md:mb-5">
            Already a member?
          </p>
          <p className="text-md md:text-lg">
            <Link to="/login" className="underline">
              Login
            </Link>
          </p>
        </div>
      </div>

      <form
        className="w-full md:w-1/2 border border-gray-300 p-4 md:p-10 rounded-md shadow-md flex flex-col items-center justify-center mx-auto mt-4 md:mt-0"
        onSubmit={handleSignup}
      >
        <h3 className="text-2xl md:text-5xl font-bold mb-4 md:mb-7">Signup</h3>

        {/* Email input with Send OTP button */}
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
              otpSent
                ? "bg-green-500 cursor-default"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {otpSent ? "OTP Sent" : "Send OTP"}
          </button>
        </div>

        {/* OTP input shows only after OTP is sent and before verified */}
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
            <label className="mt-2 block mb-2 text-sm md:text-2xl">
              Password:
            </label>
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

        <button
          type="submit"
          disabled={loading || !otpVerified}
          className={`mt-4 focus:outline-none text-white ${
            otpVerified
              ? "bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300"
              : "bg-gray-400 cursor-not-allowed"
          } font-medium rounded-lg text-sm px-5 py-2.5 md:px-8 md:py-3 me-2 mb-2 md:mb-0`}
        >
          {loading ? "Processing..." : "Signup"}
        </button>

        {message && <p className="mt-4 text-green-600">{message}</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}
      </form>
    </div>
  );
}
