import { useState, useRef, useEffect } from 'react'

/**
 * CloudinaryVideoPlayer - Embedded Cloudinary video player component
 * Uses Cloudinary's advanced video player with adaptive streaming
 */
export default function CloudinaryVideoPlayer({
    publicId,
    cloudName = 'dqvo133ev', // Replace with your cloud name if different
    url,
    playerUrl,
    className = '',
    autoPlay = false,
    controls = true,
    loop = false,
    muted = false,
    poster = null,
    onPlay = () => { },
    onPause = () => { },
    onEnded = () => { }
}) {
    const videoRef = useRef(null)
    const playerRef = useRef(null)
    const [isPlayerReady, setIsPlayerReady] = useState(false)

    // Dispose player on unmount
    useEffect(() => {
        return () => {
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        }
    }, [])

    // Initialize player when valid publicId is provided
    useEffect(() => {
        if (!publicId || !cloudName || playerRef.current || !window.cloudinary) return;

        try {
            const player = window.cloudinary.videoPlayer(videoRef.current, {
                cloud_name: cloudName,
                secure: true,
                controls: controls,
                autoplay: autoPlay,
                loop: loop,
                muted: muted,
                poster: poster,
                fluid: true,
                showLogo: false,
                colors: {
                    base: "#000000",
                    accent: "#3b82f6",
                    text: "#ffffff"
                }
            });

            player.source(publicId, {
                sourceTypes: ['hls', 'mp4'],
                transformation: {
                    streaming_profile: 'hd',
                    quality: 'auto'
                }
            });

            player.on('play', onPlay);
            player.on('pause', onPause);
            player.on('ended', onEnded);

            playerRef.current = player;
            setIsPlayerReady(true);

        } catch (error) {
            console.error("Failed to initialize Cloudinary player:", error);
        }

    }, [publicId, cloudName])


    // Fallback: If playerUrl (iframe) is explicitly provided
    if (playerUrl) {
        return (
            <div className={`relative rounded-xl overflow-hidden bg-black ${className}`}>
                <iframe
                    src={playerUrl}
                    className="w-full aspect-video"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                />
            </div>
        )
    }

    // Fallback: Direct URL (native player)
    if (url && !publicId) {
        return (
            <div className={`relative rounded-xl overflow-hidden bg-black ${className}`}>
                <video
                    ref={videoRef}
                    src={url}
                    className="w-full aspect-video"
                    controls={controls}
                    autoPlay={autoPlay}
                    loop={loop}
                    muted={muted}
                    poster={poster}
                    onPlay={onPlay}
                    onPause={onPause}
                    onEnded={onEnded}
                />
            </div>
        )
    }

    // Cloudinary Player UI
    if (publicId) {
        return (
            <div className={`relative rounded-xl overflow-hidden bg-black ${className}`}>
                <video
                    ref={videoRef}
                    className="cld-video-player cld-fluid"
                />
                {!isPlayerReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                    </div>
                )}
            </div>
        )
    }

    // No video source provided
    return (
        <div className={`relative rounded-xl overflow-hidden bg-surface-dark flex items-center justify-center aspect-video ${className}`}>
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-text-secondary mb-2">videocam_off</span>
                <p className="text-text-secondary">No video available</p>
            </div>
        </div>
    )
}

/**
 * VideoThumbnail - Clickable video thumbnail that opens player
 */
export function VideoThumbnail({
    thumbnailUrl,
    duration,
    onClick,
    className = ''
}) {
    const formatDuration = (seconds) => {
        if (!seconds) return ''
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div
            className={`relative rounded-lg overflow-hidden cursor-pointer group ${className}`}
            onClick={onClick}
        >
            <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full aspect-video object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-5xl text-white">play_circle</span>
            </div>
            {duration && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {formatDuration(duration)}
                </div>
            )}
        </div>
    )
}
