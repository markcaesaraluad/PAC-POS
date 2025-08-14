import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon, ClipboardDocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ErrorDisplay = () => {
  const [currentError, setCurrentError] = useState(null);
  const [showInlineError, setShowInlineError] = useState(false);

  useEffect(() => {
    const handlePosError = (event) => {
      const errorDetails = event.detail;
      
      // Show toast for most errors
      showErrorToast(errorDetails);
      
      // Show inline error for high-severity blocking operations
      if (isBlockingError(errorDetails)) {
        setCurrentError(errorDetails);
        setShowInlineError(true);
      }
    };

    window.addEventListener('pos-error', handlePosError);
    
    return () => {
      window.removeEventListener('pos-error', handlePosError);
    };
  }, []);

  const isBlockingError = (errorDetails) => {
    // Show inline errors for payment-related and critical operations
    const blockingCodes = [
      'POS-PAY-001', 'POS-PAY-002', 'DB-TXN-001', 
      'AUTH-001', 'POS-PRINT-001'
    ];
    return blockingCodes.includes(errorDetails.errorCode) || 
           errorDetails.route?.includes('/payment') ||
           errorDetails.statusCode >= 500;
  };

  const showErrorToast = (errorDetails) => {
    const toastId = `error-${errorDetails.correlationId}`;
    
    toast.custom((t) => (
      <div className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                Error Occurred
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {errorDetails.message}
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                  CODE: {errorDetails.errorCode}
                </span>
                <button
                  onClick={() => copyErrorDetails(errorDetails)}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
                  Copy Details
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    ), {
      id: toastId,
      duration: 8000,
      position: 'top-right'
    });
  };

  const copyErrorDetails = async (errorDetails) => {
    const details = {
      errorCode: errorDetails.errorCode,
      correlationId: errorDetails.correlationId,
      route: errorDetails.route,
      timestamp: errorDetails.timestamp,
      message: errorDetails.message
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      toast.success('Error details copied to clipboard');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(details, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Error details copied to clipboard');
    }
  };

  const dismissInlineError = () => {
    setShowInlineError(false);
    setCurrentError(null);
  };

  return (
    <>
      {/* Inline Error Display for Blocking Operations */}
      {showInlineError && currentError && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Operation Failed
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {currentError.message}
                    </p>
                    <div className="mt-3 flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        ERROR CODE: {currentError.errorCode}
                      </span>
                      <button
                        onClick={() => copyErrorDetails(currentError)}
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
                        Copy Details
                      </button>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-400">
                        Correlation ID: {currentError.correlationId}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={dismissInlineError}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ErrorDisplay;