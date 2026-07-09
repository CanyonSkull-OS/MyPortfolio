export const identity = {
  name: "Omer Shahid",
  role: "AI & Automation Engineer",
  line: "Computer Science @ FAST-NUCES · GPA 3.89 · Karachi",
  valueProp:
    "I build the automation that runs a company's repetitive work — the lead scoring, the attendance fixes, the calendar sync nobody wants to do by hand — usually before anyone's logged in.",
  email: "omershahid78@gmail.com",
  phone: "+92 321 8052969",
  phoneHref: "+923218052969",
  linkedin: "https://www.linkedin.com/in/thatcheekynobody",
  github: "https://github.com/CanyonSkull-OS",
};

/*
  The journey — narrative beats for the pinned timeline.
  Story arc, not job descriptions; the detailed cards live in `work`.
*/
export const chapters = [
  {
    id: "origin",
    year: "2024",
    title: "It started with pixels",
    body: "My first real systems were game engines, written in C and C++. Collision, game loops, sprite grids. I wanted to know exactly what the machine was doing under me, and that habit never really left.",
  },
  {
    id: "atompoint",
    year: "2025",
    title: "Then it got real",
    body: "At Atompoint I worked on software people leaned on every day: a Slack attendance system where one missed punch turned into a real HR headache. That taught me the best automation is the kind nobody notices is there.",
  },
  {
    id: "beamhive",
    year: "2026",
    title: "Now it's the job",
    body: "Now I build BeamHive's lead generation engine: the system that finds prospects, enriches and scores them, and decides who's actually worth a salesperson's time. It runs on its own while I work on other things.",
  },
];

/* Featured work — the three engagements, in full. */
export const work = [
  {
    id: "beamhive",
    org: "BeamHive",
    title: "Lead Gen Automation Engine",
    period: "2026 — now",
    status: "Live",
    body: "A pipeline that scrapes prospects, enriches and scores them, then routes the best ones straight to sales. Nobody touches it between the first crawl and the ranked queue.",
    outcome: "Sales wakes up to warm leads instead of raw lists.",
    link: {
      href: "https://beamhiveleadgen.vercel.app",
      label: "How the engine works",
    },
    tags: ["Automation", "Lead gen", "Pipelines"],
  },
  {
    id: "atompoint",
    org: "Atompoint",
    title: "AI Engineer Intern",
    period: "2025",
    status: "Shipped",
    body: "Extended a Slack-based attendance system built on Firestore and the Bolt SDK. I wrote the punch-correction pipelines and the monthly reliability reports that replaced the manual ones.",
    outcome: "Manual HR fixes dropped to zero, and the monthly report stopped being a scramble.",
    tags: ["Slack Bolt", "Firestore", "Pipelines"],
  },
  {
    id: "n8n",
    org: "Independent",
    title: "n8n Orchestrations",
    period: "2025 — now",
    status: "Always on",
    body: "Standing orchestrations that keep Slack and Google Calendar in step, plus a GPT-driven model wired to a film database that matches picks to a viewer's mood.",
    outcome: "Scheduling and film picks run themselves.",
    tags: ["n8n", "Google Calendar", "GPT"],
  },
];

export const projects = [
  {
    id: "bm-accounting",
    year: "2026",
    title: "BM Accounting",
    kicker: "Desktop accounting that works offline",
    body: "Desktop accounting software: invoicing, ledgers, client profiles, and the offline sync loops that keep it working with no connection. I ran the project and built across the stack for a team of three.",
    stack: ["React", "Electron", "Supabase", "PostgreSQL"],
    role: "Project manager · Full-stack",
    github: "https://github.com/CanyonSkull-OS/BM-Accounting",
    size: "wide",
  },
  {
    id: "chrome-dino",
    year: "2025",
    title: "Chrome Dino: Remastered",
    kicker: "A C++ arcade engine",
    body: "A full arcade clone in C++ and SFML. Entity collision, a game loop that speeds up the longer you survive, scaling obstacles, and high scores saved per profile.",
    stack: ["C++", "SFML"],
    role: "Engine & gameplay",
    github: "https://github.com/AsadFattani/The-prototype-of-The-Thing",
    size: "half",
  },
  {
    id: "space-ripper",
    year: "2024",
    title: "Space Ripper",
    kicker: "A side-scroller in pure C",
    body: "A side-scroller in pure C on SDL2. Sprite grids, tight hit-boxes, sound running on its own thread, and a state machine driving progression.",
    stack: ["C", "SDL2"],
    role: "Solo build",
    github: "https://github.com/AsadFattani/Space-Ripper",
    size: "half",
  },
];

export const skills = [
  {
    label: "Languages",
    items: ["Python", "C", "C++", "Java"],
  },
  {
    label: "Libraries & environments",
    items: [
      "SDL2",
      "SFML",
      "Slack Bolt SDK",
      "Google Workspace APIs",
      "Git",
      "Firebase Firestore",
      "PostgreSQL",
    ],
  },
  {
    label: "Automation",
    items: ["n8n"],
    featured: true,
    note: "This is the layer under most of the work above: webhook meshes, API glue, and GPT pipelines. Boring plumbing, mostly, and that's kind of the point.",
  },
];
