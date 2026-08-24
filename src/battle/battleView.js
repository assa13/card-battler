import { createContext, useContext } from 'react';

// Снимок боя для нового экрана.
//
// App остаётся владельцем состояния: ни один useState сюда не переезжает, здесь
// только готовые к отрисовке значения. Так сделано намеренно — боевое состояние
// в App неотделимо от run-state (players, equipped, inventory, колоды, XP и
// прогресс по карте читают ещё таверна, магазин и инвентарь), а вместе с ним
// поехали бы замыкания таймеров playCard и асинхронная фаза врага.
//
// Считать урон и описания карт умеет только App: getCardDamage,
// getCardDescription и getEffectivePlayer живут в его модульной области и
// наружу не экспортируются. Поэтому контекст отдаёт уже посчитанный текст, а
// экран остаётся тупым рендером.
//
// Форма снимка — см. battleView в App.jsx.
export const BattleViewContext = createContext(null);

/** Снимок боя или null, если экран открыт вне игры (dev-роут #battle). */
export const useBattleView = () => useContext(BattleViewContext);
