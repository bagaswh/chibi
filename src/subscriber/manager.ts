import { ActionFactory } from './../action/factory';
import { SubscriberConfig } from '../config';
import { ChibiError } from '../error';
import eventStoreManager from '../event-store/manager';
import globalVars from '../vars';
import { compile } from 'expression-eval';
import { createLogger } from '../logger';
import { Logger } from 'winston';
import app from '../app';
import { debounce } from '../utils/debounce';
import ms from 'ms';

/**
 * Subscriber purpose is to listen to events from event stores.
 */

export class SubscriberManagerError extends ChibiError {}

export class SubscriberManager {
  private static instance: SubscriberManager;
  private logger: Logger;

  private constructor(private readonly subscribersConfig: SubscriberConfig[]) {
    this.logger = createLogger('subscriber-manager', app.getLogLevel());
  }

  public static getInstance(subscribersConfig: SubscriberConfig[]) {
    if (!this.instance) {
      this.instance = new this(subscribersConfig);
    }
    return this.instance;
  }

  async init() {
    for (const cfg of this.subscribersConfig) {
      const logger = createLogger(
        `subscriber-${cfg.from}`,
        app.getLogLevel(),
        undefined
      );
      const client = eventStoreManager.getClient(cfg.from);
      if (!client) {
        throw new SubscriberManagerError(
          `Event store client ${cfg.from} not found`
        );
      }
      await client.client.init();
      async function _handler(msg: { payload: any }) {
        const payload = msg.payload.content.toString();
        let json;
        let shouldProceed = false;
        switch (cfg.payload.parse_as) {
          case 'json':
            try {
              json = JSON.parse(payload);
              shouldProceed = true;
            } catch (err: any) {
              logger.error(`Failed parsing payload as JSON: ${err.message}`);
            }
            break;
        }
        const theVars = {
          ...globalVars,
          __CHIBI_PAYLOAD: { json },
        };
        for (const actionCfg of cfg.actions) {
          const action = ActionFactory.create(actionCfg, theVars);
          let shouldExecute = true;
          if (actionCfg.condition) {
            try {
              const result = compile(actionCfg.condition)(theVars);
              if (result === false) {
                shouldExecute = false;
              }
            } catch (err: any) {
              logger.error(`Failed evaluating condition: ${err.message}`);
              shouldExecute = false;
            }
          }

          if (shouldExecute) {
            const result = await action.execute();
            logger.debug(`Result from action: ${result}`);
          }
        }
      }
      let debouncedHandler;
      if (cfg.debounce) {
        const debounceMs = ms(cfg.debounce);
        if (!debounceMs) {
          throw new SubscriberManagerError(
            `Invalid debounce value '${cfg.debounce}' of subscriber ${cfg.from}`
          );
        }
        debouncedHandler = debounce(_handler, debounceMs);
      }
      const handler = debouncedHandler || _handler;
      client.client.subscribe(cfg.params, handler);
    }
  }
}
