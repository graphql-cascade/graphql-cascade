import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import { GraphQLSchema } from "graphql";
import { CascadeVisitor } from "./visitor";

export interface CascadePluginConfig {
  /**
   * Customize the import path for cascade core types
   * @default '@graphql-cascade/client'
   */
  cascadeImportFrom?: string;

  /**
   * Generate union type helpers
   * @default true
   */
  generateUnionHelpers?: boolean;

  /**
   * Generate type guards for cascade responses
   * @default true
   */
  generateTypeGuards?: boolean;
}

export const plugin: PluginFunction<CascadePluginConfig> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: CascadePluginConfig,
) => {
  const visitor = new CascadeVisitor(schema, config);

  // Visit all documents and extract cascade patterns
  const operations = documents.flatMap(
    (doc) => doc.document?.definitions || [],
  );

  const content = visitor.buildContent(operations);

  return {
    prepend: visitor.getImports(),
    content,
  };
};

export const preset = {
  buildGeneratesSection: (options: any) => {
    return [
      {
        plugins: [
          { add: { content: "/* eslint-disable */" } },
          "typescript",
          "typescript-operations",
          "@graphql-cascade/codegen",
        ],
        config: {
          skipTypename: false,
          enumsAsTypes: true,
          ...options.config,
        },
      },
    ];
  },
};
