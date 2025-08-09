import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { superAdminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  BuildingOfficeIcon, 
  PlusIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const schema = yup.object({
  name: yup.string().required('Business name is required'),
  subdomain: yup
    .string()
    .required('Subdomain is required')
    .matches(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens'),
  contact_email: yup.string().email('Invalid email').required('Contact email is required'),
  phone: yup.string(),
  address: yup.string(),
  admin_name: yup.string().required('Admin name is required'),
  admin_email: yup.string().email('Invalid email').required('Admin email is required'),
  admin_password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  description: yup.string(),
});

const BusinessManagement = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(schema),
  });

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await superAdminAPI.getBusinesses();
      setBusinesses(response.data);
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async (data) => {
    setIsSubmitting(true);
    try {
      await superAdminAPI.createBusiness(data);
      toast.success('Business created successfully!');
      setShowCreateModal(false);
      reset();
      fetchBusinesses();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create business';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (businessId, newStatus) => {
    try {
      await superAdminAPI.updateBusinessStatus(businessId, newStatus);
      toast.success('Business status updated');
      fetchBusinesses();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

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

  if (loading) {
    return <LoadingSpinner message="Loading businesses..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Management</h1>
          <p className="text-gray-600">Manage all businesses in the system</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Business
        </button>
      </div>

      {/* Businesses Table */}
      <div className="card">
        <div className="card-body p-0">
          {businesses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subdomain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <BuildingOfficeIcon className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{business.name}</div>
                            {business.description && (
                              <div className="text-sm text-gray-500">{business.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{business.subdomain}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{business.contact_email}</div>
                        {business.phone && (
                          <div className="text-sm text-gray-500">{business.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(business.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(business.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <select
                            value={business.status}
                            onChange={(e) => handleStatusChange(business.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          <button className="text-gray-400 hover:text-gray-600">
                            <UserGroupIcon className="h-5 w-5" title="View Users" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No businesses</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new business.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create Business
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Business Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Business</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleCreateBusiness)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Business Name</label>
                  <input
                    type="text"
                    className="form-input"
                    {...register('name')}
                  />
                  {errors.name && <p className="form-error">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="form-label">Subdomain</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="business-name"
                    {...register('subdomain')}
                  />
                  {errors.subdomain && <p className="form-error">{errors.subdomain.message}</p>}
                </div>

                <div>
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-input"
                    {...register('contact_email')}
                  />
                  {errors.contact_email && <p className="form-error">{errors.contact_email.message}</p>}
                </div>

                <div>
                  <label className="form-label">Phone (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    {...register('phone')}
                  />
                  {errors.phone && <p className="form-error">{errors.phone.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">Address (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    {...register('address')}
                  />
                  {errors.address && <p className="form-error">{errors.address.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    {...register('description')}
                  />
                  {errors.description && <p className="form-error">{errors.description.message}</p>}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Business Admin Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Admin Name</label>
                    <input
                      type="text"
                      className="form-input"
                      {...register('admin_name')}
                    />
                    {errors.admin_name && <p className="form-error">{errors.admin_name.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Admin Email</label>
                    <input
                      type="email"
                      className="form-input"
                      {...register('admin_email')}
                    />
                    {errors.admin_email && <p className="form-error">{errors.admin_email.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="form-label">Admin Password</label>
                    <input
                      type="password"
                      className="form-input"
                      {...register('admin_password')}
                    />
                    {errors.admin_password && <p className="form-error">{errors.admin_password.message}</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner />
                      <span className="ml-2">Creating...</span>
                    </>
                  ) : (
                    'Create Business'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessManagement;