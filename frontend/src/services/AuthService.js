/**
 * Auth Service
 * Handles authentication with Google OAuth
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class AuthService {
    constructor(apiService) {
        this.apiService = apiService;
    }

    /**
     * Check current authentication status
     */
    async checkStatus() {
        return this.apiService.get('/auth/status');
    }

    /**
     * Initiate Google OAuth login
     */
    login() {
        // Redirect to backend OAuth endpoint
        window.location.href = `${API_URL}/auth/google`;
    }

    /**
     * Logout current user
     */
    async logout() {
        return this.apiService.post('/auth/logout');
    }

    /**
     * Refresh access token
     */
    async refreshToken() {
        return this.apiService.post('/auth/refresh');
    }
}
