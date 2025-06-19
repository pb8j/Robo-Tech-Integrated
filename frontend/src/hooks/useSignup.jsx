// frontend/src/hooks/useSignup.js
import { useState } from 'react'
import { useAuthContext } from './useAuthContext'
import { useNavigate } from 'react-router-dom' // <-- Import useNavigate

export const useSignup = () => {
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false) // Initialize isLoading to false
  const { dispatch } = useAuthContext()
  const navigate = useNavigate() // <-- Initialize useNavigate

  const signup = async (email, password) => {
    setIsLoading(true)
    setError(null)

    try { // <-- Add try-catch for the fetch call itself
      const response = await fetch('/api/user/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
      })
      const json = await response.json()

      if (!response.ok) {
        setIsLoading(false)
        setError(json.error)
      } else { // Use else for clarity, as response.ok handles success
        // save the user to local storage (e.g., token, email)
        localStorage.setItem('user', JSON.stringify(json))

        // update the auth context
        dispatch({type: 'LOGIN', payload: json})

        // update loading state
        setIsLoading(false)

        // Redirect to homepage after successful signup
        navigate('/') // <-- ADD THIS LINE to navigate to the homepage
      }
    } catch (fetchError) {
      setIsLoading(false);
      setError("Network error or server unreachable. Please try again.");
      console.error("Signup fetch error:", fetchError);
    }
  }

  return { signup, isLoading, error }
}