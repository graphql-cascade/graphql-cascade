export const typeDefs = `
  type Query {
    metrics(filter: MetricsFilter): [Metric!]!
    aggregations(type: AggregationType!): Aggregation!
    dashboards: [Dashboard!]!
    dashboard(id: ID!): Dashboard
  }

  type Mutation {
    createMetric(input: CreateMetricInput!): CreateMetricCascade!
    updateDashboard(id: ID!, input: UpdateDashboardInput!): UpdateDashboardCascade!
    refreshData: RefreshDataCascade!
  }

  input MetricsFilter {
    startDate: String
    endDate: String
    category: String
  }

  input CreateMetricInput {
    name: String!
    value: Float!
    category: String!
  }

  input UpdateDashboardInput {
    name: String
    widgets: [String!]
  }

  enum AggregationType {
    DAILY
    WEEKLY
    MONTHLY
  }

  type Metric {
    id: ID!
    name: String!
    value: Float!
    category: String!
    timestamp: String!
  }

  type Aggregation {
    type: AggregationType!
    total: Float!
    average: Float!
    count: Int!
    breakdown: [CategoryBreakdown!]!
  }

  type CategoryBreakdown {
    category: String!
    total: Float!
    count: Int!
  }

  type Dashboard {
    id: ID!
    name: String!
    widgets: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  type CascadeData {
    updated: [CascadeEntity!]!
    deleted: [CascadeEntity!]!
    invalidations: [String!]!
  }

  type CascadeEntity {
    __typename: String!
    id: ID!
  }

  type CreateMetricCascade {
    success: Boolean!
    data: Metric
    cascade: CascadeData
  }

  type UpdateDashboardCascade {
    success: Boolean!
    data: Dashboard
    cascade: CascadeData
  }

  type RefreshDataCascade {
    success: Boolean!
    cascade: CascadeData
  }
`;
