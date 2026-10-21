export function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '৳ —';
  }
  return `৳ ${new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function productImage(product) {
  if (product?.image) {
    return product.image;
  }
  return product?.images?.[0] || null;
}

export function getCategoryIcon(slug = '') {
  const key = slug.toLowerCase().replaceAll('-', '_');
  const icons = {
    processors: 'cpu-64-bit',
    motherboards: 'developer-board',
    rams: 'memory',
    ram: 'memory',
    ssds: 'harddisk',
    graphics_cards: 'expansion-card',
    power_supplies: 'power-plug',
    casings: 'server',
    monitors: 'monitor',
    ups: 'battery-charging',
    keyboards: 'keyboard',
    mice: 'mouse',
    laptops: 'laptop',
  };
  return icons[key] || 'devices';
}

export function categoryColor(slug = '') {
  const palette = ['#EAF2FF', '#E8F8F5', '#F3ECFF', '#FFF3E7', '#EAF8FF'];
  const score = [...slug].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return palette[score % palette.length];
}
