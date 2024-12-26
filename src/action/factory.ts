import { ActionConfig, ActionShellParams } from './../config';
import { Action } from './action';
import { EventPublishActionFactory } from './event-publish/event-publish';
import { ShellAction } from './shell';

export class ActionFactory<T> {
  public static create(cfg: ActionConfig, vars: any = {}): Action {
    switch (cfg.type) {
      case 'shell':
        return new ShellAction(cfg, vars);
      case 'event_store_publish':
        return EventPublishActionFactory.create(cfg, vars);
      default:
        throw new TypeError(`Unrecognized action type ${cfg.type}`);
    }
  }
}
