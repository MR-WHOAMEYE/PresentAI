import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SessionProvider } from './contexts/SessionContext'
import DashboardPage from './pages/DashboardPage'
import PracticePage from './pages/PracticePage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'
import FeedbackPage from './pages/FeedbackPage'

function App() {
    return (
        <AuthProvider>
            <SessionProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/practice" element={<PracticePage />} />
                        <Route path="/progress" element={<ProgressPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/feedback" element={<FeedbackPage />} />
                    </Routes>
                </BrowserRouter>
            </SessionProvider>
        </AuthProvider>
    )
}

export default App
