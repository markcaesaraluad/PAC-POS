import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  CubeIcon, 
  TagIcon, 
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const BusinessDashboard = () => {
  const { business } = useAuth();

  const quickStats = [
    { name: 'Products', value: '0', icon: CubeIcon, color: 'bg-blue-500' },
    { name: 'Categories', value: '0', icon: TagIcon, color: 'bg-green-500' },
    { name: 'Customers', value: '0', icon: UserGroupIcon, color: 'bg-purple-500' },
    { name: 'Today\'s Sales', value: '$0', icon: ChartBarIcon, color: 'bg-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to {business?.name}!</h1>
        <p className="text-gray-600">Manage your business operations from this dashboard</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => (
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              <button className="w-full btn-primary text-left flex items-center">
                <CubeIcon className="h-5 w-5 mr-3" />
                <div>
                  <p className="font-medium">Add Product</p>
                  <p className="text-sm opacity-75">Create new products for your inventory</p>
                </div>
              </button>
              
              <button className="w-full btn-success text-left flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-3" />
                <div>
                  <p className="font-medium">Open POS</p>
                  <p className="text-sm opacity-75">Start processing sales</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="card-body">
            <div className="text-center py-8 text-gray-500">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p>No recent activity</p>
              <p className="text-sm">Activity will appear here as you use the system</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessDashboard;