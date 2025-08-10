import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const useBusinessStatus = () => {
  const { user, business } = useAuth();
  const [isBusinessSuspended, setIsBusinessSuspended] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkBusinessStatus = () => {
      // Super Admin can access any business
      if (user?.role === 'super_admin') {
        setIsBusinessSuspended(false);
        setIsLoading(false);
        return;
      }

      // Check if business is suspended
      if (business && business.status === 'suspended') {
        setIsBusinessSuspended(true);
      } else {
        setIsBusinessSuspended(false);
      }
      
      setIsLoading(false);
    };

    if (user !== null) {
      checkBusinessStatus();
    }
  }, [user, business]);

  return {
    isBusinessSuspended,
    isLoading,
    businessName: business?.name,
    userRole: user?.role
  };
};

export default useBusinessStatus;