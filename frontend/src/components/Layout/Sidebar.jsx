import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'

const LogoIcon = () => (
    <svg className="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path clipRule="evenodd" d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z" fill="currentColor" fillRule="evenodd" />
    </svg>
)

const navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard' },
    { path: '/practice', icon: 'videocam', label: 'Practice' },
    { path: '/progress', icon: 'trending_up', label: 'Progress' },
    { path: '/settings', icon: 'settings', label: 'Settings' },
]

export default function Sidebar({ collapsed = false, hideMobileNav = false }) {
    const location = useLocation()
    const { user, isAuthenticated, login, logout } = useAuth()
    const [mobileOpen, setMobileOpen] = useState(false)

    const SidebarContent = ({ isMobile = false }) => (
        <>
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-border-dark">
                <div className="flex items-center gap-3 text-white">
                    <div className="size-6 text-primary"><LogoIcon /></div>
                    {(!collapsed || isMobile) && <h2 className="text-white text-lg font-bold tracking-tight">PresentAI</h2>}
                </div>
                {isMobile && (
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="ml-auto p-2 text-zinc-400 hover:text-white"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            <div className="flex flex-col justify-between flex-1 p-4 overflow-y-auto">
                <div className="flex flex-col gap-2">
                    {/* User Profile */}
                    {isAuthenticated && user && (
                        <div className={`flex gap-3 mb-6 p-2 rounded-lg bg-surface-highlight border border-border-dark items-center ${collapsed && !isMobile ? 'justify-center' : ''}`}>
                            <div
                                className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0 border border-border-dark"
                                style={{ backgroundImage: user.picture ? `url("${user.picture}")` : 'none', backgroundColor: '#3b82f6' }}
                            >
                                {!user.picture && (
                                    <div className="w-full h-full flex items-center justify-center text-white font-bold">
                                        {user.name?.[0] || 'U'}
                                    </div>
                                )}
                            </div>
                            {(!collapsed || isMobile) && (
                                <div className="flex flex-col overflow-hidden">
                                    <h1 className="text-white text-sm font-semibold truncate">{user.name || 'User'}</h1>
                                    <p className="text-zinc-500 text-xs font-medium truncate">{user.email}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Login Button */}
                    {!isAuthenticated && (
                        <Link
                            to="/login"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary text-white hover:bg-blue-600 transition-colors mb-4"
                        >
                            <span className="material-symbols-outlined text-[20px]">login</span>
                            {(!collapsed || isMobile) && <span className="text-sm font-medium">Login / Sign Up</span>}
                        </Link>
                    )}

                    {/* Navigation */}
                    <div className="space-y-1">
                        {navItems.map(item => {
                            const isActive = location.pathname === item.path
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => isMobile && setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                                        ? 'bg-white text-black shadow-lg shadow-white/5'
                                        : 'text-zinc-400 hover:text-white hover:bg-surface-highlight'
                                        } ${collapsed && !isMobile ? 'justify-center' : ''}`}
                                >
                                    <span
                                        className="material-symbols-outlined text-[20px]"
                                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                                    >
                                        {item.icon}
                                    </span>
                                    {(!collapsed || isMobile) && <p className="text-sm font-medium">{item.label}</p>}
                                </Link>
                            )
                        })}
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="space-y-1 border-t border-border-dark pt-4">
                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-highlight transition-colors">
                        <span className="material-symbols-outlined text-[20px]">help</span>
                        {(!collapsed || isMobile) && <p className="text-sm font-medium">Help & Support</p>}
                    </a>
                    {isAuthenticated && (
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                            {(!collapsed || isMobile) && <p className="text-sm font-medium">Sign Out</p>}
                        </button>
                    )}
                </div>
            </div>
        </>
    )

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-app-bg border-r border-border-dark flex-col hidden lg:flex shrink-0 z-20 h-full`}>
                <SidebarContent />
            </aside>

            {/* Mobile Bottom Navigation */}
            {!hideMobileNav && (
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-dark border-t border-border-dark safe-area-bottom">
                    <div className="flex items-center justify-around h-16">
                        {navItems.map(item => {
                            const isActive = location.pathname === item.path
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${isActive ? 'text-primary' : 'text-zinc-500'
                                        }`}
                                >
                                    <span
                                        className="material-symbols-outlined text-[22px]"
                                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                                    >
                                        {item.icon}
                                    </span>
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </Link>
                            )
                        })}
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-zinc-500"
                        >
                            <span className="material-symbols-outlined text-[22px]">menu</span>
                            <span className="text-[10px] font-medium">More</span>
                        </button>
                    </div>
                </nav>
            )}

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-[100]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    {/* Drawer */}
                    <aside className="absolute left-0 top-0 bottom-0 w-72 bg-app-bg flex flex-col animate-slide-in-left">
                        <SidebarContent isMobile />
                    </aside>
                </div>
            )}
        </>
    )
}

export { LogoIcon }
