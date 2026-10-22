import { apiGet, apiRequest } from './api';

export const getLatestProducts = () => apiGet('/products/latest?limit=10');

export const getBestSellers = () =>
  apiGet('/products/best-sellers?limit=10');

export const searchProducts = (query, options) =>
  apiGet(`/products/search?q=${encodeURIComponent(query)}&limit=8`, options);

export const getProductDetails = (productId) =>
  apiGet(`/products/${encodeURIComponent(productId)}`);

export const getProductReviews = (productId, categorySlug, token) =>
  apiGet(
    `/products/${encodeURIComponent(productId)}/reviews?categorySlug=${encodeURIComponent(categorySlug)}`,
    { token },
  );

export const saveProductReview = (productId, categorySlug, body, token) =>
  apiRequest(
    `/products/${encodeURIComponent(productId)}/reviews?categorySlug=${encodeURIComponent(categorySlug)}`,
    { method: 'PUT', body, token },
  );

export const getCategoryProducts = (slug, brand) =>
  apiGet(
    `/categories/${encodeURIComponent(slug)}/brands/${encodeURIComponent(brand)}/products?limit=30`,
  );

export const getOfferedProducts = (category) =>
  apiGet(`/products/offers?limit=200${category ? `&category=${encodeURIComponent(category)}` : ''}`);

export const getCategoryFilterOptions = (slug) =>
  apiGet(`/products/category/${encodeURIComponent(slug)}/filter-options`);

export const filterCategoryProducts = (slug, options = {}) => {
  const query = new URLSearchParams();
  if (options.brand) query.set('brand', options.brand);
  if (options.min_price !== undefined) query.set('min_price', options.min_price);
  if (options.max_price !== undefined) query.set('max_price', options.max_price);
  if (options.in_stock !== undefined) query.set('in_stock', String(options.in_stock));
  if (options.sort) query.set('sort', options.sort);
  if (options.filters && Object.keys(options.filters).length) {
    query.set('filters', JSON.stringify(options.filters));
  }
  query.set('limit', '100');
  return apiGet(`/products/category/${encodeURIComponent(slug)}/filter?${query}`);
};
