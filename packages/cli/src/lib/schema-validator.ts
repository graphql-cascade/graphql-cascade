import * as fs from "fs";
import {
  GraphQLSchema,
  buildClientSchema,
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isUnionType,
  type GraphQLArgument,
  type GraphQLDirective,
  type GraphQLNamedType,
  type GraphQLObjectType,
} from "graphql";
import { REFERENCE_SCHEMA } from "./reference-schema";
export interface ValidationResult {
  errors: string[];
  warnings: string[];
  compatibility: number;
}

/**
 * Load a GraphQL schema from SDL files (.graphql, .gql), merged into one
 * schema, or from one JSON introspection result.
 */
export function loadSchema(filePaths: string | string[]): GraphQLSchema {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      throw new Error(`Schema file not found: ${path}`);
    }
  }

  if (paths.length === 1 && paths[0].endsWith(".json")) {
    return loadIntrospection(fs.readFileSync(paths[0], "utf-8"));
  }

  try {
    return buildSchema(
      paths.map((path) => fs.readFileSync(path, "utf-8")).join("\n"),
    );
  } catch (error) {
    throw new Error(
      `Failed to parse GraphQL SDL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function loadIntrospection(content: string): GraphQLSchema {
  try {
    const introspection = JSON.parse(content);
    const schema =
      "__schema" in introspection
        ? introspection.__schema
        : introspection.data?.__schema;
    if (!schema) {
      throw new Error("Invalid introspection query result");
    }
    return buildClientSchema({ __schema: schema });
  } catch (error) {
    throw new Error(
      `Failed to parse JSON schema: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Types a mutation can return to carry a cascade. */
const CASCADE_RESULT_TYPES = [
  "CascadeResponse",
  "CascadePayload",
  "CascadeFailure",
];

/** Reference types that a schema including them must define exactly. */
const CASCADE_ROOTS = [
  ...CASCADE_RESULT_TYPES,
  "CascadeUpdateEvent",
  "CascadeInfo",
];

const reference = buildSchema(REFERENCE_SCHEMA);

/**
 * Validate a GraphQL schema against the specification.
 *
 * Errors:
 * - the schema has none of the types mutations return cascades with;
 * - a Cascade type or directive differs from the reference schema;
 * - a type with an `id` field does not implement `Node`.
 *
 * Warnings: mutations whose results carry no cascade, which the
 * specification allows alongside Cascade mutations.
 */
export function validateCascadeCompatibility(
  schema: GraphQLSchema,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = { totalChecks: 0, passedChecks: 0 };
  const check = (passed: boolean, report: () => void) => {
    stats.totalChecks++;
    if (passed) stats.passedChecks++;
    else report();
  };

  check(
    CASCADE_RESULT_TYPES.some((name) => schema.getType(name)),
    () =>
      errors.push(
        "The schema has no CascadeResponse, CascadePayload or CascadeFailure type, " +
          "so no mutation can return a cascade. Add the types from the reference schema.",
      ),
  );

  for (const name of cascadeTypeNames()) {
    const type = schema.getType(name);
    if (!type) continue;
    check(typeSignature(type) === typeSignature(reference.getType(name)!), () =>
      errors.push(`${name} differs from the reference schema.`),
    );
  }

  for (const expected of reference.getDirectives()) {
    const directive = schema.getDirective(expected.name);
    if (!directive || expected.astNode === undefined) continue;
    check(directiveSignature(directive) === directiveSignature(expected), () =>
      errors.push(`@${expected.name} differs from the reference schema.`),
    );
  }

  const node = schema.getType("Node");
  for (const type of userObjectTypes(schema)) {
    if (!("id" in type.getFields())) continue;
    check(
      node !== undefined && type.getInterfaces().some((i) => i.name === "Node"),
      () =>
        errors.push(
          `${type.name} has an id but does not implement Node; entities must, ` +
            "so cascades can carry them.",
        ),
    );
  }

  const mutation = schema.getMutationType();
  for (const field of Object.values(mutation?.getFields() ?? {})) {
    const result = getNamedType(field.type);
    check(carriesCascade(result), () =>
      warnings.push(
        `Mutation.${field.name} returns ${result.name}, which carries no cascade: ` +
          "clients cannot update their caches from it.",
      ),
    );
  }

  return {
    errors,
    warnings,
    compatibility: calculateCompatibility(stats),
  };
}

/** The reference types reachable from the Cascade roots. */
function cascadeTypeNames(): Set<string> {
  const names = new Set<string>();
  const visit = (type: GraphQLNamedType) => {
    if (names.has(type.name)) return;
    names.add(type.name);
    if (isObjectType(type) || isInterfaceType(type)) {
      type.getInterfaces().forEach(visit);
      for (const field of Object.values(type.getFields())) {
        visit(getNamedType(field.type));
      }
    } else if (isUnionType(type)) {
      type.getTypes().forEach(visit);
    }
  };
  for (const name of CASCADE_ROOTS) visit(reference.getType(name)!);
  for (const name of [...names]) {
    if (reference.getType(name)?.astNode === undefined) names.delete(name);
  }
  return names;
}

/** Object types the schema defines itself, excluding root and Cascade types. */
function userObjectTypes(schema: GraphQLSchema): GraphQLObjectType[] {
  const roots = new Set(
    [
      schema.getQueryType(),
      schema.getMutationType(),
      schema.getSubscriptionType(),
    ]
      .filter((type) => type !== null && type !== undefined)
      .map((type) => type!.name),
  );
  const cascadeTypes = cascadeTypeNames();
  return Object.values(schema.getTypeMap()).filter(
    (type): type is GraphQLObjectType =>
      isObjectType(type) &&
      !type.name.startsWith("__") &&
      !roots.has(type.name) &&
      !cascadeTypes.has(type.name),
  );
}

/** Whether a mutation result type carries a cascade. */
function carriesCascade(type: GraphQLNamedType): boolean {
  const implementsInterface = (name: string) =>
    isObjectType(type) && type.getInterfaces().some((i) => i.name === name);
  if (
    implementsInterface("CascadeResponse") ||
    implementsInterface("CascadePayload")
  ) {
    return true;
  }
  return (
    isUnionType(type) &&
    type
      .getTypes()
      .some((member) =>
        member.getInterfaces().some((i) => i.name === "CascadePayload"),
      )
  );
}

/** A type's structure, ignoring descriptions and the order of members. */
function typeSignature(type: GraphQLNamedType): string {
  if (isObjectType(type) || isInterfaceType(type)) {
    const interfaces = type
      .getInterfaces()
      .map((i) => i.name)
      .sort();
    const fields = Object.values(type.getFields())
      .map(
        (field) =>
          `${field.name}(${argumentsSignature(field.args)}): ${String(field.type)}`,
      )
      .sort();
    return `${isObjectType(type) ? "type" : "interface"} ${interfaces.join("&")} {${fields.join(", ")}}`;
  }
  if (isUnionType(type)) {
    return `union ${type
      .getTypes()
      .map((member) => member.name)
      .sort()
      .join("|")}`;
  }
  if (isEnumType(type)) {
    return `enum {${type
      .getValues()
      .map((value) => value.name)
      .sort()
      .join(", ")}}`;
  }
  if (isInputObjectType(type)) {
    return `input {${Object.values(type.getFields())
      .map(
        (field) =>
          `${field.name}: ${String(field.type)} = ${JSON.stringify(field.defaultValue)}`,
      )
      .sort()
      .join(", ")}}`;
  }
  return "scalar";
}

function directiveSignature(directive: GraphQLDirective): string {
  return `(${argumentsSignature(directive.args)}) on ${[...directive.locations]
    .sort()
    .join("|")}`;
}

function argumentsSignature(args: readonly GraphQLArgument[]): string {
  return args
    .map(
      (arg) =>
        `${arg.name}: ${String(arg.type)} = ${JSON.stringify(arg.defaultValue)}`,
    )
    .sort()
    .join(", ");
}

/**
 * Calculate compatibility percentage based on checks passed.
 */
function calculateCompatibility(stats: {
  totalChecks: number;
  passedChecks: number;
}): number {
  if (stats.totalChecks === 0) {
    return 100;
  }
  return Math.round((stats.passedChecks / stats.totalChecks) * 100);
}
