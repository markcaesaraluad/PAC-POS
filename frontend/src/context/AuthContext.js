import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI, businessAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('token', action.payload.access_token);
      return {
        ...state,
        user: action.payload.user,
        business: action.payload.business,
        token: action.payload.access_token,
        loading: false,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        business: null,
        token: null,
        loading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  user: null,
  business: null,
  token: localStorage.getItem('token'),
  loading: true,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          
          let business = null;
          // For business users, fetch business information
          if (response.data.role !== 'super_admin') {
            try {
              const businessResponse = await businessAPI.getInfo();
              business = businessResponse.data;
            } catch (businessError) {
              console.error('Failed to load business info:', businessError);
            }
          }
          
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              access_token: token,
              user: response.data,
              business: business,
            },
          });
        } catch (error) {
          console.error('Auth check failed:', error);
          // Only logout on 401, not on network errors
          if (error.response?.status === 401) {
            dispatch({ type: 'LOGOUT' });
          } else {
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authAPI.login(credentials);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response.data,
      });

      toast.success('Login successful!');
      return response.data;
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      const message = error.response?.data?.detail || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  const value = {
    ...state,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};