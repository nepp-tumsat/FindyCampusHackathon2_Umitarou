import { createRoot } from 'react-dom/client'
import App from './app'
import RestaurantApp from './restaurants/RestaurantApp'

const rootElement = document.getElementById('root')!

const root = createRoot(rootElement)
root.render(window.location.pathname.startsWith('/restaurants') ? <RestaurantApp /> : <App />)
