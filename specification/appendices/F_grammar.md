# Appendix F: Formal Grammar

This appendix provides the formal EBNF grammar for GraphQL Cascade data structures, along with examples and railroad diagram descriptions.

## Overview

The GraphQL Cascade specification defines a formal grammar for all data structures used in cascade responses. This grammar ensures consistent serialization and parsing across implementations.

## EBNF Grammar

The complete grammar is defined in `specification/grammar.ebnf`. This appendix provides detailed explanations and examples for each production rule.

## Core Data Structures

### CascadeResponse

The root structure for all Cascade-compliant mutation responses.

```
CascadeResponse ::= '{'
    '"success"' ':' Boolean ','
    '"errors"' ':' CascadeErrorArray ','
    '"data"' ':' ( MutationPayload | 'null' ) ','
    '"cascade"' ':' CascadeUpdates
'}'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                    CascadeResponse                         │
├─────────────────────────────────────────────────────────────┤
│  { "success": Boolean, "errors": [...], "data": ..., "cascade": ... } │
└─────────────────────────────────────────────────────────────┘
```

**Example:**
```json
{
  "success": true,
  "errors": [],
  "data": {
    "updateUser": {
      "id": "123",
      "name": "John Doe"
    }
  },
  "cascade": {
    "updated": [...],
    "deleted": [...],
    "invalidations": [...],
    "metadata": {...}
  }
}
```

### CascadeUpdates

Container for all changes resulting from a mutation.

```
CascadeUpdates ::= '{'
    '"updated"' ':' UpdatedEntityArray ','
    '"deleted"' ':' DeletedEntityArray ','
    '"invalidations"' ':' QueryInvalidationArray ','
    '"typeInvalidations"' ':' TypeInvalidationArray ','
    '"metadata"' ':' CascadeMetadata
'}'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                     CascadeUpdates                          │
├─────────────────────────────────────────────────────────────┤
│  { "updated": [...], "deleted": [...], "invalidations": [...], │
│    "typeInvalidations": [...], "metadata": ... }            │
└─────────────────────────────────────────────────────────────┘
```

### UpdatedEntity

Represents an entity that was created or updated.

```
UpdatedEntity ::= '{'
    '"typename"' ':' String ','
    ( '"__typename"' ':' String ',' )?   # deprecated since 1.3.0; same value as typename
    '"id"' ':' ID ','
    '"operation"' ':' CascadeOperation ','
    '"entity"' ':' Node
'}'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                      UpdatedEntity                          │
├─────────────────────────────────────────────────────────────┤
│  { "typename": String, "id": ID, "operation": Operation, "entity": Node }   │
└─────────────────────────────────────────────────────────────┘
```

**Example:**
```json
{
  "typename": "User",
  "id": "123",
  "operation": "UPDATED",
  "entity": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### DeletedEntity

Represents an entity that was deleted.

```
DeletedEntity ::= '{'
    '"typename"' ':' String ','
    ( '"__typename"' ':' String ',' )?   # deprecated since 1.3.0; same value as typename
    '"id"' ':' ID ','
    '"deletedAt"' ':' DateTime
'}'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                      DeletedEntity                          │
├─────────────────────────────────────────────────────────────┤
│  { "typename": String, "id": ID, "deletedAt": DateTime }    │
└─────────────────────────────────────────────────────────────┘
```

**Example:**
```json
{
  "typename": "Comment",
  "id": "456",
  "deletedAt": "2024-01-15T10:30:00Z"
}
```

### QueryInvalidation

Cache invalidation hints for client-side cache management.

```
QueryInvalidation ::= '{'
    '"queryName"' ':' ( String | 'null' ) ','
    '"queryHash"' ':' ( String | 'null' ) ','
    '"arguments"' ':' ( JSON | 'null' ) ','
    '"queryPattern"' ':' ( String | 'null' ) ','
    '"strategy"' ':' InvalidationStrategy ','
    '"scope"' ':' InvalidationScope
