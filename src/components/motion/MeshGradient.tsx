"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

/**
 * Hand-rolled WebGL mesh-gradient background — a single full-viewport
 * quad with one fragment shader. Roughly 120 lines of actual GL setup,
 * no Three.js (which would be ~150KB gzipped for what amounts to a
 * two-triangle draw call).
 *
 * The shader layers a few animated Gaussian "blobs" in a controlled palette,
 * adds subtle fBm noise to break up banding, and clamps the output so the
 * visual weight stays behind content, never in front of it.
 *
 * Guardrails:
 *   - Canvas-unsupported or `lostcontext` events → render nothing (the
 *     layout's CSS AnimatedBackground stays visible underneath).
 *   - prefers-reduced-motion → the shader runs with a fixed `uTime=0`, so
 *     the gradient is there but static. Colours still exist; motion doesn't.
 *   - Pauses when the tab is hidden (document.hidden) so we don't burn
 *     battery for an invisible page.
 *   - Caps DPR at 1.5 on high-DPI displays; a 4K mesh-gradient is
 *     indistinguishable from 2K but 4× the fragment work.
 */
interface Props {
  className?: string
  /** One of the palettes defined inside the shader. */
  palette?: "indigo" | "emerald" | "sunset" | "night"
  /** Overall opacity; 1.0 is full-strength marketing, 0.5–0.7 is a good mix with content overlays. */
  opacity?: number
}

const PALETTES: Record<NonNullable<Props["palette"]>, [number, number, number][]> = {
  indigo:  [[0.33, 0.28, 0.92], [0.55, 0.29, 0.95], [0.21, 0.55, 0.95], [0.05, 0.05, 0.12]],
  emerald: [[0.06, 0.72, 0.51], [0.12, 0.72, 0.83], [0.54, 0.92, 0.77], [0.02, 0.10, 0.10]],
  sunset:  [[0.96, 0.50, 0.16], [0.97, 0.30, 0.34], [0.55, 0.29, 0.79], [0.10, 0.04, 0.12]],
  night:   [[0.11, 0.14, 0.32], [0.25, 0.25, 0.55], [0.50, 0.35, 0.80], [0.02, 0.02, 0.06]],
}

const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec2  uRes;
uniform vec3  uC0;  // corner / base colour
uniform vec3  uC1;  // blob 1
uniform vec3  uC2;  // blob 2
uniform vec3  uC3;  // blob 3 / highlight

// Cheap value-noise fBm. ~8 ops/sample, plenty for a background.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// A Gaussian blob centred at c with radius r. Returns 0..1 weight.
float blob(vec2 uv, vec2 c, float r) {
  float d = distance(uv, c);
  return exp(-(d * d) / (r * r));
}

