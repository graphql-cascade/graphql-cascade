// Type declarations for relay-runtime
declare module 'relay-runtime' {
  export interface RecordSourceSelectorProxy {
    get(dataID: string): any;
    getRoot(): any;
    create(dataID: string, typeName: string): any;
    delete(dataID: string): void;
  }

  export interface MutationConfig {
    mutation: any;
    variables?: any;
    uploadables?: any;
    updater?: (store: RecordSourceSelectorProxy) => void;
    optimisticUpdater?: (store: RecordSourceSelectorProxy) => void;
    optimisticResponse?: any;
    onCompleted?: (response: any) => void;
    onError?: (error: any) => void;
  }

  export interface SelectorStoreUpdater {
    (store: RecordSourceSelectorProxy): void;
  }

  export class Environment {
    constructor(config: {
      network: Network;
      store: Store;
    });
    execute(config: { operation: any }): Observable<any>;
  }

  export class Store {
    constructor(source: RecordSource);
    commitUpdates(updater: (store: RecordSourceSelectorProxy) => void): void;
  }

  export class RecordSource {
    get(dataID: string): any;
  }

  export class Network {
    static create(fetchFn: (operation: any, variables: any) => Observable<any> | Promise<any>): Network;
    execute(operation: any, variables: any): Observable<any>;
  }

  export class Observable<T> {
    static create(observer: (sink: any) => void): Observable<T>;
    map<U>(mapper: (value: T) => U): Observable<U>;
    subscribe(config: {
      next?: (value: T) => void;
      error?: (error: any) => void;
      complete?: () => void;
    }): any;
    toPromise(): Promise<T>;
  }
}