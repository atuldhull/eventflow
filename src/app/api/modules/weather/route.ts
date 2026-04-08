import { NextRequest, NextResponse } from "next/server"

// In-memory cache for weather data (30 min TTL)
const weatherCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// GET — Get weather data for a city
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const city = searchParams.get("city")
  const units = searchParams.get("units") || "celsius"

  if (!city) {
    return NextResponse.json({ success: false, message: "City parameter required" }, { status: 400 })
  }

  const cacheKey = `${city.toLowerCase()}_${units}`
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, data: cached.data })
  }

  const apiKey = process.env.WEATHER_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      message: "Weather data unavailable — configure WEATHER_API_KEY in settings",
    }, { status: 503 })
  }

  try {
    const unitParam = units === "fahrenheit" ? "imperial" : "metric"
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${unitParam}`
    const res = await fetch(url, { next: { revalidate: 1800 } })

    if (!res.ok) {
      return NextResponse.json({ success: false, message: "City not found or weather service unavailable" }, { status: 404 })
    }

    const raw = await res.json()

    const weatherData = {
      temp: raw.main?.temp,
      condition: raw.weather?.[0]?.description || "Unknown",
      icon: raw.weather?.[0]?.icon || "",
      humidity: raw.main?.humidity,
      wind: raw.wind?.speed,
      high: raw.main?.temp_max,
      low: raw.main?.temp_min,
      city: raw.name || city,
      lastUpdated: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    }

    // Fetch 3-day forecast if available
    try {
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${unitParam}&cnt=24`
      const forecastRes = await fetch(forecastUrl, { next: { revalidate: 1800 } })
      if (forecastRes.ok) {
        const forecastRaw = await forecastRes.json()
        const dailyMap = new Map<string, { highs: number[]; lows: number[]; condition: string }>()

        for (const item of forecastRaw.list || []) {
          const date = new Date(item.dt * 1000)
          const dayKey = date.toLocaleDateString("en-US", { weekday: "short" })
          if (!dailyMap.has(dayKey)) {
            dailyMap.set(dayKey, { highs: [], lows: [], condition: item.weather?.[0]?.description || "" })
          }
          const day = dailyMap.get(dayKey)!
          day.highs.push(item.main.temp_max)
          day.lows.push(item.main.temp_min)
        }

        const today = new Date().toLocaleDateString("en-US", { weekday: "short" })
        const forecast = Array.from(dailyMap.entries())
          .filter(([day]) => day !== today)
          .slice(0, 3)
          .map(([day, data]) => ({
            day,
            high: Math.max(...data.highs),
            low: Math.min(...data.lows),
            condition: data.condition,
            icon: "",
          }))

        ;(weatherData as any).forecast = forecast
      }
    } catch {
      // Forecast is optional — don't fail if it errors
    }

    // Cache the result
    weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() })

    return NextResponse.json({ success: true, data: weatherData })
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch weather data" }, { status: 500 })
  }
}
