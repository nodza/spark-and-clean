"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

const DARK_SELECTOR = "[data-contrast='dark']";

function rectsOverlap(a: DOMRect, b: DOMRect) {
  return !(a.bottom < b.top || a.top > b.bottom || a.right < b.left || a.left > b.right);
}

/** True when `ref` overlaps a `[data-contrast=dark]` surface (e.g. hero, navy bands). */
export function useOverlapsDarkSurface(ref: RefObject<HTMLElement | null>) {
  const [onDark, setOnDark] = useState(false);

  useLayoutEffect(() => {
    let frame = 0;

    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const fab = node.getBoundingClientRect();
      const darkSurfaces = document.querySelectorAll(DARK_SELECTOR);
      let hit = false;
      darkSurfaces.forEach((el) => {
        if (rectsOverlap(fab, el.getBoundingClientRect())) hit = true;
      });
      setOnDark(hit);
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return onDark;
}
