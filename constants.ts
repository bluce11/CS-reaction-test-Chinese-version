
export const RANKS = [
  { name: '全球精英 (Global Elite)', max: 180, color: 'text-yellow-400' },
  { name: '无上之首席大师 (Supreme)', max: 210, color: 'text-yellow-500' },
  { name: '传奇之鹰 (Legendary Eagle)', max: 240, color: 'text-orange-400' },
  { name: '杰出之大师级守卫 (DMG)', max: 270, color: 'text-orange-500' },
  { name: '卓越之大师级守卫 (MGE)', max: 300, color: 'text-blue-400' },
  { name: '黄金新星导师 (Gold Nova)', max: 350, color: 'text-blue-500' },
  { name: '杰出白银精英 (Silver Elite)', max: 450, color: 'text-gray-400' },
  { name: '白银 I (Silver I)', max: Infinity, color: 'text-gray-500' },
];

export const getRank = (ms: number) => {
  return RANKS.find(r => ms <= r.max) || RANKS[RANKS.length - 1];
};