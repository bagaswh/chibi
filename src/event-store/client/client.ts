export type QueryResult = {
  key: string;
  value: string | number;
};

export type EventStoreClientSubscribeCallback = (msg: { payload: any }) => void;

export abstract class EventStoreClient<T = any, U = any> {
  abstract publish(opts: T): Promise<any>;
  abstract subscribe(
    opts: U,
    callback: EventStoreClientSubscribeCallback
  ): Promise<any>;
  abstract init(): Promise<void>;
  abstract destroy(): Promise<any>;
}

export class NoopEventStoreClient implements EventStoreClient {
  publish(): Promise<any> {
    return Promise.resolve({ key: 'none', value: -1 });
  }

  subscribe() {
    return Promise.resolve();
  }

  init() {
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    return Promise.resolve();
  }
}
