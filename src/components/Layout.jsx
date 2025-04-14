import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const Layout = ({ children }) => {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <span className="text-white font-bold text-xl">BulbulChat</span>
              </Link>
            </div>
            
            {/* Desktop menu */}
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/" className="text-white hover:bg-blue-700 px-3 py-2 rounded-md">
                Bogga Hore
              </Link>
              <Link to="/puzzles" className="text-white hover:bg-blue-700 px-3 py-2 rounded-md">
                Puzzles
              </Link>
              <Link to="/profile" className="text-white hover:bg-blue-700 px-3 py-2 rounded-md">
                Bogga Shaqsiga
              </Link>
              <button
                onClick={handleSignOut}
                className="text-white hover:bg-blue-700 px-3 py-2 rounded-md"
              >
                Ka Bax
              </button>
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white hover:bg-blue-700 p-2 rounded-md focus:outline-none"
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-blue-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                to="/"
                className="text-white block px-3 py-2 rounded-md hover:bg-blue-800"
                onClick={() => setIsMenuOpen(false)}
              >
                Bogga Hore
              </Link>
              <Link
                to="/puzzles"
                className="text-white block px-3 py-2 rounded-md hover:bg-blue-800"
                onClick={() => setIsMenuOpen(false)}
              >
                Puzzles
              </Link>
              <Link
                to="/profile"
                className="text-white block px-3 py-2 rounded-md hover:bg-blue-800"
                onClick={() => setIsMenuOpen(false)}
              >
                Bogga Shaqsiga
              </Link>
              <button
                onClick={() => {
                  handleSignOut()
                  setIsMenuOpen(false)
                }}
                className="text-white block w-full text-left px-3 py-2 rounded-md hover:bg-blue-800"
              >
                Ka Bax
              </button>
            </div>
          </div>
        )}
      </nav>
      
      <main>{children}</main>
      
      <footer className="bg-blue-600 text-white py-4">
        <div className="container mx-auto px-4 text-center">
          <p>© 2025 BulbulChat - Ku xidhnow dhaqanka Soomaalida</p>
        </div>
      </footer>
    </div>
  )
}

export default Layout 