"use client";

import { useEffect } from "react";

/**
 * Client-side IntersectionObserver for fade-in animations.
 * Extracted so the landing page can be a Server Component.
 * Uses requestAnimationFrame to ensure DOM is fully painted before observing.
 */
export default function FadeInObserver() {
  useEffect(() => {
    // Wait for next frame to ensure all server-rendered DOM is painted
    const raf = requestAnimationFrame(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );

      document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

      // Store observer for cleanup
      (window as unknown as Record<string, IntersectionObserver>).__fadeObserver = observer;
    });

    return () => {
      cancelAnimationFrame(raf);
      const obs = (window as unknown as Record<string, IntersectionObserver>).__fadeObserver;
      if (obs) obs.disconnect();
    };
  }, []);

  return null;
}
