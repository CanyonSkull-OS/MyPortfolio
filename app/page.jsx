import PaperShaderBackground from "@/components/PaperShaderBackground";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Journey from "@/components/sections/Journey";
import Projects from "@/components/sections/Projects";
import Skills from "@/components/sections/Skills";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-[#050505] text-white overflow-x-hidden">
      {/* LAYER 1: The Integrated Paper Shader Canvas */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <PaperShaderBackground />
      </div>

      {/* LAYER 2: HTML Content & Interactions */}
      <div className="relative z-10 mx-auto max-w-7xl">
        <Nav />
        <Hero />
        <Journey />
        <Projects />
        <Skills />
        <Footer />
      </div>
    </main>
  );
}
