import { apiDelete, apiGet, apiPost } from './api';

export const registerCustomer = (body) =>
  apiPost('/customers/register', body);

export const loginCustomer = (body) =>
  apiPost('/customers/login', body);

export const getMyProfile = (token) =>
  apiGet('/customers/me', { token });

export const getDistricts = () => apiGet('/locations/districts');

export const getAreas = (district) =>
  apiGet(`/locations/areas?district=${encodeURIComponent(district)}`);

export const validateCoupon = (code, subtotal) =>
  apiPost(
    `/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`,
    {},
  );

export const placeOrder = (body, token) =>
  apiPost('/orders', body, { token });

export const getMyOrders = (token) =>
  apiGet('/orders/my', { token });

export const removeServerCartItem = (productId, categorySlug, token) =>
  apiDelete(
    `/cart/items/${encodeURIComponent(productId)}?categorySlug=${encodeURIComponent(categorySlug)}`,
    { token },
  );
