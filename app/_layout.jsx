import { Slot } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import AuthGuard from "./guards/AuthGuard";

// Global reset to eliminate default browser black focus outline/ring across the entire web application
if (Platform.OS === "web" && typeof document !== "undefined") {
  const styleId = "greentrace-disable-input-outline";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      input, textarea, [contenteditable="true"] {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }
      input:focus, textarea:focus, [contenteditable="true"]:focus,
      input:active, textarea:active, [contenteditable="true"]:active,
      input:focus-visible, textarea:focus-visible, [contenteditable="true"]:focus-visible {
        outline: none !important;
        outline-style: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const styleId = "greentrace-disable-input-outline";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          input, textarea, [contenteditable="true"] {
            outline: none !important;
            outline-style: none !important;
            outline-width: 0 !important;
            box-shadow: none !important;
          }
          input:focus, textarea:focus, [contenteditable="true"]:focus,
          input:active, textarea:active, [contenteditable="true"]:active,
          input:focus-visible, textarea:focus-visible, [contenteditable="true"]:focus-visible {
            outline: none !important;
            outline-style: none !important;
            outline-width: 0 !important;
            box-shadow: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <AuthGuard>
      <Slot />
    </AuthGuard>
  );
}
