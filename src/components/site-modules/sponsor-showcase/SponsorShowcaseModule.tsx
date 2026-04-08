"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Award, ExternalLink, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Sponsor {
  id: string
  data: {
    name: string; logo?: string; website?: string; description?: string
    tier: string; socialLinks?: Record<string, string>; promo?: string
  }
  sortOrder: number
}

const TIERS = ["title", "gold", "silver", "bronze", "partner"]
const TIER_LABELS: Record<string, string> = { title: "Title Sponsor", gold: "Gold Sponsors", silver: "Silver Sponsors", bronze: "Bronze Sponsors", partner: "Partners" }
const TIER_SIZES: Record<string, string> = { title: "h-24 sm:h-32", gold: "h-16 sm:h-20", silver: "h-12 sm:h-16", bronze: "h-10 sm:h-12", partner: "h-8 sm:h-10" }

const SAMPLE_SPONSORS: Sponsor[] = [
  { id: "s1", data: { name: "TechCorp", tier: "title", website: "#", description: "Leading technology solutions provider" }, sortOrder: 0 },
  { id: "s2", data: { name: "InnovateLabs", tier: "gold", website: "#", description: "Innovation consulting" }, sortOrder: 1 },
  { id: "s3", data: { name: "CloudBase", tier: "gold", website: "#" }, sortOrder: 2 },
  { id: "s4", data: { name: "DataFlow", tier: "silver", website: "#" }, sortOrder: 3 },
  { id: "s5", data: { name: "DesignStudio", tier: "silver", website: "#" }, sortOrder: 4 },
  { id: "s6", data: { name: "StartupHub", tier: "bronze", website: "#" }, sortOrder: 5 },
]

function SponsorLogo({ sponsor, size, logoStyle }: { sponsor: Sponsor; size: string; logoStyle: string }) {
  const initials = sponsor.data.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div className={`${size} aspect-[2/1] flex items-center justify-center rounded-lg bg-muted/50 px-4 ${
      logoStyle === "grayscale-hover" ? "grayscale hover:grayscale-0 transition-all duration-300" : ""
    }`}>
      {sponsor.data.logo ? (
        <img src={sponsor.data.logo} alt={sponsor.data.name} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-xl font-bold text-muted-foreground/40">{initials}</span>
      )}
    </div>
  )
}

export function SponsorShowcaseModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const tickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPreview) { setSponsors(SAMPLE_SPONSORS); setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/photo-gallery/albums?orgSlug=${orgSlug}&moduleId=sponsor-showcase`)
        const json = await res.json()
        if (json.success) setSponsors(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const sponsorsByTier = TIERS.reduce<Record<string, Sponsor[]>>((acc, tier) => {
    const tierSponsors = sponsors.filter(s => s.data.tier === tier).sort((a, b) => a.sortOrder - b.sortOrder)
    if (tierSponsors.length > 0) acc[tier] = tierSponsors
    return acc
  }, {})

  const logoStyle = config.logoStyle || "grayscale-hover"
  const displayMode = config.displayMode || "grid"

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (sponsors.length === 0) return <p className="text-center text-sm text-muted-foreground py-8">No sponsors yet</p>

  return (
    <div className="space-y-8">
      {displayMode === "ticker" ? (
        <div className="overflow-hidden" ref={tickerRef}>
          <motion.div
            className="flex gap-8 items-center"
            animate={{ x: [0, -50 * sponsors.length] }}
            transition={{ duration: sponsors.length * 3, repeat: Infinity, ease: "linear" }}
          >
            {[...sponsors, ...sponsors].map((sponsor, idx) => (
              <div key={`${sponsor.id}-${idx}`} className="shrink-0 cursor-pointer" onClick={() => config.showProfiles && setSelectedSponsor(sponsor)}>
                <SponsorLogo sponsor={sponsor} size="h-12" logoStyle={logoStyle} />
              </div>
            ))}
          </motion.div>
        </div>
      ) : displayMode === "carousel" ? (
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          {sponsors.map(sponsor => (
            <div key={sponsor.id} className="shrink-0 snap-center cursor-pointer" onClick={() => config.showProfiles && setSelectedSponsor(sponsor)}>
              <SponsorLogo sponsor={sponsor} size={TIER_SIZES[sponsor.data.tier] || "h-16"} logoStyle={logoStyle} />
              <p className="text-xs text-center mt-1 text-muted-foreground">{sponsor.data.name}</p>
            </div>
          ))}
        </div>
      ) : (
        /* Grid grouped by tier */
        Object.entries(sponsorsByTier).map(([tier, tierSponsors]) => (
          <div key={tier} className="space-y-3">
            {config.showTierLabels !== false && (
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">{TIER_LABELS[tier] || tier}</h4>
            )}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              {tierSponsors.map(sponsor => (
                <motion.div
                  key={sponsor.id}
                  className="cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  onClick={() => config.showProfiles ? setSelectedSponsor(sponsor) : sponsor.data.website && window.open(sponsor.data.website, "_blank")}
                >
                  <SponsorLogo sponsor={sponsor} size={TIER_SIZES[tier] || "h-16"} logoStyle={logoStyle} />
                </motion.div>
              ))}
            </div>
          </div>
        ))
      )}

      {config.showBecomeSponsor && (
        <div className="text-center pt-4">
          <a href={config.becomeSponsorLink || "#"} target={config.becomeSponsorLink?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
            <Button variant="outline">
              <Award className="h-4 w-4 mr-1" />Become a Sponsor
            </Button>
          </a>
        </div>
      )}

      {/* Sponsor detail modal */}
      <AnimatePresence>
        {selectedSponsor && (
          <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedSponsor(null)}>
            <motion.div className="bg-background rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <SponsorLogo sponsor={selectedSponsor} size="h-14" logoStyle="full-color" />
                  <div>
                    <h3 className="font-bold text-lg">{selectedSponsor.data.name}</h3>
                    <Badge className="text-[10px]">{TIER_LABELS[selectedSponsor.data.tier] || selectedSponsor.data.tier}</Badge>
                  </div>
                </div>
                <button onClick={() => setSelectedSponsor(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {selectedSponsor.data.description && <p className="text-sm text-muted-foreground">{selectedSponsor.data.description}</p>}
              {selectedSponsor.data.promo && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3"><p className="text-sm font-medium">{selectedSponsor.data.promo}</p></div>
              )}
              {selectedSponsor.data.website && (
                <a href={selectedSponsor.data.website} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-1"><ExternalLink className="h-4 w-4" />Visit Sponsor</Button>
                </a>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium ${className || ""}`}>{children}</span>
}

export default SponsorShowcaseModule
