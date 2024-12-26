import { EventStoreClientFactory } from './client/factory';
import { ChibiError } from '../error';
import { createLogger } from '../logger';
import { EventStoreConfig } from '../config';
import { Logger } from 'winston';
import { EventStoreClient } from './client/client';
import app from '../app';

export class EventStoreError extends ChibiError {}

export class EventStoreManager {
  private readonly logger: Logger;
  private readonly clients: Map<
    string,
    { cfg: EventStoreConfig; client: EventStoreClient }
  > = new Map();

  constructor(private readonly config: EventStoreConfig[]) {
    this.logger = createLogger('EventStoreManager', app.getLogLevel());

    this.init();
  }

  private createClient(cfg: EventStoreConfig) {
    return EventStoreClientFactory.create(cfg);
  }

  private init() {
    for (const cfg of this.config || []) {
      this.clients.set(cfg.name, { cfg, client: this.createClient(cfg) });
    }
  }

  getClient(name: string) {
    return this.clients.get(name);
  }
}

const eventStoreManager = new EventStoreManager(app.config().event_stores);
export default eventStoreManager;
