"use client";

import { useEffect } from "react";

const MOBILE_APP_BACKGROUND = "#fffaf2";
const MOBILE_APP_SCROLLBAR_CLASS = "mobile-app-scrollbar-hidden";

export function MobileAppViewportBackground() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBackground = html.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;

    html.style.backgroundColor = MOBILE_APP_BACKGROUND;
    body.style.backgroundColor = MOBILE_APP_BACKGROUND;
    html.classList.add(MOBILE_APP_SCROLLBAR_CLASS);
    body.classList.add(MOBILE_APP_SCROLLBAR_CLASS);

    return () => {
      html.style.backgroundColor = previousHtmlBackground;
      body.style.backgroundColor = previousBodyBackground;
      html.classList.remove(MOBILE_APP_SCROLLBAR_CLASS);
      body.classList.remove(MOBILE_APP_SCROLLBAR_CLASS);
    };
  }, []);

  return null;
}
