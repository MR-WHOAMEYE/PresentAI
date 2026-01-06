import { createContext, useContext, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
    const [currentSession, setCurrentSession] = useState(null)
    const [sessions, setSessions] = useState([])
    const [presentation, setPresentation] = useState(null)
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
    const [metrics, setMetrics] = useState({
        postureScore: 0,
        eyeContactPercent: 0,
        gestureType: 'none',
        speechRate: 0,
        fillerCount: 0,
        fillerWords: [],
        confidence: 0
    })
    const [transcript, setTranscript] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [isPracticing, setIsPracticing] = useState(false)
    const [sessionStartTime, setSessionStartTime] = useState(null)
    const [aiFeedback, setAiFeedback] = useState(null)
    const [recordingBlobUrl, setRecordingBlobUrl] = useState(null)

    async function fetchSessions() {
        try {
            const response = await fetch(`${API_URL}/sessions`, { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setSessions(data.sessions || [])
            }
        } catch (error) {
            console.error('Failed to fetch sessions:', error)
        }
    }

    async function createSession(presentationId, presentationTitle) {
        try {
            const response = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presentationId, presentationTitle })
            })
            if (response.ok) {
                const data = await response.json()
                setCurrentSession(data.session)
                return data.session
            }
        } catch (error) {
            console.error('Failed to create session:', error)
        }
        return null
    }

    async function completeSession(sessionData) {
        if (!currentSession) return

        try {
            const response = await fetch(`${API_URL}/sessions/${currentSession.id}/complete`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            })
            if (response.ok) {
                const data = await response.json()
                setCurrentSession(data.session)
                return data.session
            }
        } catch (error) {
            console.error('Failed to complete session:', error)
        }
        return null
    }

    function updateMetrics(newMetrics) {
        setMetrics(prev => ({ ...prev, ...newMetrics }))
    }

    function nextSlide() {
        if (presentation?.slides) {
            setCurrentSlideIndex(prev =>
                Math.min(prev + 1, presentation.slides.length - 1)
            )
        }
    }

    function prevSlide() {
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0))
    }

    function resetSession() {
        setCurrentSession(null)
        setPresentation(null)
        setCurrentSlideIndex(0)
        setMetrics({
            postureScore: 0,
            eyeContactPercent: 0,
            gestureType: 'none',
            speechRate: 0,
            fillerCount: 0,
            fillerWords: [],
            confidence: 0
        })
        setTranscript('')
        setIsRecording(false)
        setIsPracticing(false)
        setSessionStartTime(null)
        setAiFeedback(null)
        if (recordingBlobUrl) URL.revokeObjectURL(recordingBlobUrl)
        setRecordingBlobUrl(null)
    }

    return (
        <SessionContext.Provider value={{
            currentSession,
            setCurrentSession,
            sessions,
            fetchSessions,
            createSession,
            completeSession,
            presentation,
            setPresentation,
            currentSlideIndex,
            setCurrentSlideIndex,
            nextSlide,
            prevSlide,
            metrics,
            updateMetrics,
            transcript,
            setTranscript,
            isRecording,
            setIsRecording,
            isPracticing,
            setIsPracticing,
            sessionStartTime,
            setSessionStartTime,
            aiFeedback,
            setAiFeedback,
            recordingBlobUrl,
            setRecordingBlobUrl,
            resetSession
        }}>
            {children}
        </SessionContext.Provider>
    )
}

export function useSession() {
    const context = useContext(SessionContext)
    if (!context) {
        throw new Error('useSession must be used within SessionProvider')
    }
    return context
}
