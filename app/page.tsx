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
            <span className="peanut-mark" aria-hidden="true">🥜</span> Peanut Gallery
          </a>
          <ul className="nav-links">
            <li><a href="#demo">Demo</a></li>
            <li><a href="#install">Install</a></li>
            <li><a href="#personas">Cast</a></li>
            <li><a href="#how">How</a></li>
            <li><a href="#stack">Stack</a></li>
            <li>
              <a href="#install" className="nav-cta">
                Add to Chrome
              </a>
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <div className="pulse"></div>
              On Air · Live on the Chrome Web Store
            </div>

            <h1>
              An AI writers&apos; room for
              <br />
              <span className="gradient-text">any YouTube video.</span>
            </h1>

            <p className="hero-sub">
              Peanut Gallery is a free Chrome extension that sits next to any YouTube video and reacts in real-time.
              4 AI personas — a fact-checker, a sound effects guy, a comedy writer, a cynical troll —
              watch the show with you through a native Chrome side panel. Pick your lineup:{" "}
              <strong>Howard Stern crew</strong> or the <strong>This Week in Startups</strong> cast.
              No tab switching. No screen-share picker. Audio captured silently while you watch.
            </p>

            <div className="hero-ctas">
              <a
                href="https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Add to Chrome &rarr;
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

            {/* VIDEO CLIP — Jason's $5k bounty announcement (YouTube Short) */}
            <div className="video-section video-section--shorts">
              <iframe
                src="https://www.youtube.com/embed/xHdwcCfuy4Y?rel=0&modestbranding=1"
                title="Jason Calacanis & Lon Harris — $5k bounty announcement"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <p className="video-caption">
              The challenge, straight from{" "}
              <a href="https://x.com/jason" target="_blank" rel="noopener noreferrer">@jason</a> &amp;{" "}
              <a href="https://x.com/lonharris" target="_blank" rel="noopener noreferrer">@lonharris</a>
              {" "}on <a href="https://x.com/twistartups" target="_blank" rel="noopener noreferrer">This Week in Startups</a>
            </p>
          </div>
        </section>

        {/* BROADCAST TICKER — reinforces the live / 4-persona differentiator
            between the hero and the product demo. Keyed off the persona voice
            so it reads as "the show is already running," not as a marketing
            bullet list. Pauses on hover; respects prefers-reduced-motion. */}
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            <span><span className="ticker-accent">● On Air</span></span>
            <span>Four AI personas — live reactions</span>
            <span><span className="ticker-accent">Fact-checker</span> / Troll / Comedy Writer / Sound Guy</span>
            <span>Native Chrome side panel · no tab switching</span>
            <span><span className="ticker-accent">MIT open source</span> · self-host ready</span>
            <span>Audio captured silently via <code>chrome.tabCapture</code></span>
            <span><span className="ticker-accent">Built for the TWiST $5k bounty</span></span>
            <span>Two packs · Howard Stern crew · This Week in Startups</span>
            {/* Duplicate run — required for the -50% translateX loop to
                appear seamless. Keep the two runs identical. */}
            <span><span className="ticker-accent">● On Air</span></span>
            <span>Four AI personas — live reactions</span>
            <span><span className="ticker-accent">Fact-checker</span> / Troll / Comedy Writer / Sound Guy</span>
            <span>Native Chrome side panel · no tab switching</span>
            <span><span className="ticker-accent">MIT open source</span> · self-host ready</span>
            <span>Audio captured silently via <code>chrome.tabCapture</code></span>
            <span><span className="ticker-accent">Built for the TWiST $5k bounty</span></span>
            <span>Two packs · Howard Stern crew · This Week in Startups</span>
          </div>
        </div>

        {/* DEMO — the actual product in action */}
        <section className="content-section" id="demo">
          <div className="section-label">See it in action</div>
          <h2 className="fade-in">Two minutes with Peanut Gallery.</h2>
          <p className="section-sub fade-in">
            The extension follows a YouTube video in real-time — four personas
            reacting to the audio as it plays, all from Chrome&apos;s native side panel.
          </p>
          <div className="video-section video-section--demo fade-in">
            <iframe
              src="https://www.youtube.com/embed/UcpUBcp8TRc?rel=0&modestbranding=1"
              title="Peanut Gallery — product demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>

        {/* V1.5 WALKTHROUGH — narrated deep dive on Smart Director v2 */}
        <section className="content-section" id="walkthrough">
          <div className="section-label">Go deeper</div>
          <h2 className="fade-in">Smart Director v2 — the full walkthrough.</h2>
          <p className="section-sub fade-in">
            v1.5 adds an LLM-assisted router on top of the rule-based Director — it races against a 400ms budget and
            falls back cleanly when it misses. Seth narrates how it picks a persona, what the rule-based
            fallback looks like, and what&apos;s new since v1.4.
          </p>
          <div className="video-section video-section--demo fade-in">
            <iframe
              src="https://www.youtube.com/embed/WPyknI7-N5U?rel=0&modestbranding=1"
              title="Peanut Gallery v1.5 walkthrough — Smart Director v2, narrated by the builder"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>

        {/* INSTALL */}
        <section className="content-section" id="install">
          <div className="section-label">Install</div>
          <h2 className="fade-in">One click from the Chrome Web Store.</h2>
          <p className="section-sub fade-in">
            The extension is live — add it to Chrome, open any YouTube video, click the 🥜 icon,
            and hit <strong>Start Listening</strong>. <strong>Free to try while we grow</strong> —
            no API keys required right now, and when that changes you can drop in your own free-tier
            keys or <a href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/BUILD-YOUR-OWN-BACKEND.md" target="_blank" rel="noopener noreferrer">run your own backend</a>.
          </p>

          <div className="hero-ctas fade-in" style={{ marginTop: "2rem", marginBottom: "3rem" }}>
            <a
              href="https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Add to Chrome &rarr;
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

          <div className="status-banner fade-in">
            <h3 style={{ color: "#22c55e" }}>✓ Working product</h3>
            <p>
              Tab audio is captured silently via{" "}
              <code className="inline-code">chrome.tabCapture</code> — the same API Otter.ai and
              Fireflies use. No permission picker, no interference with playback. You hear the video;
              the AI hears it too.
            </p>
          </div>

          <div className="section-label" style={{ marginTop: "4rem" }}>Self-host</div>
          <h2 className="fade-in" style={{ fontSize: "1.75rem" }}>Prefer to run it yourself? 4 steps.</h2>
          <p className="section-sub fade-in">
            It&apos;s MIT-licensed and fully open source. Run your own backend for full privacy,
            or to swap out providers. Takes about a minute.
          </p>

          <div className="steps-grid">
            <div className="step fade-in">
              <h3>Clone the repo</h3>
              <p>
                <code className="inline-code">git clone https://github.com/Sethmr/peanut.gallery.git</code>
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
              <h3>Point at localhost</h3>
              <p>
                In the Peanut Gallery side panel, change the Backend server field to{" "}
                <code className="inline-code">http://localhost:3000</code>, then hit{" "}
                <strong>Start Listening</strong>.
              </p>
            </div>
          </div>

          <div className="section-label" style={{ marginTop: "4rem" }}>Build Your Own Backend</div>
          <h2 className="fade-in" style={{ fontSize: "1.75rem" }}>
            Not a Node shop? Rebuild the backend in your stack.
          </h2>
          <p className="section-sub fade-in">
            The extension will talk to <em>any</em> server that honors the wire spec — Go, Rust,
            Python, Elixir, whatever. Swap providers, change the persona cast, or ship a
            branded fork. The contract is documented to the byte: endpoints, SSE events,
            audio format, CORS headers, director rules, and eight curl-based acceptance tests.
          </p>
          <p className="section-sub fade-in">
            There&apos;s also a copy-paste prompt in the README you can feed to Claude or Cursor
            to scaffold a compliant backend for you.
          </p>
          <div className="hero-ctas fade-in" style={{ justifyContent: "flex-start", marginTop: "1.5rem" }}>
            <a
              href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/BUILD-YOUR-OWN-BACKEND.md"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Read the build spec &rarr;
            </a>
            <a
              href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/SELF-HOST-INSTALL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Or run the reference backend
            </a>
          </div>
        </section>

        {/* PERSONAS */}
        <section className="dark" id="personas">
          <div className="section-label">The Cast &middot; v1.5.3</div>
          <h2 className="fade-in">Two packs. Four slots. Eight peanut mascots.</h2>
          <p className="section-sub fade-in">
            Every pack ships four archetype slots — <strong>producer, troll, sound FX, joker</strong>.
            The Director is pack-agnostic; same routing, same cascade, only the voices change.
            Swap lineups from the side panel&apos;s setup dropdown; the choice persists and takes
            effect on your next Start Listening.
          </p>

          <h3 className="fade-in" style={{ marginTop: "3rem", marginBottom: "0.5rem", fontSize: "1.4rem" }}>
            Howard Stern Show{" "}
            <span style={{ color: "var(--text-secondary, #9ca3af)", fontWeight: 400, fontSize: "0.9rem" }}>
              (default)
            </span>
          </h3>
          <p className="section-sub fade-in" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
            The original spec — inspired by the Stern staff.
          </p>

          <div className="personas-grid">
            <div className="persona-card producer fade-in">
              <div className="persona-icon">🎯</div>
              <h3>Baba Booey</h3>
              <div className="persona-role">Fact-Checker &middot; Claude Haiku + Brave Search</div>
              <p>
                Monitors the conversation for factual claims and provides corrections
                or background data in real-time. Searches the web mid-show to verify
                statistics, dates, and attributions.
              </p>
              <div className="persona-quote">
                [FACT CHECK] &ldquo;Jason just said Uber was founded in 2007. It was 2009. Again.&rdquo;
              </div>
            </div>

            <div className="persona-card troll fade-in">
              <div className="persona-icon">🔥</div>
              <h3>The Cynical Troll</h3>
              <div className="persona-role">Commentary &middot; xAI Grok 4.1 Fast</div>
              <p>
                The &ldquo;chaotic or negative cynical&rdquo; commentator. Says what the audience
                is thinking but won&apos;t type. Dunks with internet-brain energy.
              </p>
              <div className="persona-quote">
                &ldquo;Oh cool, another AI wrapper. Very 2024.&rdquo;
              </div>
            </div>

            <div className="persona-card fred fade-in">
              <div className="persona-icon">🎧</div>
              <h3>Fred Norris</h3>
              <div className="persona-role">Sound Effects &middot; xAI Grok 4.1 Fast</div>
              <p>
                Supplies background context and sound effects. Communicates through
                precisely timed sound cues and the occasional razor-sharp one-liner.
              </p>
              <div className="persona-quote">
                [record scratch] Fun fact: that company went bankrupt in 2023. [sad trombone]
              </div>
            </div>

            <div className="persona-card joker fade-in">
              <div className="persona-icon">😂</div>
              <h3>Jackie Martling</h3>
              <div className="persona-role">Comedy Writer &middot; Claude Haiku</div>
              <p>
                Generates one-liners and jokes related to the current discussion.
                Setup-punchline structure, callback humor, the one who makes you spit
                out your coffee.
              </p>
              <div className="persona-quote">
                &ldquo;Jason&apos;s investment thesis: if it has &lsquo;AI&rsquo; in the name and the founder has a pulse, it&apos;s a yes.&rdquo;
              </div>
            </div>
          </div>

          <h3 className="fade-in" style={{ marginTop: "4rem", marginBottom: "0.5rem", fontSize: "1.4rem" }}>
            This Week in Startups{" "}
            <span style={{ color: "#eab308", fontWeight: 600, fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              NEW
            </span>
          </h3>
          <p className="section-sub fade-in" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
            Researched from public TWiST transcripts. Personas are <em>inspired by</em> their
            namesakes — never claim to <em>be</em> them.
          </p>

          <div className="personas-grid">
            <div className="persona-card producer fade-in">
              <div className="persona-icon">📓</div>
              <h3>Molly Wood</h3>
              <div className="persona-role">Fact-Checker &middot; Claude Haiku + Brave Search</div>
              <p>
                Calm journalistic corrections. &ldquo;According to&hellip;&rdquo; framing. Receipts
                first, take second. The one who quietly reshapes the discussion by citing
                the source everyone else forgot to check.
              </p>
              <div className="persona-quote">
                &ldquo;According to the 10-K they filed last quarter, the number&apos;s closer to 2.4 billion. Worth noting.&rdquo;
              </div>
            </div>

            <div className="persona-card troll fade-in">
              <div className="persona-icon">🎙️</div>
              <h3>Jason Calacanis</h3>
              <div className="persona-role">Provocateur &middot; xAI Grok 4.1 Fast</div>
              <p>
                Confident takes framed around founder-market fit. Warm, never mean.
                Self-aware self-promotion as a character fingerprint, not a bug. Will
                tell you why the cap table matters.
              </p>
              <div className="persona-quote">
                &ldquo;Let me tell you something — this is a founder-market-fit story, and they&apos;re not telling it well.&rdquo;
              </div>
            </div>

            <div className="persona-card fred fade-in">
              <div className="persona-icon">🎬</div>
              <h3>Lon Harris</h3>
              <div className="persona-role">The Reframe &middot; xAI Grok 4.1 Fast</div>
              <p>
                Bracket-delimited sound cues and cultural analogies as primary languages.
                Reacts to moments, never monologues. The one who turns a dry term sheet
                into a scene from <em>Succession</em>.
              </p>
              <div className="persona-quote">
                [movie trailer voice-over] &ldquo;In a world where the burn rate exceeds the runway&hellip;&rdquo;
              </div>
            </div>

            <div className="persona-card joker fade-in">
              <div className="persona-icon">📊</div>
              <h3>Alex Wilhelm</h3>
              <div className="persona-role">Data Comedian &middot; Claude Haiku</div>
              <p>
                Eight joke techniques built on data + absurdity — NUMBER-AS-PUNCH,
                COMP-BOMB, BACK-OUT-THE-THING, and more. Will tell you their burn
                rate in units of Series A rounds.
              </p>
              <div className="persona-quote">
                &ldquo;At $200k/month burn, that $4M round is — hold on — twenty months. Twenty! That&apos;s a whole pregnancy and a toddler.&rdquo;
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
              <div className="stack-name">xAI Grok 4.1 Fast</div>
              <div className="stack-role">Troll + Fred (non-reasoning, reflexive)</div>
            </div>
            <div className="stack-item fade-in">
              <div className="stack-name">Brave or xAI Live Search</div>
              <div className="stack-role">Fact-checking — user choice</div>
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
            <Link href="/install">Install</Link>
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
