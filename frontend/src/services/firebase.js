/**
 * Firebase Configuration and Initialization
 * Used for user authentication (login/signup)
 */
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add scopes for basic profile info only (NOT for Slides/Drive)
googleProvider.addScope('email');
googleProvider.addScope('profile');

/**
 * Firebase Auth Service
 * Handles user authentication separate from Google Slides/Drive OAuth
 */
export const firebaseAuthService = {
    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return auth.currentUser;
    },

    /**
     * Subscribe to auth state changes
     */
    onAuthStateChanged(callback) {
        return onAuthStateChanged(auth, callback);
    },

    /**
     * Sign in with Google popup
     */
    async signInWithGoogle() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return {
                user: result.user,
                idToken: await result.user.getIdToken()
            };
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    },

    /**
     * Sign in with Google redirect (for mobile)
     */
    async signInWithGoogleRedirect() {
        try {
            await signInWithRedirect(auth, googleProvider);
        } catch (error) {
            console.error('Google redirect error:', error);
            throw error;
        }
    },

    /**
     * Get redirect result after Google sign-in redirect
     */
    async getRedirectResult() {
        try {
            const result = await getRedirectResult(auth);
            if (result) {
                return {
                    user: result.user,
                    idToken: await result.user.getIdToken()
                };
            }
            return null;
        } catch (error) {
            console.error('Redirect result error:', error);
            throw error;
        }
    },

    /**
     * Sign up with email and password
     */
    async signUpWithEmail(email, password, displayName) {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);

            // Update display name
            if (displayName) {
                await updateProfile(result.user, { displayName });
            }

            return {
                user: result.user,
                idToken: await result.user.getIdToken()
            };
        } catch (error) {
            console.error('Email sign-up error:', error);
            throw error;
        }
    },

    /**
     * Sign in with email and password
     */
    async signInWithEmail(email, password) {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return {
                user: result.user,
                idToken: await result.user.getIdToken()
            };
        } catch (error) {
            console.error('Email sign-in error:', error);
            throw error;
        }
    },

    /**
     * Sign out
     */
    async signOut() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Sign-out error:', error);
            throw error;
        }
    },

    /**
     * Get ID token for backend authentication
     */
    async getIdToken(forceRefresh = false) {
        const user = auth.currentUser;
        if (!user) return null;
        return user.getIdToken(forceRefresh);
    },

    /**
     * Parse Firebase error codes to user-friendly messages
     */
    getErrorMessage(error) {
        const errorCode = error.code;
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'This email is already registered. Please sign in instead.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/operation-not-allowed':
                return 'This sign-in method is not enabled.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed. Please try again.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection.';
            default:
                return error.message || 'An error occurred. Please try again.';
        }
    }
};

export { auth, googleProvider };
export default app;
