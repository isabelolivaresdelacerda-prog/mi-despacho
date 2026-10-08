import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Versión de cada publicación: la app la compara con /version.json y, si hay una más nueva, se recarga sola
const VERSION = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const version = () => ({ name: "version", generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: VERSION }) }); } });

export default defineConfig({ plugins: [react(), version()], define: { __VERSION__: JSON.stringify(VERSION) } });
