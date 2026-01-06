import { useState, useEffect } from 'react'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(onClose, 300) // Wait for animation
        }, duration)

        return () => clearTimeout(timer)
    }, [duration, onClose])

    const bgColors = {
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400'
    }

    const icons = {
        info: 'info',
        success: 'check_circle',
        warning: 'warning',
        error: 'error'
    }

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColors[type]} backdrop-blur-md shadow-2xl transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}
        >
            <span className="material-symbols-outlined text-[20px]">{icons[type]}</span>
            <span className="text-sm font-medium">{message}</span>
            <button
                onClick={() => { setIsVisible(false); onClose() }}
                className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
            >
                <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
        </div>
    )
}

// Toast container for managing multiple toasts
export function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    )
}
