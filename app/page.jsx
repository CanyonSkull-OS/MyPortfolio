import Nav from "@/components/Nav";
import BackgroundFlow from "@/components/BackgroundFlow";
import ScrollProgress from "@/components/ScrollProgress";
import Hero from "@/components/sections/Hero";
import Journey from "@/components/sections/Journey";
import Work from "@/components/sections/Work";
import Projects from "@/components/sections/Projects";
import Skills from "@/components/sections/Skills";
import Footer from "@/components/sections/Footer";

/*
  Composition: one fixed ink field (BackgroundFlow) runs behind the whole
  page; the hero paints its own liquid WebGL over it and fades into it; the
  journey scrolls natively across it; the light middle acts melt in and out
  through the .light-zone gradient — no hard color seams anywhere.
*/
export default function Home() {
  // overflow-x-clip, not -hidden: hidden creates a scrollport and kills
  // position:sticky for every descendant (the journey rail)
  return (
    <main className="relative min-h-screen w-full overflow-x-clip text-ink">
      <BackgroundFlow />
      <ScrollProgress />
      <Nav />
      <div className="relative">
        <Hero />
        <Journey />
        <div className="light-zone relative">
          <div className="mx-auto max-w-6xl">
            <Work />
            <Projects />
            <Skills />
          </div>
        </div>
        <Footer />
      </div>
    </main>
  );
}
