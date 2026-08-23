export const CARD_RARITIES = Object.freeze({
  COMMON: Object.freeze({
    name: 'Обычная',
    border: 'border-slate-500',
    header: 'bg-[#4a3b69]',
    text: 'text-slate-300',
    badgeBg: 'bg-slate-500',
  }),
  RARE: Object.freeze({
    name: 'Редкая',
    border: 'border-[#0EA5E9]',
    header: 'bg-[#3b5384]',
    text: 'text-[#0EA5E9]',
    badgeBg: 'bg-[#0EA5E9]',
  }),
  EPIC: Object.freeze({
    name: 'Эпическая',
    border: 'border-purple-600',
    header: 'bg-[#7a3b3b]',
    text: 'text-purple-300',
    badgeBg: 'bg-purple-600',
  }),
  LEGENDARY: Object.freeze({
    name: 'Легендарная',
    border: 'border-amber-400',
    header: 'bg-[#8a6b3b]',
    text: 'text-amber-400',
    badgeBg: 'bg-amber-500',
  }),
});

export const CARD_RARITY_GLOW = Object.freeze({
  COMMON: '#64748b',
  RARE: '#0ea5e9',
  EPIC: '#9333ea',
  LEGENDARY: '#f59e0b',
});
