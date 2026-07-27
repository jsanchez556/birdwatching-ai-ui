import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import analytics from './analytics/analytics'
import './index.css'

analytics.initialize()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
