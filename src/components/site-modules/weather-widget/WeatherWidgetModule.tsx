"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CloudSun, Droplets, Wind, Thermometer, AlertCircle, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface WeatherData {
  temp: number
  condition: string
  icon: string
  humidity: number
  wind: number
  high: number
  low: number
  city: string
  forecast?: { day: string; high: number; low: number; icon: string; condition: string }[]
  lastUpdated?: string
}

const WEATHER_ICONS: Record<string, string> = {
  clear: "\u2600\uFE0F",
  sunny: "\u2600\uFE0F",
  "partly cloudy": "\u26C5",
  cloudy: "\u2601\uFE0F",
  overcast: "\u2601\uFE0F",
  rain: "\uD83C\uDF27\uFE0F",
  drizzle: "\uD83C\uDF26\uFE0F",
  thunderstorm: "\u26C8\uFE0F",
  snow: "\u2744\uFE0F",
  fog: "\uD83C\uDF2B\uFE0F",
  mist: "\uD83C\uDF2B\uFE0F",
  haze: "\uD83C\uDF2B\uFE0F",
}

function getWeatherEmoji(condition: string): string {
  const lower = condition.toLowerCase()
  for (const [key, emoji] of Object.entries(WEATHER_ICONS)) {
    if (lower.includes(key)) return emoji
  }
  return "\u2600\uFE0F"
}

const SAMPLE_WEATHER: WeatherData = {
  temp: 28, condition: "Partly Cloudy", icon: "partly-cloudy", humidity: 65, wind: 12,
  high: 32, low: 22, city: "Mumbai",
  forecast: [
    { day: "Tomorrow", high: 33, low: 23, icon: "sunny", condition: "Sunny" },
    { day: "Wed", high: 30, low: 24, icon: "rain", condition: "Rain" },
    { day: "Thu", high: 29, low: 22, icon: "cloudy", condition: "Cloudy" },
  ],
}

export function WeatherWidgetModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isPreview) { setWeather(SAMPLE_WEATHER); setIsLoading(false); return }
    async function fetch_() {
      try {
        const city = config.city || ""
        if (!city) { setError("No city configured"); setIsLoading(false); return }
        const res = await fetch(`/api/modules/weather?city=${encodeURIComponent(city)}&units=${config.units || "celsius"}`)
        const json = await res.json()
        if (json.success) setWeather(json.data)
        else setError(json.message || "Weather data unavailable")
      } catch { setError("Failed to fetch weather") } finally { setIsLoading(false) }
    }
    fetch_()
  }, [config.city, config.units, isPreview])

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>

  if (error) {
    return (
      <Card className="p-4 text-center">
        <AlertCircle className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">{error}</p>
      </Card>
    )
  }

  if (!weather) return null

  const unit = config.units === "fahrenheit" ? "\u00B0F" : "\u00B0C"
  const emoji = getWeatherEmoji(weather.condition)
  const style = config.style || "compact"

  if (style === "detailed") {
    return (
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{weather.city}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-bold">{Math.round(weather.temp)}{unit}</span>
              <span className="text-3xl">{emoji}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{weather.condition}</p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p className="flex items-center gap-1 justify-end"><Thermometer className="h-3.5 w-3.5" />H: {Math.round(weather.high)}{unit} / L: {Math.round(weather.low)}{unit}</p>
            {config.showHumidity !== false && <p className="flex items-center gap-1 justify-end"><Droplets className="h-3.5 w-3.5" />{weather.humidity}%</p>}
            {config.showWind !== false && <p className="flex items-center gap-1 justify-end"><Wind className="h-3.5 w-3.5" />{weather.wind} km/h</p>}
          </div>
        </div>

        {config.showForecast && weather.forecast && (
          <div className="border-t pt-3">
            <div className="grid grid-cols-3 gap-3">
              {weather.forecast.map(day => (
                <div key={day.day} className="text-center">
                  <p className="text-xs text-muted-foreground">{day.day}</p>
                  <p className="text-lg my-1">{getWeatherEmoji(day.condition)}</p>
                  <p className="text-xs font-medium">{Math.round(day.high)}{unit}</p>
                  <p className="text-[10px] text-muted-foreground">{Math.round(day.low)}{unit}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {weather.lastUpdated && <p className="text-[10px] text-muted-foreground text-right">Updated {weather.lastUpdated}</p>}
      </Card>
    )
  }

  // Compact style
  return (
    <motion.div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold">{Math.round(weather.temp)}{unit}</span>
          <span className="text-xs text-muted-foreground truncate">{weather.city}</span>
        </div>
        <p className="text-xs text-muted-foreground">{weather.condition}</p>
      </div>
      <div className="text-right text-[10px] text-muted-foreground space-y-0.5 shrink-0">
        <p>H:{Math.round(weather.high)}{unit} L:{Math.round(weather.low)}{unit}</p>
        {config.showHumidity !== false && <p>{weather.humidity}% humidity</p>}
        {config.showWind !== false && <p>{weather.wind} km/h wind</p>}
      </div>
    </motion.div>
  )
}

export default WeatherWidgetModule
