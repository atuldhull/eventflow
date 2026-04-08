"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, X, ExternalLink, Mail, Globe, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface TeamMember {
  id: string
  data: {
    name: string; role: string; avatar?: string; bio?: string; email?: string
    department?: string; skills?: string[]
    social?: { linkedin?: string; twitter?: string; github?: string; website?: string }
  }
  sortOrder: number
}

const SAMPLE_MEMBERS: TeamMember[] = [
  { id: "m1", data: { name: "Priya Sharma", role: "Founder & CEO", bio: "Passionate about building communities through technology.", department: "Leadership", skills: ["Strategy", "Product"], social: { linkedin: "#", twitter: "#" } }, sortOrder: 0 },
  { id: "m2", data: { name: "Rahul Mehta", role: "CTO", bio: "Full-stack engineer with 10+ years of experience.", department: "Engineering", skills: ["React", "Node.js", "DevOps"], social: { github: "#", linkedin: "#" } }, sortOrder: 1 },
  { id: "m3", data: { name: "Anita Desai", role: "Head of Events", bio: "Organized 100+ community events across the country.", department: "Operations", skills: ["Event Management", "Logistics"], social: { linkedin: "#" } }, sortOrder: 2 },
  { id: "m4", data: { name: "Vikram Singh", role: "Designer", department: "Design", skills: ["UI/UX", "Branding"], social: { linkedin: "#" } }, sortOrder: 3 },
  { id: "m5", data: { name: "Sneha Reddy", role: "Marketing Lead", department: "Marketing", skills: ["SEO", "Social Media"], social: {} }, sortOrder: 4 },
  { id: "m6", data: { name: "Karan Joshi", role: "Developer", department: "Engineering", skills: ["React", "TypeScript"], social: { github: "#" } }, sortOrder: 5 },
]

function Initials({ name, size = "w-20 h-20" }: { name: string; size?: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary`}>{initials}</div>
}

const CARD_STYLES: Record<string, string> = {
  minimal: "bg-transparent border-0 shadow-none",
  bordered: "border-2",
  elevated: "shadow-md hover:shadow-lg",
  glass: "bg-white/5 backdrop-blur-sm border border-white/10",
}

export function TeamProfilesModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeDept, setActiveDept] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isPreview) { setMembers(SAMPLE_MEMBERS); setIsLoading(false); return }
    async function fetch_() {
      try {
        const res = await fetch(`/api/modules/photo-gallery/albums?orgSlug=${orgSlug}&moduleId=team-profiles`)
        const json = await res.json()
        if (json.success) setMembers(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, isPreview])

  const departments = useMemo(() => {
    const depts = new Set<string>()
    members.forEach(m => { if (m.data.department) depts.add(m.data.department) })
    return Array.from(depts)
  }, [members])

  const filtered = useMemo(() => {
    let result = members
    if (searchQuery) result = result.filter(m => m.data.name.toLowerCase().includes(searchQuery.toLowerCase()))
    if (activeDept) result = result.filter(m => m.data.department === activeDept)
    return result.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [members, searchQuery, activeDept])

  const columns = config.columns || "3"
  const cardStyle = CARD_STYLES[config.cardStyle || "elevated"] || ""
  const colClass = columns === "2" ? "grid-cols-1 sm:grid-cols-2" : columns === "4" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5" /> Our Team</h3>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search team..." className="pl-8 h-9 text-sm" />
        </div>
      </div>

      {/* Department filter */}
      {config.groupByRole && departments.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setActiveDept(null)} className={`px-3 py-1 rounded-full text-xs transition-colors ${!activeDept ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>All</button>
          {departments.map(dept => (
            <button key={dept} onClick={() => setActiveDept(dept)} className={`px-3 py-1 rounded-full text-xs transition-colors ${activeDept === dept ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>{dept}</button>
          ))}
        </div>
      )}

      {/* Grid */}
      {config.layout === "list" ? (
        <div className="space-y-3">
          {filtered.map((member, idx) => (
            <motion.div key={member.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}>
              <Card className={`p-4 flex items-center gap-4 cursor-pointer transition-all ${cardStyle}`} onClick={() => config.showDetailModal !== false && setSelectedMember(member)}>
                <Initials name={member.data.name} size="w-12 h-12 text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{member.data.name}</p>
                  <p className="text-xs text-muted-foreground">{member.data.role}</p>
                </div>
                {config.showSocial !== false && member.data.social && (
                  <div className="flex gap-1">{Object.entries(member.data.social).filter(([, v]) => v).slice(0, 3).map(([k]) => <span key={k} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><SocialIcon platform={k} /></span>)}</div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className={`grid ${colClass} gap-4`}>
          {filtered.map((member, idx) => (
            <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <Card
                className={`p-6 text-center cursor-pointer transition-all ${cardStyle}`}
                onClick={() => config.showDetailModal !== false && setSelectedMember(member)}
              >
                <div className="flex justify-center mb-3">
                  {member.data.avatar ? (
                    <img src={member.data.avatar} alt={member.data.name} className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <Initials name={member.data.name} />
                  )}
                </div>
                <h4 className="font-semibold">{member.data.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{member.data.role}</p>
                {config.showSocial !== false && member.data.social && (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {Object.entries(member.data.social).filter(([, v]) => v).map(([platform, url]) => (
                      <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                        <SocialIcon platform={platform} />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {config.showJoinCTA && config.joinLink && (
        <div className="text-center pt-4">
          <a href={config.joinLink} target="_blank" rel="noopener noreferrer"><Button variant="outline"><Users className="h-4 w-4 mr-1" />Join Our Team</Button></a>
        </div>
      )}

      {/* Profile modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedMember(null)}>
            <motion.div className="bg-background rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-end"><button onClick={() => setSelectedMember(null)}><X className="h-5 w-5 text-muted-foreground" /></button></div>
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  {selectedMember.data.avatar ? <img src={selectedMember.data.avatar} alt={selectedMember.data.name} className="w-24 h-24 rounded-full object-cover" /> : <Initials name={selectedMember.data.name} size="w-24 h-24 text-2xl" />}
                </div>
                <h3 className="text-xl font-bold">{selectedMember.data.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedMember.data.role}</p>
              </div>
              {selectedMember.data.bio && <p className="text-sm text-muted-foreground text-center">{selectedMember.data.bio}</p>}
              {selectedMember.data.skills && selectedMember.data.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center">{selectedMember.data.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>
              )}
              <div className="flex justify-center gap-2 pt-2">
                {selectedMember.data.social && Object.entries(selectedMember.data.social).filter(([, v]) => v).map(([platform, url]) => (
                  <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon-sm"><SocialIcon platform={platform} /></Button></a>
                ))}
                {selectedMember.data.email && (
                  <a href={`mailto:${selectedMember.data.email}`}><Button variant="outline" size="sm"><Mail className="h-3.5 w-3.5 mr-1" />Contact</Button></a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SocialIcon({ platform }: { platform: string }) {
  const size = "h-3.5 w-3.5"
  if (platform === "linkedin") return <ExternalLink className={size} />
  if (platform === "github") return <ExternalLink className={size} />
  if (platform === "website") return <Globe className={size} />
  if (platform === "twitter") return <ExternalLink className={size} />
  return <Globe className={size} />
}

export default TeamProfilesModule
