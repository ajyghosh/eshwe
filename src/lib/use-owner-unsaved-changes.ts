"use client";

import { useEffect } from "react";

const discardMessage = "You have unsaved product changes. Discard them and leave?";

export function useOwnerUnsavedChanges(dirty: boolean, saving: boolean) {
  useEffect(() => {
    if (!dirty && !saving) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function followLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, location.href);
      // Full document navigations are covered by the browser's unload warning.
      if (target.origin !== location.origin || (target.pathname === location.pathname && target.search === location.search)) return;
      if (saving || !window.confirm(discardMessage)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [dirty, saving]);
}
