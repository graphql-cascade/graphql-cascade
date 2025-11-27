import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'GraphQL Cascade',
  description: 'Automatic cache updates for GraphQL',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Clients', link: '/clients/' },
      { text: 'Server', link: '/server/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Specification', link: '/specification/' },
      { text: 'API Reference', link: '/api/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'What is Cascade?', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Core Concepts', link: '/guide/concepts' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Optimistic Updates', link: '/guide/optimistic-updates' },
            { text: 'Conflict Resolution', link: '/guide/conflict-resolution' },
            { text: 'Performance', link: '/guide/performance' }
          ]
        }
      ],

      '/clients/': [
        {
          text: 'Client Libraries',
          items: [
            { text: 'Overview', link: '/clients/' },
            { text: 'Apollo Client', link: '/clients/apollo' },
            { text: 'React Query', link: '/clients/react-query' },
            { text: 'Relay', link: '/clients/relay' },
            { text: 'URQL', link: '/clients/urql' }
          ]
        }
      ],

      '/server/': [
        {
          text: 'Server Implementation',
          items: [
            { text: 'Overview', link: '/server/' },
            { text: 'Node.js/TypeScript', link: '/server/node' },
            { text: 'NestJS', link: '/server/nestjs' },
            { text: 'Apollo Server', link: '/server/apollo-server' }
          ]
        },
        {
          text: 'Schema Design',
          items: [
            { text: 'Schema Conventions', link: '/server/schema-conventions' },
            { text: 'Directives', link: '/server/directives' },
            { text: 'Entity Identification', link: '/server/entity-identification' }
          ]
        }
      ],

      '/cli/': [
        {
          text: 'CLI Tools',
          items: [
            { text: 'Overview', link: '/cli/' },
            { text: 'cascade init', link: '/cli/init' },
            { text: 'cascade validate', link: '/cli/validate' },
            { text: 'cascade doctor', link: '/cli/doctor' }
          ]
        }
      ],

      '/specification/': [
        {
          text: 'Specification',
          items: [
            { text: 'Overview', link: '/specification/' },
            { text: 'Conformance', link: '/specification/conformance' },
            { text: 'Cascade Model', link: '/specification/cascade-model' },
            { text: 'Full Specification', link: '/specification/full' }
          ]
        }
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Client Core', link: '/api/client-core' },
            { text: 'Server Node', link: '/api/server-node' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/graphql-cascade/graphql-cascade' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-2025 GraphQL Cascade Contributors'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/graphql-cascade/graphql-cascade/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
});
