import React, { useState, useEffect } from 'react';
import { staffAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  UserGroupIcon,
  UserPlusIcon,
  PencilSquareIcon,
  TrashIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  role: yup.string().oneOf(['business_admin', 'cashier'], 'Invalid role').required('Role is required'),
  password: yup.string().when('isEdit', {
    is: false,
    then: (schema) => schema.min(6, 'Password must be at least 6 characters').required('Password is required'),
    otherwise: (schema) => schema.notRequired()
  })
});

const StaffManagement = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isDeleting, setIsDeleting] = useState('');
  const [showResetPassword, setShowResetPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    setValue 
  } = useForm({
    resolver: yupResolver(schema),
    context: { isEdit: !!editingStaff }
  });

  // Check admin access
  const hasAdminAccess = user && (user.role === 'business_admin' || user.role === 'super_admin');

  useEffect(() => {
    if (hasAdminAccess) {
      fetchStaff();
    }
  }, [hasAdminAccess]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      
      const response = await staffAPI.getUsers(params);
      setStaff(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      setStaff([]);
      toast.error(`Failed to load staff: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (hasAdminAccess) {
        fetchStaff();
      }
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, roleFilter, statusFilter, hasAdminAccess]);

  const openCreateModal = () => {
    setEditingStaff(null);
    setShowPassword(false);
    reset({ name: '', email: '', role: 'cashier', password: '' });
    setShowModal(true);
  };

  const openEditModal = (staffMember) => {
    setEditingStaff(staffMember);
    setShowPassword(false);
    setValue('name', staffMember.name);
    setValue('email', staffMember.email);
    setValue('role', staffMember.role);
    setValue('password', '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStaff(null);
    setShowPassword(false);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      if (editingStaff) {
        // Update existing staff
        const updateData = {
          name: data.name,
          email: data.email,
          role: data.role
        };
        
        await staffAPI.updateUser(editingStaff.id, updateData);
        toast.success('Staff member updated successfully');
      } else {
        // Create new staff
        await staffAPI.createUser(data);
        toast.success('Staff member created successfully');
      }
      
      closeModal();
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      const message = error.response?.data?.detail || 'Failed to save staff member';
      toast.error(message);
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!confirm(`Are you sure you want to delete ${staffName}? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(staffId);
      await staffAPI.deleteUser(staffId);
      toast.success('Staff member deleted successfully');
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete staff member');
    } finally {
      setIsDeleting('');
    }
  };

  const handleToggleStatus = async (staffId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await staffAPI.updateUser(staffId, { is_active: newStatus });
      toast.success(`Staff member ${newStatus ? 'activated' : 'deactivated'} successfully`);
      fetchStaff();
    } catch (error) {
      console.error('Error updating staff status:', error);
      toast.error('Failed to update staff status');
    }
  };

  const handleResetPassword = async (staffId) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (!confirm('Are you sure you want to reset this staff member\'s password?')) {
      return;
    }

    try {
      await staffAPI.resetPassword(staffId, { new_password: newPassword });
      toast.success('Password reset successfully');
      setShowResetPassword('');
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Active</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">Inactive</span>;
    }
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      'business_admin': 'bg-purple-100 text-purple-800',
      'cashier': 'bg-blue-100 text-blue-800'
    };
    
    const roleLabels = {
      'business_admin': 'Admin',
      'cashier': 'Cashier'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
        {roleLabels[role] || role}
      </span>
    );
  };

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permission to access staff management.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading staff..." />;
  }

  const filteredStaff = staff.filter(member => {
    const matchesSearch = !searchTerm || 
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || member.role === roleFilter;
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && member.is_active) ||
      (statusFilter === 'inactive' && !member.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <UserGroupIcon className="h-6 w-6 mr-2" />
            Staff Management
          </h1>
          <p className="text-gray-600">Manage your team members and their access levels</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center"
        >
          <UserPlusIcon className="h-4 w-4 mr-2" />
          Add Staff Member
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Search</label>
              <div className="relative">
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="business_admin">Admin</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearAllFilters}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Active Filters */}
          {(searchTerm || roleFilter || statusFilter) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Search: {searchTerm}
                  <button onClick={() => setSearchTerm('')} className="ml-1">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
              {roleFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Role: {roleFilter === 'business_admin' ? 'Admin' : 'Cashier'}
                  <button onClick={() => setRoleFilter('')} className="ml-1">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter('')} className="ml-1">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Staff Table */}
      <div className="card">
        <div className="card-body p-0">
          {filteredStaff.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStaff.map((staffMember) => (
                    <tr key={staffMember.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{staffMember.name}</div>
                          <div className="text-sm text-gray-500">{staffMember.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(staffMember.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(staffMember.is_active)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staffMember.created_at ? new Date(staffMember.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(staffMember)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit Staff Member"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => setShowResetPassword(staffMember.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Reset Password"
                          >
                            <KeyIcon className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(staffMember.id, staffMember.is_active)}
                            className={staffMember.is_active ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}
                            title={staffMember.is_active ? "Deactivate" : "Activate"}
                          >
                            {staffMember.is_active ? (
                              <EyeSlashIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteStaff(staffMember.id, staffMember.name)}
                            disabled={isDeleting === staffMember.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title="Delete Staff Member"
                          >
                            {isDeleting === staffMember.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
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
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No staff members found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || roleFilter || statusFilter 
                  ? "No staff members match your current filters." 
                  : "Get started by adding your first staff member."
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  {...register('name')}
                />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  {...register('email')}
                />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div>
                <label className="form-label">Role *</label>
                <select className="form-input" {...register('role')}>
                  <option value="cashier">Cashier</option>
                  <option value="business_admin">Admin</option>
                </select>
                {errors.role && <p className="form-error">{errors.role.message}</p>}
              </div>

              {!editingStaff && (
                <div>
                  <label className="form-label">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-input pr-10"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="form-error">{errors.password.message}</p>}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn-primary"
                >
                  {isSubmitting ? 'Saving...' : (editingStaff ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
              <button
                onClick={() => setShowResetPassword('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowResetPassword('')}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(showResetPassword)}
                  className="flex-1 btn-primary"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;