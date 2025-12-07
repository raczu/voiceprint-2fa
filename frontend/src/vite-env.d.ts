/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ENVIRONMENT: "development" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
