import { apiGet } from './api';

export const getCategories = () => apiGet('/categories/sidebar');

export const getCategoryBrands = (slug) =>
  apiGet(`/categories/${encodeURIComponent(slug)}/brands`);
