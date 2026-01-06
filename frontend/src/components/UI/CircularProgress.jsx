export default function CircularProgress({ value, size = 80, strokeWidth = 2, label }) {
    const radius = 15.9155
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = `${value}, 100`

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <path
                    className="text-zinc-800"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <path
                    className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={strokeDasharray}
                    strokeLinecap="round"
                    strokeWidth={strokeWidth}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-xl font-bold text-white">
                    {value}<span className="text-xs text-zinc-500">%</span>
                </span>
                {label && <span className="text-[10px] text-zinc-500 uppercase">{label}</span>}
            </div>
        </div>
    )
}
