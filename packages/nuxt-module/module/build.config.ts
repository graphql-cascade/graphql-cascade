import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: [
    "src/module",
    // The composables are imported by the Nuxt app, which compiles them
    { input: "src/runtime/", outDir: "dist/runtime", builder: "mkdist" },
  ],
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  externals: [
    "@nuxt/kit",
    "@nuxt/schema",
    "nuxt",
    "vue",
    "@apollo/client",
    "@vue/apollo-composable",
    "@graphql-cascade/apollo",
  ],
});
