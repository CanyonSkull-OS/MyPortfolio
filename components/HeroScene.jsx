"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ScrollTrigger } from "@/lib/gsapClient";

/*
  HeroScene — the "Deep Water" centerpiece.

  One three.js scene, two actors:
    1. A fullscreen liquid plane: double domain-warped fbm flow, banded
       ink → teal → rust with orange light streaks along the flow ridges.
       Smooth and wet — no noise texture, no grain.
    2. A liquid glass droplet (MeshPhysicalMaterial, transmission +
       dispersion) floating in front. Transmission samples the scene render,
       so the droplet genuinely refracts the flow behind it.

  Interaction contract:
    uniforms.uMouse ← pointermove, lerped in the raf (never 1:1)
    scroll progress ← ScrollTrigger over the hero, drives morph amplitude,
    droplet drift and flow hue shift.

  Polish chain: RoomEnvironment → ACESFilmic → soft bloom → vignette →
  output. NO film-grain pass.

  Guardrails: mounts nothing on touch/small screens, reduced motion, or
  low-power hardware (the CSS .hero-liquid underneath is the fallback).
  DPR capped at 1.5. The raf stops when the hero leaves the viewport or
  the tab hides.
*/

// ---------------------------------------------------------------- liquid

const LIQUID_FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uScroll;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = r * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

    float t = uTime * 0.04;
    vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);

    // double domain warp — this is what makes it read as flowing liquid
    vec2 q = vec2(
      fbm(p * 1.1 + t * vec2(0.7, -0.45)),
      fbm(p * 1.1 + vec2(3.1, 7.7) - t * 0.55)
    );
    float pull = exp(-length(p - m) * 2.4) * 0.24;
    vec2 r = vec2(
      fbm(p * 1.4 + 2.3 * q + vec2(1.7, 9.2) + t * 0.3),
      fbm(p * 1.4 + 2.3 * q + vec2(8.3, 2.8) - t * 0.26)
    );
    float f = fbm(p * 1.2 + 2.1 * r + pull);

    // Deep Water palette (linear-ish, graded through ACES downstream)
    vec3 ink  = vec3(0.000, 0.008, 0.017);  // #001524
    vec3 teal = vec3(0.008, 0.120, 0.155);  // #15616D
    vec3 rust = vec3(0.190, 0.023, 0.005);  // #78290F
    vec3 orange = vec3(1.000, 0.210, 0.000); // #FF7D00
    vec3 cream = vec3(1.000, 0.840, 0.650);  // #FFECD1

    float band = f + uScroll * 0.16;
    vec3 col = mix(ink, teal, smoothstep(0.12, 0.52, band));
    col = mix(col, rust, smoothstep(0.55, 0.85, band));

    // orange light streaks along the flow ridges — thin, glassy, wet
    float ridge = smoothstep(0.50, 0.60, f) * smoothstep(0.70, 0.60, f);
    col += orange * ridge * (0.42 + 0.25 * uScroll);

    // secondary specular sheen where the warp field folds
    float sheen = smoothstep(0.62, 0.78, r.x) * smoothstep(0.95, 0.78, r.x);
    col += cream * sheen * 0.06;

    // soft light well around the cursor
    col += cream * exp(-length(p - m) * 3.4) * 0.07;

    // darken edges so the headline zone stays readable
    float vig = smoothstep(1.5, 0.35, length(vUv - 0.5) * 1.9);
    col *= 0.6 + 0.4 * vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const LIQUID_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

// ------------------------------------------------------------- vignette

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float vig = smoothstep(1.45, 0.4, length(vUv - 0.5) * 1.75);
      col.rgb *= 0.75 + 0.25 * vig;
      gl_FragColor = col;
    }
  `,
};

// -------------------------------------------- droplet displacement (GLSL)

// Simplex noise + displacement along the normal, with normals recomputed
// from neighbor samples so refraction stays smooth. Low frequency + slow
// time so the surface flows like liquid instead of crumpling like rock.
const DROPLET_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec2 uPointer;

  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 displaced(vec3 pos) {
    vec3 dir = normalize(pos);
    float n = snoise(dir * 1.05 + vec3(uTime * 0.16, uTime * 0.12, uPointer.x * 0.5));
    float n2 = snoise(dir * 2.0 - vec3(0.0, uTime * 0.2, uPointer.y * 0.5));
    return pos + dir * (n * 0.85 + n2 * 0.15) * uAmp;
  }
`;

const isLowPower = () =>
  (navigator.hardwareConcurrency || 8) <= 4 ||
  (navigator.deviceMemory || 8) <= 4;

