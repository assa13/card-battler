import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Dev-маршруты по хешу. Основная dungeon-карта уже подключена внутри App;
// #dungeon лишь пропускает прелоадер и таверну для быстрой проверки.
// Остальные лабораторные экраны в production-бандл не попадают.
const DEV_ROUTES = import.meta.env.DEV
  ? {
      '#uikit': lazy(() => import('./dev/UiKitGallery.jsx')),
      '#battle': lazy(() => import('./battle/BattleScreen.jsx')),
      '#dungeon': lazy(() => import('./dev/DungeonTest.jsx')),
    }
  : {}

const matchRoute = () =>
  Object.keys(DEV_ROUTES).find((hash) => window.location.hash.startsWith(hash)) ?? null

const route = matchRoute()
const DevScreen = route ? DEV_ROUTES[route] : null

// Маршрут читается один раз при старте, поэтому смену хеша в адресной строке
// нужно доигрывать перезагрузкой — иначе останется уже смонтированное дерево.
if (import.meta.env.DEV) {
  window.addEventListener('hashchange', () => {
    if (matchRoute() !== route) window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {DevScreen
      ? <Suspense fallback={null}><DevScreen /></Suspense>
      : <App />}
  </StrictMode>,
)
