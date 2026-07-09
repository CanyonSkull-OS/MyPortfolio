import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Journey from "@/components/sections/Journey";
import Work from "@/components/sections/Work";
import Projects from "@/components/sections/Projects";
import Skills from "@/components/sections/Skills";
import Footer from "@/components/sections/Footer";

/*
  Composition: plum hero (WebGL) → plum journey (pinned) → cream light acts
  (work, projects, skills) → plum contact. Full-bleed dark acts, contained
  light acts — varied rhythm, no fixed background layer.
*/
export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-base text-ink">
      <Nav />
      <Hero />
      <Journey />
      <div className="mx-auto max-w-6xl">
        <Work />
        <Projects />
        <Skills />
      </div>
      <Footer />
    </main>
  );
}
