import React, { useState, useEffect } from 'react';
import { superAdminAPI } from '../../services/api';
import { 
  BuildingOfficeIcon, 
  UserGroupIcon, 
  ChartBarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';

const SuperAdminDashboard = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    activeBusinesses: 0,
    totalUsers: 0,
    recentBusinesses: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await superAdminAPI.getBusinesses();
      const businessList = response.data;
      setBusinesses(businessList);
      
      // Calculate stats
      const activeBusinesses = businessList.filter(b => b.status === 'active').length;
      const recentBusinesses = businessList
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      setStats({
        totalBusinesses: businessList.length,
        activeBusinesses,
        totalUsers: 0, // TODO: Add user count calculation
        recentBusinesses,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const statCards = [
    {
      name: 'Total Businesses',
      value: stats.totalBusinesses,
      icon: BuildingOfficeIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Active Businesses',
      value: stats.activeBusinesses,
      icon: ChartBarIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Total Users',
      value: stats.totalUsers,
      icon: UserGroupIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Revenue',
      value: '$0',
      icon: CurrencyDollarIcon,
      color: 'bg-yellow-500',
    },
  ];

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[status] || statusStyles.inactive}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to the Super Admin dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Businesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Businesses</h3>
          </div>
          <div className="card-body">
            {stats.recentBusinesses.length > 0 ? (
              <div className="space-y-4">
                {stats.recentBusinesses.map((business) => (
                  <div key={business.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{business.name}</p>
                      <p className="text-sm text-gray-500">{business.subdomain}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(business.status)}
                      <span className="text-xs text-gray-500">
                        {new Date(business.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No businesses yet</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <button
                onClick={() => window.location.href = '/super-admin/businesses'}
                className="w-full btn-primary text-left"
              >
                <div className="flex items-center">
                  <BuildingOfficeIcon className="h-5 w-5 mr-3" />
                  <div>
                    <p className="font-medium">Manage Businesses</p>
                    <p className="text-sm opacity-75">Create, edit, and monitor businesses</p>
                  </div>
                </div>
              </button>
              
              <button
                className="w-full btn-secondary text-left"
                disabled
              >
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 mr-3" />
                  <div>
                    <p className="font-medium">View Reports</p>
                    <p className="text-sm opacity-75">System-wide analytics (Coming soon)</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;