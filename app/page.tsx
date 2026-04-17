import Link from "next/link";
import FadeInObserver from "@/components/FadeInObserver";
import "./landing.css";

export default function LandingPage() {
  return (
    <>
      <FadeInObserver />

      <div className="landing">
        {/* NAV */}
        <nav>
          <a href="#" className="nav-brand">
            <span>🥜</span> Peanut Gallery
          </a>
          <ul className="nav-links">
            <li><a href="#install">Install</a></li>
            <li><a href="#personas">Personas</a></li>
            <li><a href="#how">How It Works</a></li>
            <li><a href="#stack">Stack</a></li>
            <li>
              <a href="#install" className="nav-cta">
                Install Extension
              </a>
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <div className="pulse"></div>
              Live — Chrome Extension Shipping
            </div>

            <h1>
              Your podcast&apos;s
              <br />
              <span className="gradient-text">AI writers&apos; room.</span>
            </h1>

            <p className="hero-sub">
              A Chrome extension that sits next to any YouTube video and reacts in real-time.
              4 AI personas — a fact-checker, a sound effects guy, a comedy writer, a cynical troll —
              watch the show with you through a native Chrome side panel. No tab switching.
              No screen-share picker. Audio captured silently while you watch.
            </p>

            <div className="hero-ctas">
              <a href="#install" className="btn-primary">
                Install the Extension
              </a>
              <a
                href="https://github.com/Sethmr/peanut.gallery"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View on GitHub
              </a>
            </div>

            {/* VIDEO CLIP — Jason's $5k bounty announcement */}
            <div className="video-section">
              <video autoPlay loop playsInline controls>
                <source src="/twist-clip.mp4" type="video/mp4" />
              </video>
            </div>
            <p className="video-caption">
              The challenge, straight from{" "}
              <a href="https://x.com/jason" target="_blank" rel="noopener noreferrer">@jason</a> &amp;{" "}
              <a href="https://x.com/lonharris" target="_blank" rel="noopener noreferrer">@lonharris</a>
              {" "}on <a href="https://x.com/twistartups" target="_blank" rel="noopener noreferrer">This Week in Startups</a>
            </p>
          </div>
        </section>

        {/* INSTALL */}
        <section className="content-section" id="install">
          <div className="section-label">Install</div>
          <h2 className="fade-in">Running on your machine in 4 steps.</h2>
          <p className="section-sub fade-in">
            The extension is open source. Until it lands on the Chrome Web Store, install it in
            Developer mode straight from the GitHub repo. Takes about a minute.
          </p>

          <div className="steps-grid">
            <div className="step fade-in">
              <h3>Clone the repo</h3>
              <p>
                <code className="inline-code">git clone github.com/Sethmr/peanut.gallery</code>
              </p>
            </div>
            <div className="step fade-in">
              <h3>Start the server</h3>
              <p>
                In the repo, run <code className="inline-code">./setup.sh</code> then{" "}
                <code className="inline-code">npm run dev</code>. Your API keys stay on your machine.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Load unpacked</h3>
              <p>
                Open <code className="inline-code">chrome://extensions</code>, enable Developer mode,
                click <strong>Load unpacked</strong>, and select the{" "}
                <code className="inline-code">extension/</code> folder.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Click the peanut</h3>
              <p>
                Open any YouTube video, click the 🥜 icon in the toolbar, and hit{" "}
                <strong>Start Listening</strong>. The gallery opens in a native Chrome side panel.
              </p>
            </div>
          </div>

          <div className="status-banner fade-in" style={{ marginTop: "3rem" }}>
            <h3 style={{ color: "#22c55e" }}>✓ Working product</h3>
            <p>
              Tab audio is captured silently via{" "}
              <code className="inline-code">chrome.tabCapture</code> — the same API Otter.ai and
              Fireflies use. No permission picker, no interference with playback. You hear the video;
              the AI hears it too.
            </p>
          </div>
        </section>

        {/* PERSONAS */}
        <section className="dark" id="personas">
          <div className="section-label">The Cast</div>
          <h2 className="fade-in">4 personas. 4 perspectives. Zero filter.</h2>
          <p className="section-sub fade-in">
            Inspired by the Howard Stern Show staff. Each persona runs on a different AI model.
            Open source. Bring your own API keys.
          </p>

          <div className="personas-grid">
            <div className="persona-card producer fade-in">
              <div className="persona-icon">🎯</div>
              <h3>Baba Booey (Gary Dell&apos;Abate)</h3>
              <div className="persona-role">Fact-Checker &middot; Claude Haiku + Brave Search</div>
              <p>
                Monitors the conversation for factual claims and provides corrections
                or background data in real-time. Searches the web mid-show to verify
                statistics, dates, and attributions.
              </p>
              <div className="persona-quote">
                &ldquo;Jason just said Uber was founded in 2007. It was 2009. Again.&rdquo;
              </div>
            </div>

            <div className="persona-card troll fade-in">
              <div className="persona-icon">🔥</div>
              <h3>The Cynical Troll</h3>
              <div className="persona-role">Commentary &middot; Groq &middot; Llama 70B</div>
              <p>
                Dunks on everything with internet-brain energy. Contrarian by default,
                occasionally right. Responds in 120ms because trolls don&apos;t deliberate.
              </p>
              <div className="persona-quote">
                &ldquo;Oh cool, another AI wrapper. Very 2024.&rdquo;
              </div>
            </div>

            <div className="persona-card fred fade-in">
              <div className="persona-icon">🎧</div>
              <h3>Fred Norris</h3>
              <div className="persona-role">Sound Effects &middot; Groq &middot; Llama 8B</div>
              <p>
                Background context and sound effect cues. Precisely timed drops
                and the occasional razor-sharp one-liner.
              </p>
              <div className="persona-quote">
                &ldquo;[record scratch] Fun fact: that company went bankrupt in 2023. [sad trombone]&rdquo;
              </div>
            </div>

            <div className="persona-card joker fade-in">
              <div className="persona-icon">🤣</div>
              <h3>Jackie Martling</h3>
              <div className="persona-role">Comedy Writer &middot; Claude Haiku</div>
              <p>
                Setup-punchline structure, callback humor, observational comedy.
                The one who makes you spit out your coffee mid-episode.
              </p>
              <div className="persona-quote">
                &ldquo;Jason&apos;s investment thesis: if it has &apos;AI&apos; in the name and the founder has a pulse, it&apos;s a yes.&rdquo;
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="content-section" id="how">
          <div className="section-label">Architecture</div>
          <h2 className="fade-in">The show watches itself.</h2>
          <p className="section-sub fade-in">
            The extension captures tab audio silently, streams PCM to your local server, routes it
            through Deepgram, and a rule-based director decides which persona reacts — cascading to
            others with decreasing probability. You never leave the YouTube tab.
          </p>

          <div className="steps-grid">
            <div className="step fade-in">
              <h3>Silent Tab Capture</h3>
              <p>
                <code className="inline-code">chrome.tabCapture</code> grabs YouTube audio without a
                permission picker. The user keeps hearing the video; the extension hears it too.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Offscreen Processing</h3>
              <p>
                An MV3 offscreen document downsamples to 16kHz PCM and streams 250ms chunks to the
                server. The service worker handles gestures and permissions.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Director + Cascade</h3>
              <p>
                Deepgram Nova-3 transcribes in real-time. A rule-based director picks one persona
                per trigger, then others cascade with staggered delays — like a real writers&apos; room.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Native Side Panel</h3>
              <p>
                Responses stream token-by-token via SSE into Chrome&apos;s Side Panel API. Lives next
                to the video, not on top of it. Persists across tabs.
              </p>
            </div>
          </div>
        </section>

        {/* TECH STACK */}
        <section className="dark" id="stack">
          <div className="section-label">No Platform Trap</div>
          <h2 className="fade-in">Multi-provider by design.</h2>
          <p className="section-sub fade-in">
            Two LLM providers. Swap any model. No single dependency. Open source, MIT licensed.
            Cost: ~$1.15 per 2-hour episode.
          </p>

          <div className="stack-grid">
            <div className="stack-item fade-in">
              <div className="stack-name">Next.js 15</div>
              <div className="stack-role">App Router + SSE</div>
            </div>
            <div className="stack-item fade-in">
              <div className="stack-name">Deepgram Nova-3</div>
              <div className="stack-role">Real-time transcription</div>
            </div>
            <div className="stack-item fade-in">
              <div className="stack-name">Claude Haiku</div>
              <div className="stack-role">Baba Booey + Jackie</div>
            </div>
            <div className="stack-item fade-in">
              <div className="stack-name">Groq + Llama</div>
              <div className="stack-role">Troll + Fred (120ms TTFT)</div>
            </div>
            <div className="stack-item fade-in">
              <div className="stack-name">Brave Search</div>
              <div className="stack-role">Live fact-checking</div>
            </div>
            <div className="stack-item fade-in">
              <div className="stack-name">Docker + Railway</div>
              <div className="stack-role">One-command deploy</div>
            </div>
          </div>
        </section>

        {/* REFERENCE IMPLEMENTATION */}
        <section className="content-section" id="reference">
          <div className="section-label">The Artifact</div>
          <h2 className="fade-in">The web app still exists — as a reference.</h2>
          <p className="section-sub fade-in">
            Before the Chrome extension, Peanut Gallery was a web app you pasted a YouTube URL into.
            It proved out the persona engine, the director, the SSE stream, and the UI that now lives
            in the side panel. It&apos;s preserved as a reference implementation — paste a URL, see
            the whole pipeline run in a single tab. When we iterate on the sidebar next, this is where
            we prototype.
          </p>
          <div className="hero-ctas" style={{ justifyContent: "flex-start", marginBottom: 0 }}>
            <Link href="/watch" className="btn-secondary">
              Open the Reference App
            </Link>
            <a
              href="https://github.com/Sethmr/peanut.gallery/tree/main/app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              View the Source
            </a>
          </div>
        </section>

        {/* ORIGIN */}
        <section className="content-section">
          <div className="origin-box fade-in">
            <h2>Built for a bounty. Shipped as a product.</h2>
            <p>
              Jason Calacanis and Lon Harris put out a challenge on This Week in Startups:
              $5,000 + a guest spot to whoever builds a live AI sidebar with 4 personas
              watching the pod in real-time. Open source. Ship it.
            </p>
            <p>It shipped — as a Chrome extension that works on any YouTube video, not just TWiST.</p>
            <div className="shoutout">
              Built by{" "}
              <a href="https://sethrininger.dev" target="_blank" rel="noopener noreferrer">
                Seth Rininger
              </a>
              &nbsp; for{" "}
              <a href="https://x.com/twistartups" target="_blank" rel="noopener noreferrer">
                @TWiStartups
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="footer-links">
            <a href="https://github.com/Sethmr/peanut.gallery" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://sethrininger.dev" target="_blank" rel="noopener noreferrer">
              Seth Rininger
            </a>
            <a href="https://x.com/twistartups" target="_blank" rel="noopener noreferrer">
              TWiST
            </a>
            <Link href="/watch">Reference App</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <p>
            MIT Licensed. Open source — self-host for full privacy.
            Fact-checking powered by Brave Search.
          </p>
        </footer>
      </div>
    </>
  );
}
