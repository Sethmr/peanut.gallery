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
            <li><a href="#personas">Personas</a></li>
            <li><a href="#how">How It Works</a></li>
            <li><a href="#stack">Stack</a></li>
            <li>
              <Link href="/watch" className="nav-cta">
                Launch App
              </Link>
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <div className="pulse"></div>
              Live Now — Try It Free
            </div>

            <h1>
              Your podcast&apos;s
              <br />
              <span className="gradient-text">AI writers&apos; room.</span>
            </h1>

            <p className="hero-sub">
              4 AI personas watch your podcast and react in real-time.
              A fact-checker keeping the host honest. A cynical troll. A sound effects guy.
              A comedy writer. All streaming alongside the conversation as it happens.
            </p>

            <div className="hero-ctas">
              <Link href="/watch" className="btn-primary">
                Try It Now — Free
              </Link>
              <a
                href="https://github.com/Sethmr/peanut.gallery"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View on GitHub
              </a>
            </div>
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
          <h2 className="fade-in">Paste a URL. Watch it react.</h2>
          <p className="section-sub fade-in">
            No setup wizards. No config files. Just a YouTube link and four AI personas
            fighting for the best take.
          </p>

          <div className="steps-grid">
            <div className="step fade-in">
              <h3>Live Audio Capture</h3>
              <p>
                Paste any YouTube live stream or video URL. Audio is extracted in
                real-time via yt-dlp and piped through FFmpeg.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Real-Time Transcription</h3>
              <p>
                Audio streams to Deepgram&apos;s Nova-3 model over WebSocket. Sub-300ms
                latency. Punctuated, accurate, instant.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Director + Cascade</h3>
              <p>
                A rule-based Director picks the best persona for each moment, then
                cascades to others with decreasing probability and staggered timing.
              </p>
            </div>
            <div className="step fade-in">
              <h3>Streaming Sidebar</h3>
              <p>
                Responses stream token-by-token via SSE into a 3-column UI with
                combined feed and individual persona views. Dark theme. Auto-scroll.
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

        {/* ORIGIN */}
        <section className="content-section">
          <div className="origin-box fade-in">
            <h2>Built for a bounty.</h2>
            <p>
              Jason Calacanis and Lon Harris put out a challenge on This Week in Startups:
              $5,000 + a guest spot to whoever builds a live AI sidebar with 4 personas
              watching the pod in real-time. Open source. Ship it.
            </p>
            <p>So we shipped it.</p>
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
            <Link href="/watch">Launch App</Link>
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
