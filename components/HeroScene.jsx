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
  HeroScene — the "Warm Signal" centerpiece.

  One three.js scene, two actors:
    1. A fullscreen grainient plane (domain-warped fbm, plum → ember → amber)
       rendered behind everything — the same living gradient as the CSS
       fallback, but fluid.
    2. A noise-displaced glass droplet (MeshPhysicalMaterial, transmission +
       dispersion) floating in front. Because transmission samples the scene
       render, the droplet genuinely refracts the gradient behind it —
       background and centerpiece are one optical system.

  Interaction contract:
    uniforms.uMouse ← pointermove, lerped in the raf (never 1:1)
    scroll progress ← ScrollTrigger over the hero, drives morph amplitude,
    droplet drift and gradient hue shift.

  Polish chain: RoomEnvironment → ACESFilmic → bloom → vignette+grain → output.

  Guardrails: mounts nothing on touch/small screens, reduced motion, or
  missing WebGL2 (the CSS .hero-grainient underneath is the fallback).
  The raf stops when the hero leaves the viewport or the tab hides.
*/

// ---------------------------------------------------------------- gradient

const GRADIENT_FRAG = /* glsl */ `
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

    float t = uTime * 0.045;
    vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);

    // domain-warped field, gently pulled toward the cursor
    vec2 q = vec2(
      fbm(p * 1.15 + t * vec2(0.8, -0.5)),
      fbm(p * 1.15 + vec2(3.1, 7.7) - t * 0.6)
    );
    float pull = exp(-length(p - m) * 2.4) * 0.22;
    float f = fbm(p * 1.15 + 1.9 * q + pull);

    // Warm Signal palette — deep plum floor, ember mids, amber blooms
    vec3 plumDeep = vec3(0.121, 0.055, 0.110);  // #2d1428 (linear-ish)
    vec3 plum     = vec3(0.220, 0.083, 0.190);
    vec3 ember    = vec3(0.664, 0.135, 0.040);
    vec3 amber    = vec3(0.870, 0.420, 0.085);

    float band = f + uScroll * 0.18;
    vec3 col = mix(plumDeep, plum, smoothstep(0.05, 0.45, band));
    col = mix(col, ember, smoothstep(0.42, 0.72, band));
    col = mix(col, amber, smoothstep(0.68, 0.98, band) * 0.85);

    // soft light well around the cursor
    col += amber * exp(-length(p - m) * 3.2) * 0.10;

    // breathe darker at the edges so the headline zone stays readable
    float vig = smoothstep(1.5, 0.35, length(vUv - 0.5) * 1.9);
    col *= 0.62 + 0.38 * vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const GRADIENT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

// ------------------------------------------------------- vignette + grain

const FINISH_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
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
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float vig = smoothstep(1.45, 0.4, length(vUv - 0.5) * 1.75);
      col.rgb *= 0.72 + 0.28 * vig;
      float grain = hash(vUv * 917.0 + fract(uTime) * 61.7) - 0.5;
      col.rgb += grain * 0.05;
      gl_FragColor = col;
    }
  `,
};

// -------------------------------------------- droplet displacement (GLSL)

// Simplex-ish 3D noise + displacement along the normal, with normals
// recomputed from neighbor samples so refraction stays smooth.
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
    float n = snoise(dir * 1.35 + vec3(uTime * 0.22, uTime * 0.16, uPointer.x * 0.6));
    float n2 = snoise(dir * 2.6 - vec3(0.0, uTime * 0.28, uPointer.y * 0.6));
    return pos + dir * (n * 0.8 + n2 * 0.2) * uAmp;
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

    const dprCap = Math.min(window.devicePixelRatio || 1, 1.75);
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

    // warm studio reflections without any external HDR download
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffd9a0, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);

    // ---- actor 1: the grainient backdrop --------------------------------
    const gradientUniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 },
    };
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: GRADIENT_VERT,
        fragmentShader: GRADIENT_FRAG,
        uniforms: gradientUniforms,
        depthWrite: false,
        depthTest: false,
      })
    );
    backdrop.renderOrder = -1;
    backdrop.frustumCulled = false;
    scene.add(backdrop);

    // ---- actor 2: the glass droplet --------------------------------------
    const dropletUniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.32 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    };
    const glass = new THREE.MeshPhysicalMaterial({
      transmission: 1,
      thickness: 1.6,
      roughness: 0.06,
      ior: 1.42,
      dispersion: 1.6,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      attenuationColor: new THREE.Color("#eca649"),
      attenuationDistance: 3.5,
      envMapIntensity: 1.1,
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

    // ---- post chain -------------------------------------------------------
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dprCap);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      0.32,
      0.5,
      0.82
    );
    composer.addPass(bloom);
    const finish = new ShaderPass(FINISH_SHADER);
    composer.addPass(finish);
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
      gradientUniforms.uRes.value.set(w, h);
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

      gradientUniforms.uTime.value = t;
      gradientUniforms.uMouse.value.set(state.mx, state.my);
      gradientUniforms.uScroll.value = state.scroll;

      dropletUniforms.uTime.value = t;
      dropletUniforms.uAmp.value = 0.2 + state.scroll * 0.35;
      dropletUniforms.uPointer.value.set(state.mx - 0.5, state.my - 0.5);

      droplet.rotation.y = t * 0.12 + (state.mx - 0.5) * 0.5;
      droplet.rotation.x = (state.my - 0.5) * -0.4 + state.scroll * 0.8;
      droplet.position.y = 0.1 + Math.sin(t * 0.5) * 0.08 + state.scroll * 1.4;
      droplet.position.x = 1.55 - state.scroll * 0.6;

      finish.uniforms.uTime.value = t;
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
