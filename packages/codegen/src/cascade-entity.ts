import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLCompositeType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  Kind,
  SelectionSetNode,
  getNamedType,
  isAbstractType,
  isCompositeType,
  isLeafType,
  isObjectType,
} from "graphql";

export interface CascadeEntityFragmentOptions {
  /** Name of the generated fragment. @default "CascadeEntity" */
  fragmentName?: string;
  /** Interface every cascade entity implements. @default "Node" */
  interfaceName?: string;
}

/** Selected fields of one type; `null` marks a leaf. */
interface Selection {
  type: GraphQLNamedType;
  fields: Map<string, Selection | null>;
}

/**
 * Build the fragment that cascade mutations select entities with
 * (`entity { ...CascadeEntity }`): for each type implementing the entity
 * interface, the fields the given documents read on it.
 *
 * - Entities referenced from another entity are selected as `{ id }`: they
 *   are refreshed by their own cascade entries.
 * - Embedded objects keep the union of their selected fields.
 * - Fields that take arguments are left out: each argument set is a separate
 *   cache entry, which invalidation hints cover.
 */
export function buildCascadeEntityFragment(
  schema: GraphQLSchema,
  documents: ReadonlyArray<{ document?: DocumentNode }>,
  options: CascadeEntityFragmentOptions = {},
): string {
  const fragmentName = options.fragmentName ?? "CascadeEntity";
  const interfaceName = options.interfaceName ?? "Node";

  const isEntity = (type: GraphQLNamedType): type is GraphQLObjectType =>
    isObjectType(type) &&
    type.getInterfaces().some((i) => i.name === interfaceName);
  const entitiesOf = (type: GraphQLNamedType): GraphQLObjectType[] => {
    if (isEntity(type)) return [type];
    return isAbstractType(type)
      ? schema.getPossibleTypes(type).filter(isEntity)
      : [];
  };

  const definitions = documents.flatMap((d) => d.document?.definitions ?? []);
  const fragments = new Map(
    definitions
      .filter(
        (def): def is FragmentDefinitionNode =>
          def.kind === Kind.FRAGMENT_DEFINITION &&
          def.name.value !== fragmentName,
      )
      .map((def) => [def.name.value, def]),
  );

  /** Fields of a selection set, flattening fragments, with their parent type. */
  function* fieldsOf(
    selectionSet: SelectionSetNode,
    parent: GraphQLCompositeType,
    seen: ReadonlySet<string>,
  ): Generator<{ node: FieldNode; parent: GraphQLCompositeType }> {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        yield { node: selection, parent };
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        const condition = selection.typeCondition?.name.value;
        const type = condition ? schema.getType(condition) : parent;
        if (type && isCompositeType(type)) {
          yield* fieldsOf(selection.selectionSet, type, seen);
        }
      } else {
        const name = selection.name.value;
        const fragment = fragments.get(name);
        const type =
          fragment && schema.getType(fragment.typeCondition.name.value);
        if (fragment && type && isCompositeType(type) && !seen.has(name)) {
          yield* fieldsOf(
            fragment.selectionSet,
            type,
            new Set([...seen, name]),
          );
        }
      }
    }
  }

  const fieldOf = (parent: GraphQLCompositeType, name: string) =>
    "getFields" in parent ? parent.getFields()[name] : undefined;

  /** What to select under a field of the given type. */
  function selectionFor(
    type: GraphQLNamedType,
    selectionSet: SelectionSetNode | undefined,
    seen: ReadonlySet<string>,
  ): Selection | null {
    if (isLeafType(type)) return null;
    if (entitiesOf(type).length > 0) {
      return { type, fields: new Map([["id", null]]) };
    }
    const selection: Selection = { type, fields: new Map() };
    if (selectionSet && isCompositeType(type)) {
      for (const { node, parent } of fieldsOf(selectionSet, type, seen)) {
        const field = fieldOf(parent, node.name.value);
        if (!field || field.args.length > 0) continue;
        merge(
          selection,
          node.name.value,
          selectionFor(getNamedType(field.type), node.selectionSet, seen),
        );
      }
    }
    return selection;
  }

  const entities = new Map<string, Selection>();
  function collect(
    selectionSet: SelectionSetNode,
    type: GraphQLCompositeType,
    seen: ReadonlySet<string>,
  ): void {
    for (const { node, parent } of fieldsOf(selectionSet, type, seen)) {
      const name = node.name.value;
      const field = fieldOf(parent, name);
      if (!field || name.startsWith("__")) continue;
      const named = getNamedType(field.type);
      if (field.args.length === 0 && name !== "id") {
        for (const entity of entitiesOf(parent)) {
          const target = entities.get(entity.name) ?? {
            type: entity,
            fields: new Map(),
          };
          entities.set(entity.name, target);
          merge(target, name, selectionFor(named, node.selectionSet, seen));
        }
      }
      if (node.selectionSet && isCompositeType(named)) {
        collect(node.selectionSet, named, seen);
      }
    }
  }

  for (const def of definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      const root = schema.getRootType(def.operation);
      if (root) collect(def.selectionSet, root, new Set());
    } else if (
      def.kind === Kind.FRAGMENT_DEFINITION &&
      fragments.has(def.name.value)
    ) {
      const type = schema.getType(def.typeCondition.name.value);
      if (type && isCompositeType(type)) {
        collect(def.selectionSet, type, new Set([def.name.value]));
      }
    }
  }

  const blocks = [...entities.values()]
    .filter((entity) => entity.fields.size > 0)
    .sort((a, b) => a.type.name.localeCompare(b.type.name))
    .map(
      (entity) =>
        `  ... on ${entity.type.name} {\n${print(entity, "    ")}  }\n`,
    );
  return `fragment ${fragmentName} on ${interfaceName} {\n  id\n${blocks.join("")}}\n`;
}

function merge(
  selection: Selection,
  name: string,
  child: Selection | null,
): void {
  const existing = selection.fields.get(name);
  if (!existing || !child) {
    if (!selection.fields.has(name)) selection.fields.set(name, child);
    return;
  }
  for (const [field, grandchild] of child.fields) {
    merge(existing, field, grandchild);
  }
}

/** Fields in schema order, one per line, nested selections indented. */
function print(selection: Selection, indent: string): string {
  const order =
    "getFields" in selection.type
      ? Object.keys(selection.type.getFields())
      : [...selection.fields.keys()];
  return [...selection.fields]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([name, child]) =>
      child
        ? `${indent}${name} {\n${print(child, `${indent}  `)}${indent}}\n`
        : `${indent}${name}\n`,
    )
    .join("");
}