void main() {
  // Correct for aspect so blobs stay circular regardless of viewport shape.
  vec2 uv = vUv;
  uv.x *= uRes.x / uRes.y;

  float t = uTime * 0.15;

  // Three slowly-drifting blob centres. The paths are Lissajous-like so they
  // don't visibly loop within any short window.
  vec2 p1 = vec2(0.55 + 0.28 * cos(t * 0.9 + 1.4),
                 0.35 + 0.22 * sin(t * 0.75));
  vec2 p2 = vec2(0.30 + 0.24 * sin(t * 0.6 + 2.1),
                 0.65 + 0.20 * cos(t * 0.85 + 0.7));
  vec2 p3 = vec2(0.80 + 0.18 * cos(t * 0.55 + 3.3),
                 0.80 + 0.22 * sin(t * 0.95 + 1.8));

  // Aspect-correct each blob centre too.
  p1.x *= uRes.x / uRes.y;
  p2.x *= uRes.x / uRes.y;
  p3.x *= uRes.x / uRes.y;

  float w1 = blob(uv, p1, 0.55);
  float w2 = blob(uv, p2, 0.50);
  float w3 = blob(uv, p3, 0.45);

  // Layer the palette — start from base, additively tint toward each blob.
  vec3 col = uC0;
  col = mix(col, uC1, clamp(w1, 0.0, 1.0) * 0.9);
  col = mix(col, uC2, clamp(w2, 0.0, 1.0) * 0.8);
  col = mix(col, uC3, clamp(w3, 0.0, 1.0) * 0.7);

  // fBm to break banding; stays subtle.
  float n = noise(vUv * 4.0 + t) * 0.5 + noise(vUv * 9.0 - t) * 0.25;
  col += (n - 0.375) * 0.04;

  // Gentle vignette so the edges feel composed rather than cropped.
  float vignette = smoothstep(1.15, 0.55, distance(vUv, vec2(0.5)));
  col *= 0.92 + 0.08 * vignette;

  gl_FragColor = vec4(col, 1.0);
}
`

export function MeshGradient({ className, palette = "indigo", opacity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cssFallbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    })

    if (!gl) {
      // Show the CSS fallback; a gradient is better than an empty black square.
      if (cssFallbackRef.current) cssFallbackRef.current.style.opacity = "1"
      return
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Compile shaders
    const compile = (src: string, type: number): WebGLShader | null => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("MeshGradient shader failed:", gl.getShaderInfoLog(sh))
        gl.deleteShader(sh)
        return null
      }
      return sh
    }
    const vs = compile(VERT, gl.VERTEX_SHADER)
    const fs = compile(FRAG, gl.FRAGMENT_SHADER)
    if (!vs || !fs) {
      if (cssFallbackRef.current) cssFallbackRef.current.style.opacity = "1"
      return
    }

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("MeshGradient link failed:", gl.getProgramInfoLog(program))
      return
    }
    gl.useProgram(program)

    // Full-viewport quad
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, "aPos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, "uTime")
    const uRes = gl.getUniformLocation(program, "uRes")
    const uC0 = gl.getUniformLocation(program, "uC0")
    const uC1 = gl.getUniformLocation(program, "uC1")
    const uC2 = gl.getUniformLocation(program, "uC2")
    const uC3 = gl.getUniformLocation(program, "uC3")

    const colors = PALETTES[palette]
    gl.uniform3fv(uC0, colors[3])  // base / corner
    gl.uniform3fv(uC1, colors[0])
    gl.uniform3fv(uC2, colors[1])
    gl.uniform3fv(uC3, colors[2])

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let startedAt = performance.now()
    let rafId = 0
    let paused = false

    const onVisibility = () => {
      paused = document.hidden
      if (!paused) {
        startedAt = performance.now() - (startedAt - performance.now())  // resume clock seamlessly
        rafId = requestAnimationFrame(tick)
      }
    }
    const tick = () => {
      if (paused) return
      const elapsed = reduced ? 0 : (performance.now() - startedAt) / 1000
      gl.uniform1f(uTime, elapsed)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    document.addEventListener("visibilitychange", onVisibility)

    const onContextLost = () => {
      cancelAnimationFrame(rafId)
      if (cssFallbackRef.current) cssFallbackRef.current.style.opacity = "1"
    }
    canvas.addEventListener("webglcontextlost", onContextLost)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [palette])

  // CSS fallback sits underneath the canvas and only becomes visible if WebGL fails.
  const fallbackColors = PALETTES[palette]
  const rgb = (c: [number, number, number]) => `rgb(${(c[0] * 255) | 0}, ${(c[1] * 255) | 0}, ${(c[2] * 255) | 0})`

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity }}
    >
      <div
        ref={cssFallbackRef}
        className="absolute inset-0 opacity-0 transition-opacity duration-500"
        style={{
          backgroundImage:
            `radial-gradient(at 30% 30%, ${rgb(fallbackColors[0])}, transparent 60%),` +
            `radial-gradient(at 70% 70%, ${rgb(fallbackColors[1])}, transparent 60%),` +
            `radial-gradient(at 50% 90%, ${rgb(fallbackColors[2])}, transparent 60%),` +
            rgb(fallbackColors[3]),
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
