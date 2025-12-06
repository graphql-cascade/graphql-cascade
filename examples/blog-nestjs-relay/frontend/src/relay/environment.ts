import { Environment, Network, RecordSource, Store } from 'relay-runtime'
import { createCascadeNetwork } from '@graphql-cascade/client-relay'

const network = createCascadeNetwork({
  url: 'http://localhost:3001/graphql',
  headers: {
    'Content-Type': 'application/json',
  },
})

const environment = new Environment({
  network,
  store: new Store(new RecordSource()),
})

export default environment