'}'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                    QueryInvalidation                        │
├─────────────────────────────────────────────────────────────┤
│  { "queryName": String|null, "queryHash": String|null,     │
│    "arguments": JSON|null, "queryPattern": String|null,    │
│    "strategy": Strategy, "scope": Scope }                  │
└─────────────────────────────────────────────────────────────┘
```

**Examples:**

*Exact invalidation:*
```json
{
  "queryName": "getUser",
  "arguments": {"id": "123"},
  "strategy": "REFETCH",
  "scope": "EXACT"
}
```

*Pattern invalidation:*
```json
{
  "queryPattern": "listUsers*",
  "strategy": "INVALIDATE",
  "scope": "PATTERN"
}
```

### CascadeMetadata

Operation metadata and statistics.

```
CascadeMetadata ::= '{'
    '"timestamp"' ':' DateTime ','
    '"transactionId"' ':' ( ID | 'null' ) ','
    '"depth"' ':' Int ','
    '"affectedCount"' ':' Int ','
    '"truncated"' ':' Boolean
'}'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                     CascadeMetadata                         │
├─────────────────────────────────────────────────────────────┤
│  { "timestamp": DateTime, "transactionId": ID|null,        │
│    "depth": Int, "affectedCount": Int, "truncated": Bool } │
└─────────────────────────────────────────────────────────────┘
```

**Example:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "transactionId": "txn_abc123",
  "depth": 2,
  "affectedCount": 5,
  "truncated": false
}
```

### TypeInvalidation

Marks every cached entity of a type, and every cached query that may contain one, as stale.

```
TypeInvalidation ::= '{'
    '"typename"' ':' String ','
    '"affectedCount"' ':' ( Int | 'null' )
'}'
```

**Example:**
```json
{
  "typename": "Post",
  "affectedCount": 800
}
```

## Enumeration Types

### CascadeOperation

Defines the type of operation performed on an entity.

```
CascadeOperation ::= '"CREATED"' | '"UPDATED"' | '"DELETED"'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                   CascadeOperation                          │
├─────────────────────────────────────────────────────────────┤
│           ┌─────────────┐                                   │
│           │  "CREATED"  │                                   │
│           └─────────────┘                                   │
│                │                                            │
│           ┌─────────────┐                                   │
│           │  "UPDATED"  │                                   │
│           └─────────────┘                                   │
│                │                                            │
│           ┌─────────────┐                                   │
│           │  "DELETED"  │                                   │
│           └─────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### InvalidationStrategy

Defines how cached queries should be handled.

```
InvalidationStrategy ::= '"INVALIDATE"' | '"REFETCH"' | '"REMOVE"'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                 InvalidationStrategy                        │
├─────────────────────────────────────────────────────────────┤
│           ┌───────────────┐                                 │
│           │ "INVALIDATE"  │                                 │
│           └───────────────┘                                 │
│                │                                            │
│           ┌───────────────┐                                 │
│           │  "REFETCH"    │                                 │
│           └───────────────┘                                 │
│                │                                            │
│           ┌───────────────┐                                 │
│           │   "REMOVE"    │                                 │
│           └───────────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

### InvalidationScope

Defines the scope of cache invalidation.

```
InvalidationScope ::= '"EXACT"' | '"PREFIX"' | '"PATTERN"' | '"ALL"'
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                   InvalidationScope                         │
├─────────────────────────────────────────────────────────────┤
│           ┌─────────────┐                                   │
│           │   "EXACT"   │                                   │
│           └─────────────┘                                   │
│                │                                            │
│           ┌─────────────┐                                   │
│           │  "PREFIX"   │                                   │
│           └─────────────┘                                   │
│                │                                            │
│           ┌─────────────┐                                   │
│           │ "PATTERN"   │                                   │
│           └─────────────┘                                   │
│                │                                            │
│           ┌─────────────┐                                   │
│           │    "ALL"    │                                   │
│           └─────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### CascadeErrorCode

Standard error codes for consistent error handling.

```
CascadeErrorCode ::= '"VALIDATION_ERROR"'
                   | '"NOT_FOUND"'
                   | '"UNAUTHORIZED"'
                   | '"FORBIDDEN"'
                   | '"CONFLICT"'
                   | '"INTERNAL_ERROR"'
                   | '"TRANSACTION_FAILED"'
                   | '"TIMEOUT"'
                   | '"RATE_LIMITED"'
                   | '"SERVICE_UNAVAILABLE"'
```

## Error Handling

### CascadeError

Structured error information.

```
CascadeError ::= '{'
    '"message"' ':' String ','
    '"code"' ':' CascadeErrorCode ','
    ( '"domainCode"' ':' ( DomainCode | 'null' ) ',' )?
    '"field"' ':' ( String | 'null' ) ','
    '"path"' ':' StringArray ','
    '"extensions"' ':' ( JSON | 'null' )
'}'

