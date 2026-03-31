import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { createBaseConfig } from "../vite.shared.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");

await rm(distDir, { recursive: true, force: true });

const baseConfig = createBaseConfig();

await build({
  ...baseConfig,
  root: rootDir,
  build: {
    outDir: distDir,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(rootDir, "sidepanel.html")
      }
    }
  }
});

await build({
  ...baseConfig,
  root: rootDir,
  publicDir: false,
  build: {
    outDir: distDir,
    emptyOutDir: false,
    lib: {
      entry: resolve(rootDir, "src/background/index.ts"),
      formats: ["es"],
      fileName: () => "assets/background.js"
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/background.js"
      }
    }
  }
});

await build({
  ...baseConfig,
  root: rootDir,
  publicDir: false,
  build: {
    outDir: distDir,
    emptyOutDir: false,
    lib: {
      entry: resolve(rootDir, "src/content/index.ts"),
      formats: ["iife"],
      name: "CoffeeCaptureContentScript",
      fileName: () => "assets/content.js"
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/content.js",
        extend: true
      }
    }
  }
});