export default function HeroScene() {
  const mountRef = useRef(null);
  const [eligible, setEligible] = useState(false);

  // Gate: fine pointer + desktop width + motion allowed + decent hardware.
  useEffect(() => {
    const ok =
      window.matchMedia("(min-width: 768px) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !isLowPower();
    setEligible(ok);
  }, []);

  useEffect(() => {
    if (!eligible) return;
    const mount = mountRef.current;
    if (!mount) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      return; // CSS fallback stays visible
    }

    const dprCap = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dprCap);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / mount.clientHeight,
      0.1,
      30
    );
    camera.position.set(0, 0, 6);

    // studio reflections without any external HDR download
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffe0b8, 2.0);
    key.position.set(3, 4, 5);
    scene.add(key);

    // ---- actor 1: the liquid backdrop -------------------------------------
    const liquidUniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 },
    };
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: LIQUID_VERT,
        fragmentShader: LIQUID_FRAG,
        uniforms: liquidUniforms,
        depthWrite: false,
        depthTest: false,
      })
    );
    backdrop.renderOrder = -1;
    backdrop.frustumCulled = false;
    scene.add(backdrop);

    // ---- actor 2: the liquid glass droplet ---------------------------------
    const dropletUniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.16 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    };
    // glass, not chrome: refraction must dominate reflection, so the env
    // contribution stays low and the body tint stays light
    const glass = new THREE.MeshPhysicalMaterial({
      transmission: 1,
      thickness: 1.4,
      roughness: 0.03,
      ior: 1.4,
      dispersion: 1.4,
      clearcoat: 0.25,
      clearcoatRoughness: 0.2,
      specularIntensity: 0.7,
      attenuationColor: new THREE.Color("#9adbe3"),
      attenuationDistance: 3.5,
      envMapIntensity: 0.5,
    });
    glass.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, dropletUniforms);
      shader.vertexShader = DROPLET_GLSL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          /* glsl */ `
          vec3 dPos = displaced(position);
          // recompute the normal from two displaced tangential neighbors
          vec3 tangentA = normalize(cross(normal, vec3(0.0, 1.0, 0.001)));
          vec3 tangentB = normalize(cross(normal, tangentA));
          float eps = 0.02;
          vec3 nA = displaced(position + tangentA * eps);
          vec3 nB = displaced(position + tangentB * eps);
          vec3 objectNormal = normalize(cross(nA - dPos, nB - dPos));
          `
        )
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `vec3 transformed = dPos;`
        );
    };
    const droplet = new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 96), glass);
    droplet.position.set(1.55, 0.1, 0);
    scene.add(droplet);

    // ---- post chain: ACES → soft bloom → vignette → output (NO grain) ------
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dprCap);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      0.3,
      0.55,
      0.85
    );
    composer.addPass(bloom);
    composer.addPass(new ShaderPass(VIGNETTE_SHADER));
    composer.addPass(new OutputPass());

    // ---- interaction state (everything lerped) ----------------------------
    const state = {
      mx: 0.5,
      my: 0.5,
      tmx: 0.5,
      tmy: 0.5,
      scroll: 0,
      scrollTarget: 0,
    };

    const onPointerMove = (e) => {
      state.tmx = e.clientX / window.innerWidth;
      state.tmy = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const st = ScrollTrigger.create({
      trigger: mount,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        state.scrollTarget = self.progress;
      },
    });

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      liquidUniforms.uRes.value.set(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- render loop with guardrails --------------------------------------
    const clock = new THREE.Clock();
    let rafId = 0;
    let running = false;
    let visible = !document.hidden;
    let intersecting = true;

    const loop = () => {
      if (!running) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      // framerate-independent lerp
      const k = 1 - Math.pow(1 - 0.08, delta * 60);
      state.mx += (state.tmx - state.mx) * k;
      state.my += (state.tmy - state.my) * k;
      state.scroll += (state.scrollTarget - state.scroll) * k;

      liquidUniforms.uTime.value = t;
      liquidUniforms.uMouse.value.set(state.mx, state.my);
      liquidUniforms.uScroll.value = state.scroll;

      dropletUniforms.uTime.value = t;
      dropletUniforms.uAmp.value = 0.16 + state.scroll * 0.28;
      dropletUniforms.uPointer.value.set(state.mx - 0.5, state.my - 0.5);

      droplet.rotation.y = t * 0.1 + (state.mx - 0.5) * 0.5;
      droplet.rotation.x = (state.my - 0.5) * -0.4 + state.scroll * 0.7;
      droplet.position.y = 0.1 + Math.sin(t * 0.45) * 0.09 + state.scroll * 1.4;
      droplet.position.x = 1.55 - state.scroll * 0.6;

      composer.render();
      rafId = requestAnimationFrame(loop);
    };

    const syncRunState = () => {
      const shouldRun = visible && intersecting;
      if (shouldRun && !running) {
        running = true;
        clock.getDelta();
        rafId = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    };
    syncRunState();

    const onVisibility = () => {
      visible = !document.hidden;
      syncRunState();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      syncRunState();
    });
    io.observe(mount);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      st.kill();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      droplet.geometry.dispose();
      glass.dispose();
      backdrop.geometry.dispose();
      backdrop.material.dispose();
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [eligible]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden [&>canvas]:h-full [&>canvas]:w-full"
    />
  );
}