DomainCode ::= '"' DomainCodeSegment ( '.' DomainCodeSegment )* '"'
DomainCodeSegment ::= UpperLetter ( UpperLetter | Digit | '_' )*
```

**Text-based Railroad Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                      CascadeError                           │
├─────────────────────────────────────────────────────────────┤
│  { "message": String, "code": ErrorCode,                   │
│    "domainCode"?: DomainCode|null, "field": String|null,   │
│    "path": [...], "extensions": JSON|null }                 │
└─────────────────────────────────────────────────────────────┘
```

**Example:**
```json
{
  "message": "User not found",
  "code": "NOT_FOUND",
  "field": "userId",
  "path": ["updateUser", "user"],
  "extensions": {
    "userId": "123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Primitive Types

### JSON

Extensible JSON value for arguments and extensions.

```
JSON ::= Object | Array | String | Number | Boolean | 'null'
```

### DateTime

ISO 8601 timestamp string.

```
DateTime ::= String  # ISO 8601 datetime string
```

**Example:** `"2024-01-15T10:30:00Z"`

### ID

Globally unique identifier, serialized as string.

```
ID ::= String  # Globally unique identifier
```

**Example:** `"user_123"` or `"550e8400-e29b-41d4-a716-446655440000"`

## Array Types

All array types follow the pattern:

```
ArrayType ::= '[' ElementList ']'
ElementList ::= | Element ( ',' Element )*
```

Where Element is the appropriate element type (UpdatedEntity, DeletedEntity, etc.).

## Grammar Validation

### Well-formedness Rules

1. **Object Keys**: All object keys must be valid JSON strings
2. **Trailing Commas**: Not allowed in JSON serialization
3. **Unicode**: All strings support full Unicode character set
4. **Number Precision**: Int values limited to 32-bit range
5. **DateTime Format**: Must conform to ISO 8601

### Schema Compliance

The grammar assumes:
- `MutationPayload` is defined by the GraphQL schema
- `Node` is the entity interface defined by the schema
- All `typename` and `__typename` values correspond to schema types
- All field names exist in their respective types

## Implementation Notes

### Parser Implementation

Implementations should:
1. Parse JSON according to RFC 8259
2. Validate against this grammar
3. Coerce values according to GraphQL type system
4. Handle optional fields appropriately

### Serialization

When serializing Cascade responses:
1. Use standard JSON serialization
2. Maintain field order for readability
3. Include all required fields
4. Use null for optional missing fields

### Validation

Validators should check:
1. Required fields are present
2. Enum values are valid
3. Array elements match expected types
4. String formats conform to specifications
5. Numeric values are within valid ranges

## Examples

### Complete Cascade Response

```json
{
  "success": true,
  "errors": [],
  "data": {
    "updateUser": {
      "id": "123",
      "name": "John Doe"
    }
  },
  "cascade": {
    "updated": [
      {
        "typename": "User",
        "id": "123",
        "operation": "UPDATED",
        "entity": {
          "id": "123",
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    ],
    "deleted": [
      {
        "typename": "Comment",
        "id": "456",
        "deletedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "invalidations": [
      {
        "queryName": "getUser",
        "arguments": {"id": "123"},
        "strategy": "REFETCH",
        "scope": "EXACT"
      },
      {
        "queryPattern": "listUsers*",
        "strategy": "INVALIDATE",
        "scope": "PATTERN"
      }
    ],
    "metadata": {
      "timestamp": "2024-01-15T10:30:00Z",
      "transactionId": "txn_abc123",
      "depth": 2,
      "affectedCount": 2
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "errors": [
    {
      "message": "User not found",
      "code": "NOT_FOUND",
      "field": "userId",
      "path": ["updateUser"],
      "extensions": {
        "userId": "999",
        "operation": "UPDATE"
      }
    }
  ],
  "data": null,
  "cascade": {
    "updated": [],
    "deleted": [],
    "invalidations": [],
    "metadata": {
      "timestamp": "2024-01-15T10:30:00Z",
      "transactionId": null,
      "depth": 0,
      "affectedCount": 0
    }
  }
}
```

## Railroad Diagram Legend

The text-based railroad diagrams use the following conventions:

- `┌─┐` : Start/end of diagram
- `├─┤` : Branch point
- `└─┘` : Terminal node
- `│ │` : Path continuation
- `[...]` : Array notation
- `String|null` : Optional field
- `...` : Continuation/truncation

These diagrams provide a visual representation of the grammar productions without requiring image generation.