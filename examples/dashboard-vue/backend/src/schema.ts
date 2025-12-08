export const typeDefs = `
  type Metric {
    id: ID!
    name: String!
    value: Float!
    trend: TrendDirection!
    updatedAt: DateTime!
  }

  type DataRow {
    id: ID!
    category: String!
    values: [Float!]!
  }

  type Query {
    metrics: [Metric!]!
    dataRows(filter: FilterInput): [DataRow!]!
  }

  type Mutation {
    updateMetric(id: ID!, value: Float!): UpdateMetricCascade!
    refreshData: RefreshDataCascade!
  }

  input FilterInput {
    category: String
    minValue: Float
    maxValue: Float
  }

  enum TrendDirection {
    UP
    DOWN
    STABLE
  }

  scalar DateTime

  type CascadeData {
    updated: [CascadeEntity!]!
    deleted: [CascadeEntity!]!
    invalidations: [String!]!
  }

  type CascadeEntity {
    __typename: String!
    id: ID!
  }

  type UpdateMetricCascade {
    success: Boolean!
    data: Metric
    cascade: CascadeData
  }

  type RefreshDataCascade {
    success: Boolean!
    cascade: CascadeData
  }
`;
