"use client";

// Thin wrapper around react-pageflip (StPageFlip) so it can be dynamically imported
// with ssr:false — the library touches the DOM at construction and must not run on the
// server. `flipRef` is a normal prop (not React `ref`) because next/dynamic doesn't
// forward refs; the parent uses it to drive turnToPage / prev / next.
import HTMLFlipBook from "react-pageflip";

export default function RealFlip({ flipRef, children, ...props }) {
  return (
    <HTMLFlipBook ref={flipRef} {...props}>
      {children}
    </HTMLFlipBook>
  );
}
