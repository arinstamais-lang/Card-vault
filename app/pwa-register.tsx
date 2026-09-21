"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function register() {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Installability still works on iPhone via Add to Home Screen without a worker.
      });
    }

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
