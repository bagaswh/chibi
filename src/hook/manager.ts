import { ActionFactory } from '../action/factory';
import { HookListConfig } from '../config';
import { compile } from 'expression-eval';
import globalVars from '../vars';

export class HookManager {
  private static instance: HookManager;

  private constructor(private readonly config: HookListConfig) {}

  public static getInstance(config: HookListConfig) {
    if (!this.instance) {
      this.instance = new this(config);
    }
    return this.instance;
  }

  async startup() {
    const actions = this.config.startup?.actions;
    if (actions) {
      for (const cfg of actions) {
        const action = ActionFactory.create(cfg);
        let shouldExecute = true;
        if (cfg.condition) {
          const result = compile(cfg.condition)(globalVars);
          if (result === false) {
            shouldExecute = false;
          }
        }

        if (shouldExecute) {
          await action.execute();
        }
      }
    }
  }

  shutdown() {}
}
