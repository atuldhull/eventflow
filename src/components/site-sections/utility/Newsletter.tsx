"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Send, CheckCircle, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { SectionProps } from "@/lib/site-builder/section-renderer"
import { SECTION_DARK_BG, SECTION_WHITE_TEXT, SECTION_SUCCESS_GREEN } from "@/lib/site-builder/section-constants"

export function Newsletter({ config, content, siteStyles, isPreview }: SectionProps) {
  const [email, setEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const layout = config.layout || "card"
  const bg = config.background || "transparent"

  const bgStyles: Record<string, React.CSSProperties> = {
    transparent: { backgroundColor: siteStyles.backgroundColor },
    primary: { backgroundColor: siteStyles.primaryColor },
    dark: { backgroundColor: SECTION_DARK_BG },
  }
  const isLight = bg === "transparent"
  const textColor = isLight ? siteStyles.textColor : SECTION_WHITE_TEXT

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) { toast.error("Please enter a valid email"); return }
    if (isPreview) { toast.info("Subscription disabled in preview"); return }
    setIsSending(true)
    try {
      await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Newsletter", email, subject: "newsletter", message: "Newsletter subscription" }) })
      setSubscribed(true)
      toast.success("Subscribed!")
    } catch { toast.error("Failed") }
    finally { setIsSending(false) }
  }

  const formContent = subscribed ? (
    <motion.div className="flex items-center gap-2 justify-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <CheckCircle className="h-5 w-5" style={{ color: isLight ? siteStyles.primaryColor : SECTION_SUCCESS_GREEN }} />
      <span className="font-medium" style={{ color: textColor }}>Subscribed!</span>
    </motion.div>
  ) : layout === "inline" ? (
    <div className="flex gap-2 max-w-md mx-auto">
      <Input placeholder={content.placeholder || "Enter your email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={isLight ? "" : "bg-white/10 border-white/20 text-white placeholder:text-white/50"} />
      <Button onClick={handleSubmit} disabled={isSending} style={isLight ? { backgroundColor: siteStyles.primaryColor, color: "#fff" } : { backgroundColor: "#fff", color: siteStyles.primaryColor }}>
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : content.buttonText || "Subscribe"}
      </Button>
    </div>
  ) : (
    <div className="space-y-3 max-w-sm mx-auto">
      <Input placeholder={content.placeholder || "Enter your email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={isLight ? "" : "bg-white/10 border-white/20 text-white placeholder:text-white/50"} />
      <Button onClick={handleSubmit} disabled={isSending} className="w-full gap-2" style={isLight ? { backgroundColor: siteStyles.primaryColor, color: "#fff" } : { backgroundColor: "#fff", color: siteStyles.primaryColor }}>
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" />{content.buttonText || "Subscribe"}</>}
      </Button>
      <p className="text-xs text-center opacity-40" style={{ color: textColor }}>No spam, unsubscribe anytime</p>
    </div>
  )

  return (
    <section className={layout === "card" ? "py-0" : ""} style={bgStyles[bg] || bgStyles.transparent}>
      <div className="container mx-auto px-4">
        <motion.div className={layout === "card" ? "max-w-lg mx-auto rounded-2xl p-8 shadow-lg" : ""} style={layout === "card" ? { backgroundColor: isLight ? siteStyles.primaryColor + "08" : undefined, borderRadius: siteStyles.borderRadius } : {}}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {content.heading && <h3 className="text-xl sm:text-2xl font-bold text-center mb-2" style={{ color: textColor }}>{content.heading}</h3>}
          {content.subtitle && <p className="text-sm text-center opacity-60 mb-6" style={{ color: textColor }}>{content.subtitle}</p>}
          {formContent}
        </motion.div>
      </div>
    </section>
  )
}

export default Newsletter
