import { API_BASE_URL } from './api';

export const POLICY_MANUALS = [
  {
    id: 'GT-POL-WS-01',
    title: 'Warranty and Service Policy',
    description: 'Warranty coverage, service claims, repair, and replacements.',
  },
  {
    id: 'GT-POL-PR-01',
    title: 'Payment, Cancellation and Refunds Policy',
    description: 'Payment options, cancellations, refunds, and timelines.',
  },
  {
    id: 'GT-POL-DS-01',
    title: 'Delivery and Shipping Policy',
    description: 'Delivery areas, fees, timeframes, and rescheduling.',
  },
];

export function getPolicyManualUrl(policyId, page = 1) {
  if (!POLICY_MANUALS.some((policy) => policy.id === policyId)) return null;
  const pageNumber = Number.isInteger(page) && page > 0 ? page : 1;
  return `${API_BASE_URL}/policies/${policyId}#page=${pageNumber}`;
}
