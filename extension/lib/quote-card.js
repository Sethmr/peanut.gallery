// extension/lib/quote-card.js
// Canvas-based PNG renderer for the "Make a quote card" feed action.
//
// Exposes a single global: window.PGQuoteCard = { buildQuoteCardBlob }
//
// buildQuoteCardBlob(entry, packId, theme) → Promise<Blob>
//   entry   : feedEntries record — { id, personaId, personaName, role,
//             text, transcript, timestamp }
//   packId  : active pack ("howard" | "twist")
//   theme   : "paper" | "night"
//
// Design: pure OffscreenCanvas render with no DOM dependencies beyond
// document.fonts.ready + getComputedStyle for CSS-var colours.
//
// Font approach: fonts are already loaded by sidepanel.html's Google
// Fonts link element (Anton, Oswald, Source Serif 4). We gate on
// document.fonts.ready and then reference the same family names in
// ctx.font strings — no extra FontFace dance needed.
//
// Mascot approach: personaMascotHTML() (defined in sidepanel.js, which
// loads after this file) returns an SVG string with a 64×64 viewBox.
// We inject explicit width/height, create a Blob URL, draw via
// HTMLImageElement, then revoke. No eval, no remote fetches —
// privacy posture preserved (Design Principle #5).

(function (global) {
  "use strict";

  // ── Layout constants ────────────────────────────────────────────────
  const SIZE       = 1200;
  const MASTHEAD_H = 180;
  const FOOTER_H   =  90;
  const PAD        =  72;   // horizontal gutter inside card

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Read the active theme's CSS custom properties from the document root.
   * Must be called from a document context (not a worker).
   */
  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    const get = (v) => style.getPropertyValue(v).trim();
    return {
      paper  : get("--paper")   || "#f1ead8",
      paper2 : get("--paper-2") || "#e9e0c5",
      ink    : get("--ink")     || "#111111",
      ink2   : get("--ink-2")   || "#2a2824",
      ink3   : get("--ink-3")   || "#5a564c",
      stamp  : get("--stamp")   || "#c8261d",
      rule   : get("--rule")    || "#111111",
    };
  }

  /**
   * Split `text` into lines that fit within `maxWidth` pixels at the
   * current ctx.font setting. Respects existing newline characters.
   */
  function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split("\n");
    const out = [];
    for (const para of paragraphs) {
      const words = para.split(" ");
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > maxWidth) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  /**
   * Draw wrapped text starting at (x, y) with the given lineHeight.
   * Returns the y coordinate after the last line.
   * Stops drawing (and returns early with a negative sentinel) if the
   * next line would exceed `maxY`, preventing overflow.
   */
  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxY) {
    const lines = wrapText(ctx, text, maxWidth);
    for (const line of lines) {
      if (maxY !== undefined && y > maxY) break;
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  /** Load an image from a URL, returning a Promise<HTMLImageElement>. */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed: " + url));
      img.src = url;
    });
  }

  /**
   * Inject explicit width/height into an SVG string so browsers don't
   * default to 0×0 when loading it as an <img> src.
   */
  function sizeSvg(svgStr, w, h) {
    return svgStr.replace(
      /^<svg\b/,
      `<svg width="${w}" height="${h}"`
    );
  }

  // ── Main render function ─────────────────────────────────────────────

  /**
   * buildQuoteCardBlob(entry, packId, theme) → Promise<Blob>
   *
   * Renders a 1200×1200 Broadsheet-style PNG. All rendering happens on
   * an OffscreenCanvas so the main thread is never blocked.
   */
  async function buildQuoteCardBlob(entry, packId, _theme) {
    // Gate on fonts: Google Fonts are loaded by sidepanel.html so
    // document.fonts.ready is sufficient — no separate FontFace call.
    await document.fonts.ready;

    const c  = getThemeColors();
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx    = canvas.getContext("2d");

    // ── Full background ─────────────────────────────────────────────
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Masthead band ───────────────────────────────────────────────
    ctx.fillStyle = c.ink;
    ctx.fillRect(0, 0, SIZE, MASTHEAD_H);

    // Wordmark: "THE PEANUT GALLERY"
    ctx.fillStyle  = c.paper;
    ctx.textAlign  = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 78px 'Anton', 'Oswald', sans-serif`;
    ctx.fillText("THE PEANUT GALLERY", SIZE / 2, 100);

    // Top thin rule under wordmark
    ctx.fillStyle = c.stamp;
    ctx.fillRect(PAD, 110, SIZE - PAD * 2, 3);

    // Vol/No/Date rail
    ctx.fillStyle = c.paper2;
    ctx.font = `500 21px 'Oswald', sans-serif`;
    const dateStr = new Date(entry.timestamp).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    ctx.fillText(
      `BROADSHEET EDITION  ·  ${dateStr.toUpperCase()}`,
      SIZE / 2, 148
    );

    // Bottom rule of masthead (paper-colour stripe as separator)
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, MASTHEAD_H - 4, SIZE, 4);

    let y = MASTHEAD_H;

    // ── Quote block (only when transcript is present) ────────────────
    const transcript = (entry.transcript || "").trim();
    const hasTranscript = transcript.length > 0;

    if (hasTranscript) {
      const QUOTE_H = 420;
      const blockBottom = y + QUOTE_H;

      // Subtle tinted background for quote block
      ctx.fillStyle = c.paper2;
      ctx.fillRect(0, y, SIZE, QUOTE_H);

      // Decorative open-quote mark
      ctx.font = `italic 160px 'Source Serif 4', Georgia, serif`;
      ctx.fillStyle = c.ink3;
      ctx.textAlign  = "left";
      ctx.textBaseline = "top";
      ctx.globalAlpha = 0.18;
      ctx.fillText("\u201C", PAD, y + 8);
      ctx.globalAlpha = 1;

      // Transcript text
      ctx.font = `italic 600 34px 'Source Serif 4', Georgia, serif`;
      ctx.fillStyle = c.ink;
      ctx.textAlign  = "left";
      ctx.textBaseline = "top";
      const qTextX = PAD + 68;
      const qMaxW  = SIZE - qTextX - PAD;
      drawWrappedText(ctx, transcript, qTextX, y + 56, qMaxW, 50, blockBottom - 60);

      // Decorative close-quote mark
      ctx.font = `italic 160px 'Source Serif 4', Georgia, serif`;
      ctx.fillStyle = c.ink3;
      ctx.textAlign  = "right";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 0.18;
      ctx.fillText("\u201D", SIZE - PAD, blockBottom - 8);
      ctx.globalAlpha = 1;

      y += QUOTE_H;

      // ── Byline rule ──────────────────────────────────────────────
      const RULE_H = 52;
      ctx.strokeStyle = c.rule;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 18);
      ctx.lineTo(SIZE - PAD, y + 18);
      ctx.stroke();

      ctx.fillStyle    = c.ink2;
      ctx.font         = `italic 28px 'Source Serif 4', Georgia, serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u2014", SIZE / 2, y + 18);

      y += RULE_H;
    }

    // ── Response block ───────────────────────────────────────────────
    const responseTop  = y;
    const responseMaxY = SIZE - FOOTER_H - 24; // 24 px breathing room above footer

    // Mascot avatar (top-left of response block)
    const MASCOT_SIZE = 96;
    const mascotX     = PAD;
    const mascotY     = responseTop + 24;

    const mascotFn = typeof personaMascotHTML === "function"
      ? personaMascotHTML
      : null;
    const svgStr = mascotFn ? mascotFn(entry.personaId, packId || "howard") : null;

    if (svgStr) {
      try {
        const sized  = sizeSvg(svgStr, MASCOT_SIZE, MASCOT_SIZE);
        const blob   = new Blob([sized], { type: "image/svg+xml;charset=utf-8" });
        const url    = URL.createObjectURL(blob);
        const img    = await loadImage(url);
        ctx.drawImage(img, mascotX, mascotY, MASCOT_SIZE, MASCOT_SIZE);
        URL.revokeObjectURL(url);
      } catch (_) {
        // Mascot render failed — draw a placeholder circle
        ctx.beginPath();
        ctx.arc(mascotX + MASCOT_SIZE / 2, mascotY + MASCOT_SIZE / 2, MASCOT_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = c.paper2;
        ctx.fill();
        ctx.strokeStyle = c.ink3;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Persona name + role tag (right of mascot)
    const nameX = mascotX + MASCOT_SIZE + 20;
    const nameW = SIZE - nameX - PAD;

    ctx.fillStyle    = c.ink;
    ctx.font         = `700 30px 'Oswald', sans-serif`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    const displayName = (entry.personaName || entry.personaId || "").toUpperCase();
    ctx.fillText(displayName, nameX, mascotY + 6);

    ctx.fillStyle = c.stamp;
    ctx.font      = `600 21px 'Oswald', sans-serif`;
    ctx.fillText((entry.role || "").toUpperCase(), nameX, mascotY + 44);

    // Response text (below mascot block)
    const textY = mascotY + MASCOT_SIZE + 28;
    ctx.fillStyle    = c.ink;
    ctx.font         = `400 34px 'Source Serif 4', Georgia, serif`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    drawWrappedText(ctx, entry.text || "", PAD, textY, SIZE - PAD * 2, 50, responseMaxY);

    // ── Footer band ──────────────────────────────────────────────────
    const footerY = SIZE - FOOTER_H;

    ctx.fillStyle = c.ink;
    ctx.fillRect(0, footerY, SIZE, FOOTER_H);

    // Stamp-colour accent stripe along the top of the footer
    ctx.fillStyle = c.stamp;
    ctx.fillRect(0, footerY, SIZE, 5);

    // Attribution
    ctx.fillStyle    = c.paper;
    ctx.font         = `600 26px 'Oswald', sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("peanutgallery.live", SIZE / 2, footerY + (FOOTER_H + 5) / 2);

    return canvas.convertToBlob({ type: "image/png" });
  }

  // ── Public API ───────────────────────────────────────────────────────
  global.PGQuoteCard = { buildQuoteCardBlob };
})(typeof self !== "undefined" ? self : window);
