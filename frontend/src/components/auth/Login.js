import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../../context/AuthContext';
import { InlineSpinner } from '../LoadingSpinner';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
  business_subdomain: yup.string().when('userType', {
    is: 'business',
    then: (schema) => schema.required('Business subdomain is required'),
    otherwise: (schema) => schema.nullable(),
  }),
});

const Login = () => {
  const { login } = useAuth();
  const [userType, setUserType] = useState('business'); // 'business' or 'super_admin' - default to business
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(schema),
    context: { userType },
  });

  // Watch userType changes to clear business_subdomain when switching to super admin
  React.useEffect(() => {
    if (userType === 'super_admin') {
      setValue('business_subdomain', '');
    }
  }, [userType, setValue]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const credentials = {
        email: data.email,
        password: data.password,
      };

      if (userType === 'business' && data.business_subdomain) {
        credentials.business_subdomain = data.business_subdomain;
      }

      await login(credentials);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Modern POS System
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        {/* User Type Selection */}
        <div className="flex space-x-4 justify-center">
          <button
            type="button"
            onClick={() => setUserType('super_admin')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              userType === 'super_admin'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Super Admin
          </button>
          <button
            type="button"
            onClick={() => setUserType('business')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              userType === 'business'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Business User
          </button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {userType === 'business' && (
              <div>
                <label htmlFor="business_subdomain" className="form-label">
                  Business Subdomain
                </label>
                <input
                  id="business_subdomain"
                  type="text"
                  className="form-input"
                  placeholder="Enter your business subdomain"
                  {...register('business_subdomain')}
                />
                {errors.business_subdomain && (
                  <p className="form-error">{errors.business_subdomain.message}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="form-input"
                placeholder="Enter your email"
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="form-input"
                placeholder="Enter your password"
                {...register('password')}
              />
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <InlineSpinner />
                  <span className="ml-2">Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          {userType === 'super_admin' && (
            <div className="text-center text-sm text-gray-600">
              <p>Super Admin Access</p>
              <p className="text-xs text-gray-500 mt-1">
                Contact system administrator for credentials
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;