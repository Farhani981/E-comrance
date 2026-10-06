import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiUser,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiLogIn,
  FiUserPlus
} from 'react-icons/fi';

export default function Login() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [errorMessage, setErrorMessage] = useState(location.state?.message || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      let userData;
      if (activeTab === 'register') {
        if (formData.password !== formData.confirmPassword) {
          setErrorMessage('Passwords do not match!');
          return;
        }
        userData = await register(formData.name, formData.email, formData.password);
      } else {
        userData = await login(formData.email, formData.password);
      }

      if (userData && userData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/account');
      }
    } catch (error) {
      setErrorMessage(error.message || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-lg max-w-md w-full">

        {/* Toggle Header Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
          <button
            onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${activeTab === 'login'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
              }`}
          >
            <FiLogIn /> Sign In
          </button>
          <button
            onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${activeTab === 'register'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
              }`}
          >
            <FiUserPlus /> Register
          </button>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900">
            {activeTab === 'login' ? 'Welcome Back!' : 'Create Account'}
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            {activeTab === 'login'
              ? 'Enter your email & password to access your account'
              : 'Join ShopHub today to unlock fast checkout & order tracking'}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Full Name field (Register only) */}
          {activeTab === 'register' && (
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Enter your Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
                <FiUser className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="Enter your Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />
              <FiMail className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:border-slate-800 focus:bg-white transition"
              />
              <FiLock className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Register only) */}
          {activeTab === 'register' && (
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
                <FiLock className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-black hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition duration-300 flex items-center justify-center gap-2 shadow-md mt-4 active:scale-95"
          >
            <FiCheckCircle /> {activeTab === 'login' ? 'Sign In to Account' : 'Register Account'}
          </button>
        </form>

        {/* Sign-in help */}
        <div className="mt-6 text-center border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-400">
            Use your registered email and password. Admin access requires an administrator account.
          </p>
        </div>

      </div>
    </div>
  );
}
