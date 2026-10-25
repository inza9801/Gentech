import { apiDelete, apiGet, apiPost, apiRequest } from './api';

export const registerCustomer = (body) =>
  apiPost('/customers/register', body);

export const loginCustomer = (body) =>
  apiPost('/customers/login', body);

export const getMyProfile = (token) =>
  apiGet('/customers/me', { token });

export const updateMyProfile = (body, token) =>
  apiRequest('/customers/me', { token, method: 'PATCH', body });

export const getDistricts = () => apiGet('/locations/districts');

export const getAreas = (district) =>
  apiGet(`/locations/areas?district=${encodeURIComponent(district)}`);

export const getDeliveryQuote = (district, area, orderTotal, options) =>
  apiGet(
    `/delivery/quote?district=${encodeURIComponent(district)}&area=${encodeURIComponent(area)}&order_total=${orderTotal}`,
    options,
  );

export const validateCoupon = (code, subtotal, token) =>
  apiPost(
    `/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`,
    {},
    { token },
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
