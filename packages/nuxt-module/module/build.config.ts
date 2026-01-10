import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/module"],
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  externals: [
    "@nuxt/kit",
    "@nuxt/schema",
    "#app",
    "#imports",
    "vue",
    "@apollo/client",
    "@vue/apollo-composable",
  ],
});
