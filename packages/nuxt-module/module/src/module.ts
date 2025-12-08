import { defineNuxtModule, addPlugin, createResolver, addImports } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Enable GraphQL Cascade integration
   * @default true
   */
  enabled?: boolean

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Auto-import cascade composables
   * @default true
   */
  autoImports?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@graphql-cascade/nuxt',
    configKey: 'graphqlCascade',
    compatibility: {
      nuxt: '^3.0.0 || ^4.0.0'
    }
  },
  defaults: {
    enabled: true,
    debug: false,
    autoImports: true
  },
  setup(options, nuxt) {
    if (!options.enabled) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // Add runtime plugin
    addPlugin(resolver.resolve('./runtime/plugin'))

    // Add auto-imports for composables
    if (options.autoImports) {
      addImports([
        {
          name: 'useCascadeMutation',
          as: 'useCascadeMutation',
          from: resolver.resolve('./runtime/composables')
        },
        {
          name: 'useCascadeClient',
          as: 'useCascadeClient',
          from: resolver.resolve('./runtime/composables')
        }
      ])
    }

    // Add type declarations
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: '@graphql-cascade/nuxt' })
    })

    if (options.debug) {
      console.log('[GraphQL Cascade] Module initialized with options:', options)
    }
  }
})
