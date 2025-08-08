import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { categoriesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  TagIcon, 
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const schema = yup.object({
  name: yup.string().required('Category name is required'),
  description: yup.string(),
  color: yup.string().required('Color is required'),
});

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colorOptions = [
    { value: '#3B82F6', name: 'Blue', class: 'bg-blue-500' },
    { value: '#10B981', name: 'Green', class: 'bg-green-500' },
    { value: '#F59E0B', name: 'Yellow', class: 'bg-yellow-500' },
    { value: '#EF4444', name: 'Red', class: 'bg-red-500' },
    { value: '#8B5CF6', name: 'Purple', class: 'bg-purple-500' },
    { value: '#F97316', name: 'Orange', class: 'bg-orange-500' },
    { value: '#06B6D4', name: 'Cyan', class: 'bg-cyan-500' },
    { value: '#84CC16', name: 'Lime', class: 'bg-lime-500' },
    { value: '#EC4899', name: 'Pink', class: 'bg-pink-500' },
    { value: '#6B7280', name: 'Gray', class: 'bg-gray-500' },
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      color: '#3B82F6'
    }
  });

  const selectedColor = watch('color');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (data) => {
    setIsSubmitting(true);
    try {
      await categoriesAPI.createCategory(data);
      toast.success('Category created successfully!');
      setShowCreateModal(false);
      reset();
      fetchCategories();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create category';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async (data) => {
    setIsSubmitting(true);
    try {
      await categoriesAPI.updateCategory(editingCategory.id, data);
      toast.success('Category updated successfully!');
      setEditingCategory(null);
      reset();
      fetchCategories();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update category';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (window.confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
      try {
        await categoriesAPI.deleteCategory(categoryId);
        toast.success('Category deleted successfully!');
        fetchCategories();
      } catch (error) {
        const message = error.response?.data?.detail || 'Failed to delete category';
        toast.error(message);
      }
    }
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setValue('name', category.name);
    setValue('description', category.description || '');
    setValue('color', category.color || '#3B82F6');
  };

  const getColorClass = (color) => {
    const colorMap = {
      '#3B82F6': 'bg-blue-500',
      '#10B981': 'bg-green-500',
      '#F59E0B': 'bg-yellow-500',
      '#EF4444': 'bg-red-500',
      '#8B5CF6': 'bg-purple-500',
      '#F97316': 'bg-orange-500',
      '#06B6D4': 'bg-cyan-500',
      '#84CC16': 'bg-lime-500',
      '#EC4899': 'bg-pink-500',
      '#6B7280': 'bg-gray-500',
    };
    return colorMap[color] || 'bg-blue-500';
  };

  if (loading) {
    return <LoadingSpinner message="Loading categories..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
          <p className="text-gray-600">Organize your products with categories</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Category
        </button>
      </div>

      {/* Categories Grid */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category) => (
            <div key={category.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div 
                      className={`w-4 h-4 rounded-full mr-3 ${getColorClass(category.color)}`}
                    />
                    <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(category)}
                      className="text-gray-400 hover:text-primary-600 p-1"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {category.description && (
                  <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-500">
                    <CubeIcon className="h-4 w-4 mr-1" />
                    <span>{category.product_count} products</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(category.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="text-center py-12">
              <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No categories</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first product category.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Category Modal */}
      {(showCreateModal || editingCategory) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCategory(null);
                  reset();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form 
              onSubmit={handleSubmit(editingCategory ? handleUpdateCategory : handleCreateCategory)} 
              className="space-y-4"
            >
              <div>
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Printing Services"
                  {...register('name')}
                />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>

              <div>
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Brief description of this category"
                  {...register('description')}
                />
                {errors.description && <p className="form-error">{errors.description.message}</p>}
              </div>

              <div>
                <label className="form-label">Category Color</label>
                <div className="grid grid-cols-5 gap-3 mt-2">
                  {colorOptions.map((color) => (
                    <label key={color.value} className="cursor-pointer">
                      <input
                        type="radio"
                        className="sr-only"
                        value={color.value}
                        {...register('color')}
                      />
                      <div className={`w-8 h-8 rounded-full ${color.class} ring-2 ring-offset-2 ${
                        selectedColor === color.value ? 'ring-gray-400' : 'ring-transparent'
                      } hover:ring-gray-300 transition-all`}>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.color && <p className="form-error">{errors.color.message}</p>}
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingCategory(null);
                    reset();
                  }}
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
                      <span className="ml-2">
                        {editingCategory ? 'Updating...' : 'Creating...'}
                      </span>
                    </>
                  ) : (
                    editingCategory ? 'Update Category' : 'Create Category'
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

export default CategoryManagement;