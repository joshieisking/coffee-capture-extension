import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export function createBaseConfig() {
  return {
    plugins: [react()],
    publicDir: "public",
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src")
      }
    }
  };
}
