import { apiDelete, apiGet, apiPatch, apiPost } from './api';

const withToken = (token) => ({ token });

export const adminListCategories = (token) =>
  apiGet('/admin/categories', withToken(token));

export const adminCreateCategory = (body, token) =>
  apiPost('/admin/categories', body, withToken(token));

export const adminUpdateCategory = (slug, body, token) =>
  apiPatch(`/admin/categories/${encodeURIComponent(slug)}`, body, withToken(token));

export const adminDeleteCategory = (slug, token) =>
  apiDelete(`/admin/categories/${encodeURIComponent(slug)}`, withToken(token));

export const adminListProducts = (slug, token) =>
  apiGet(`/admin/categories/${encodeURIComponent(slug)}/products?limit=200`, withToken(token));

export const adminCreateProduct = (slug, body, token) =>
  apiPost(`/admin/categories/${encodeURIComponent(slug)}/products`, body, withToken(token));

export const adminUpdateProduct = (slug, productId, body, token) =>
  apiPatch(
    `/admin/categories/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
    body,
    withToken(token),
  );

export const adminDeleteProduct = (slug, productId, token) =>
  apiDelete(
    `/admin/categories/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
    withToken(token),
  );

export const adminListOrders = (token) =>
  apiGet('/admin/orders?limit=100', withToken(token));

export const adminUpdateOrderStatus = (orderId, status, token) =>
  apiPatch(`/admin/orders/${encodeURIComponent(orderId)}/status`, { status }, withToken(token));

export const adminListCoupons = (token) =>
  apiGet('/admin/coupons', withToken(token));

export const adminCreateCoupon = (body, token) =>
  apiPost('/admin/coupons', body, withToken(token));

export const adminUpdateCoupon = (couponId, body, token) =>
  apiPatch(`/admin/coupons/${encodeURIComponent(couponId)}`, body, withToken(token));

export const adminDeleteCoupon = (couponId, token) =>
  apiDelete(`/admin/coupons/${encodeURIComponent(couponId)}`, withToken(token));
