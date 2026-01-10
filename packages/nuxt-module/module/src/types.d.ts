import type { ModuleOptions } from "./module";

declare module "@nuxt/schema" {
  interface NuxtConfig {
    graphqlCascade?: ModuleOptions;
  }
  interface NuxtOptions {
    graphqlCascade?: ModuleOptions;
  }
}

export { ModuleOptions };
