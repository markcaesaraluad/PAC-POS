import React from 'react';

const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div
          className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-300 border-t-primary-600 mx-auto mb-4`}
        />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export const InlineSpinner = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-primary-600`}
    />
  );
};

export default LoadingSpinner;