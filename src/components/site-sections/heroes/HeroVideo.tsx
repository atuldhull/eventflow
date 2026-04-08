"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Play, Pause } from "lucide-react"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

export function HeroVideo({ config, content, siteStyles }: SectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(config.autoplay !== false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) { videoRef.current.pause() } else { videoRef.current.play() }
    setIsPlaying(!isPlaying)
  }

  const title = content.title || "Experience Something Extraordinary"
  const words = title.split(" ")

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Video / Fallback */}
      {!isMobile && content.videoUrl ? (
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay={config.autoplay !== false} muted={config.muted !== false} loop={config.loop !== false} playsInline preload="metadata" poster={content.fallbackImage || undefined}>
          <source src={content.videoUrl} type="video/mp4" />
        </video>
      ) : content.fallbackImage ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${content.fallbackImage})` }} />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${siteStyles.primaryColor}, ${siteStyles.secondaryColor})` }} />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black" style={{ opacity: (config.overlayOpacity || 50) / 100 }} />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center max-w-4xl">
        <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
          {words.map((word: string, i: number) => (
            <motion.span key={i} className="inline-block mr-[0.3em]" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}>
              {word}
            </motion.span>
          ))}
        </h1>
        {content.subtitle && (
          <motion.p className="mt-6 text-base sm:text-lg text-white/70 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.6 }}>
            {content.subtitle}
          </motion.p>
        )}
        {content.ctaButtons?.length > 0 && (
          <motion.div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            {content.ctaButtons.map((btn: any, i: number) => (
              <Link key={i} href={btn.href || "#"} className={`px-8 py-3 rounded-xl font-medium transition-all hover:scale-105 ${btn.variant === "primary" ? "text-white shadow-lg" : "border border-white/30 text-white hover:bg-white/10"}`}
                style={btn.variant === "primary" ? { backgroundColor: siteStyles.primaryColor } : {}}>
                {btn.text}
              </Link>
            ))}
          </motion.div>
        )}
      </div>

      {/* Play/Pause control */}
      {config.showControls && !isMobile && content.videoUrl && (
        <button onClick={togglePlay} className="absolute bottom-6 right-6 z-20 p-3 rounded-full bg-black/30 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/50 transition-all">
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
      )}
    </section>
  )
}
