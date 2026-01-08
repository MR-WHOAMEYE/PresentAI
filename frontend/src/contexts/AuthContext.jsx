import { createContext, useContext, useState, useEffect } from 'react'
import { firebaseAuthService } from '../services/firebase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [hasGoogleDriveAccess, setHasGoogleDriveAccess] = useState(false)

    useEffect(() => {
        // Listen to Firebase auth state changes
        const unsubscribe = firebaseAuthService.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in with Firebase
                const userData = {
                    id: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName,
                    picture: firebaseUser.photoURL
                }
                setUser(userData)
                setIsAuthenticated(true)

                // Sync with backend and check Google Drive access
                await syncWithBackend(firebaseUser)
            } else {
                setUser(null)
                setIsAuthenticated(false)
                setHasGoogleDriveAccess(false)
            }
            setLoading(false)
        })

        // Check for redirect result (mobile Google sign-in)
        firebaseAuthService.getRedirectResult().catch(console.error)

        return () => unsubscribe()
    }, [])

    /**
     * Sync Firebase user with backend
     */
    async function syncWithBackend(firebaseUser) {
        try {
            const idToken = await firebaseUser.getIdToken()

            const response = await fetch(`${API_URL}/auth/firebase-sync`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName,
                    picture: firebaseUser.photoURL
                })
            })

            if (response.ok) {
                const data = await response.json()
                setHasGoogleDriveAccess(data.hasGoogleToken || false)

                // Update user with backend data if available
                if (data.user) {
                    setUser(prev => ({ ...prev, ...data.user }))
                }
            }
        } catch (error) {
            console.error('Failed to sync with backend:', error)
        }
    }

    /**
     * Login with Google (Firebase Auth)
     */
    async function loginWithGoogle() {
        try {
            const { user: firebaseUser } = await firebaseAuthService.signInWithGoogle()
            return firebaseUser
        } catch (error) {
            console.error('Google login failed:', error)
            throw error
        }
    }

    /**
     * Login with email/password (Firebase Auth)
     */
    async function loginWithEmail(email, password) {
        try {
            const { user: firebaseUser } = await firebaseAuthService.signInWithEmail(email, password)
            return firebaseUser
        } catch (error) {
            console.error('Email login failed:', error)
            throw error
        }
    }

    /**
     * Sign up with email/password (Firebase Auth)
     */
    async function signUpWithEmail(email, password, displayName) {
        try {
            const { user: firebaseUser } = await firebaseAuthService.signUpWithEmail(email, password, displayName)
            return firebaseUser
        } catch (error) {
            console.error('Sign up failed:', error)
            throw error
        }
    }

    /**
     * Connect Google Slides/Drive (OAuth - separate from Firebase login)
     * This opens the backend OAuth flow to get Slides/Drive permissions
     */
    function connectGoogleDrive() {
        // Store current URL to redirect back after OAuth
        sessionStorage.setItem('oauth_return_url', window.location.href)
        window.location.href = `${API_URL}/auth/google`
    }

    /**
     * Logout from Firebase
     */
    async function logout() {
        try {
            await firebaseAuthService.signOut()

            // Also clear backend session
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            })

            setUser(null)
            setIsAuthenticated(false)
            setHasGoogleDriveAccess(false)
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    /**
     * Get Firebase ID token for API calls
     */
    async function getIdToken() {
        return firebaseAuthService.getIdToken()
    }

    /**
     * Get error message from Firebase error
     */
    function getErrorMessage(error) {
        return firebaseAuthService.getErrorMessage(error)
    }

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            loading,
            hasGoogleDriveAccess,
            loginWithGoogle,
            loginWithEmail,
            signUpWithEmail,
            connectGoogleDrive,
            logout,
            getIdToken,
            getErrorMessage,
            // Legacy compatibility
            login: loginWithGoogle,
            checkAuthStatus: () => { }
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
