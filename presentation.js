// Display details are kept separate from the catalog's experiment data.
export const productDetails = {
  'yp-01': {
    english: 'Cloud Flow',
    features: ['高腰包覆', '雙側深口袋', '四向彈性'],
    note: '練習時的每一次伸展，都有溫柔支撐。',
  },
  'yp-02': {
    english: 'Mountain Mist',
    features: ['中高腰剪裁', '單側口袋', '膝後透氣網眼'],
    note: '為室內流動練習，留一點呼吸的空間。',
  },
  'yp-03': {
    english: 'Morning Light',
    features: ['無縫針織', '無口袋', '輕盈裸感'],
    note: '輕薄、簡單，專注在身體的感受。',
  },
  'yp-04': {
    english: 'Deep Ocean',
    features: ['高壓力包覆', '雙側口袋', '後腰隱形口袋'],
    note: '從瑜珈到重訓，給動作更多支撐。',
  },
  'yp-05': {
    english: 'Soft Breeze',
    features: ['雙側口袋', '輕薄透氣', '入門款'],
    note: '把練習，輕輕放進日常裡。',
  },
  'yp-06': {
    english: 'Everyday Essential',
    features: ['經典黑色', '無口袋', '基本款'],
    note: '一條簡單的黑褲，陪你開始練習。',
  },
  'yt-01': {
    english: 'Cloud Support',
    features: ['中強度支撐', '可拆式胸墊', '雲流同款布料'],
    note: '與雲流瑜珈褲搭配，穿出完整的霧灰色調。',
  },
  'yt-02': {
    english: 'Slow Morning',
    features: ['95% 棉', '寬鬆短版', '課前課後穿搭'],
    note: '下課以後，也繼續自在。',
  },
};

export const swatches = {
  霧灰: '#9aa3ad',
  苔綠: '#6b8f71',
  杏色: '#e8d5c0',
  深藍: '#1f3a5f',
  煙粉: '#d9a5b3',
  黑: '#1a1a1a',
};
export const productImage = (product) => `/images/products/${product.id}.webp`;

export function filterCatalog(items, query = {}) {
  const filters = {
    q: typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '',
    size: ['S', 'M', 'L', 'XL'].includes(query.size) ? query.size : '',
    pockets: query.pockets === 'true',
    max: ['1000', '1200', '1500'].includes(query.max) ? query.max : '',
    sort: ['price-asc', 'price-desc', 'rating'].includes(query.sort)
      ? query.sort
      : '',
  };
  let result = items.filter(
    (x) =>
      (!filters.q ||
        `${x.name} ${x.color} ${x.material} ${productDetails[x.id]?.english || ''}`
          .toLowerCase()
          .includes(filters.q.toLowerCase())) &&
      (!filters.size || x.sizes[filters.size] > 0) &&
      (!filters.pockets || x.pockets) &&
      (!filters.max || x.price <= Number(filters.max)),
  );
  if (filters.sort === 'price-asc') result.sort((a, b) => a.price - b.price);
  if (filters.sort === 'price-desc') result.sort((a, b) => b.price - a.price);
  if (filters.sort === 'rating') result.sort((a, b) => b.rating - a.rating);
  return { items: result, filters };
}
