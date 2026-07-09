"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsapClient";

/*
  PaperShaderBackground — the "grainient" aura.

  Raw WebGL1 on a fullscreen triangle (3 vertices, no mesh). Domain-warped fbm
  fluid + film grain + paper tooth on a #050505 floor, tinted with the
  iridescent violet/cyan/magenta/amber palette pulled from the design
  references.

  Interactivity contract:
    u_mouse  ← window pointermove (lerped in the raf for a trailing ripple)
    u_scroll ← GSAP ScrollTrigger progress across the whole document
    u_energy ← ScrollTrigger velocity impulse (decays every frame)

  GSAP writes ONLY into the uniform state ref — it never touches DOM props, so
  it can never collide with Motion-driven element animations.

  Resource guardrails: the raf loop fully stops when the tab is hidden
  (visibilitychange), when the canvas leaves the viewport (IntersectionObserver)
  and on unmount (route switch). Internal resolution is capped (DPR ≤ 1.5 ×
  0.66 scale) — the soft grain hides the upscale entirely.
*/

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;   // 0..1, y-up
uniform float u_scroll;  // 0..1 document progress
uniform float u_energy;  // scroll-velocity impulse

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = r * p;
    a *= 0.5;
  }
  return v;
}

// iridescent cosine palette; hue phase drifts with scroll progress
vec3 palette(float t) {
  vec3 phase = vec3(0.00, 0.18, 0.42) + u_scroll * vec3(0.12, 0.22, 0.35);
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.9, 0.7, 0.5) * t + phase));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float speed = 0.055 + u_energy * 0.10;
  float t = u_time * speed;

  // trailing mouse ripple — rings emanating from the cursor, fading with distance
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0);
  float md = length(p - m);
  float ripple = sin(md * 22.0 - u_time * 2.1) * exp(-md * 4.2) * 0.16;
  float glow = exp(-md * 3.0) * 0.30;

  // domain-warped fluid
  vec2 q = vec2(
    fbm(p * 1.35 + t * vec2(0.9, -0.6)),
    fbm(p * 1.35 + vec2(2.7, 9.1) - t * 0.7)
  );
  float f = fbm(p * 1.35 + 2.1 * q + ripple);

  float lum = f * f * (0.9 + u_energy * 0.55) + glow * (0.6 + f);
  vec3 col = palette(f * 0.9 + q.x * 0.45 + md * 0.15) * lum;

  // keep the aura dim and premium — the page floor is #050505
  col *= 0.36 + 0.10 * u_scroll + 0.22 * u_energy;

  // film grain (gain rises with scroll energy) + fine paper tooth
  float grain = hash(gl_FragCoord.xy + fract(u_time) * 61.7) - 0.5;
  col += grain * (0.055 + 0.05 * u_energy + 0.02 * u_scroll);
  float tooth = noise(vec2(uv.x * 240.0 * aspect, uv.y * 240.0)) - 0.5;
  col += tooth * 0.018;

  // vignette toward the void
  float vig = smoothstep(1.35, 0.25, length(uv - 0.5) * 1.85);
  col *= vig;

  col += vec3(0.019, 0.019, 0.021); // #050505 floor
  gl_FragColor = vec4(col, 1.0);
}
`;

const DPR_CAP = 1.5;
const RES_SCALE = 0.66;

export default function PaperShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      }) || canvas.getContext("experimental-webgl");
    if (!gl) return; // WebGL unavailable — page stays on the #050505 body color

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- program setup -------------------------------------------------
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // fullscreen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, "u_res"),
      time: gl.getUniformLocation(prog, "u_time"),
      mouse: gl.getUniformLocation(prog, "u_mouse"),
      scroll: gl.getUniformLocation(prog, "u_scroll"),
      energy: gl.getUniformLocation(prog, "u_energy"),
    };

    // ---- mutable uniform state -----------------------------------------
    const state = {
      mx: 0.5,
      my: 0.5, // rendered (lerped) mouse
      tmx: 0.5,
      tmy: 0.5, // raw target mouse
      scroll: 0,
      scrollTarget: 0,
      energy: 0,
      energyTarget: 0,
    };

    // ---- sizing ---------------------------------------------------------
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * RES_SCALE;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();

    // ---- render loop with guardrails -------------------------------------
    let rafId = 0;
    let running = false;
    let visible = !document.hidden;
    let intersecting = true;
    let contextLost = false;
    const start = performance.now();

    const draw = (now) => {
      state.mx += (state.tmx - state.mx) * 0.065;
      state.my += (state.tmy - state.my) * 0.065;
      state.scroll += (state.scrollTarget - state.scroll) * 0.08;
      state.energy += (state.energyTarget - state.energy) * 0.07;
      state.energyTarget *= 0.93; // impulse decays back to calm

      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, (now - start) / 1000);
      gl.uniform2f(U.mouse, state.mx, state.my);
      gl.uniform1f(U.scroll, state.scroll);
      gl.uniform1f(U.energy, state.energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now) => {
      if (!running) return;
      draw(now);
      rafId = requestAnimationFrame(loop);
    };

    const syncRunState = () => {
      const shouldRun = visible && intersecting && !contextLost && !reduced;
      if (shouldRun && !running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    };

    // reduced motion: paint exactly one calm frame, never loop
    if (reduced) draw(start + 4000);
    else syncRunState();

    // ---- listeners --------------------------------------------------------
    const onPointerMove = (e) => {
      state.tmx = e.clientX / window.innerWidth;
      state.tmy = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      resize();
      if (reduced) draw(start + 4000);
    };
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      visible = !document.hidden;
      syncRunState();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      syncRunState();
    });
    io.observe(canvas);

    const onContextLost = (e) => {
      e.preventDefault();
      contextLost = true;
      syncRunState();
    };
    const onContextRestored = () => {
      contextLost = false;
      syncRunState();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    // ---- GSAP ScrollTrigger → shader uniforms -----------------------------
    // Scoped to uniform state only (never DOM), per the animation guardrails.
    const st = ScrollTrigger.create({
      start: 0,
      end: () =>
        Math.max(
          1,
          document.documentElement.scrollHeight - window.innerHeight
        ),
      onUpdate: (self) => {
        state.scrollTarget = self.progress;
        const impulse = Math.min(Math.abs(self.getVelocity()) / 2600, 1.4);
        if (impulse > state.energyTarget) state.energyTarget = impulse;
      },
    });

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      st.kill();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      aria-hidden="true"
    />
  );
}
