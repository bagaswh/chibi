import { ActionConfig } from './../config';
import { exec } from 'child_process';
import { ActionShellParams } from '../config';
import { Action } from './action';

export class ShellAction implements Action {
  constructor(
    private readonly cfg: ActionConfig<ActionShellParams>,
    private readonly vars: any = {}
  ) {}

  execute() {
    const script = this.cfg.params.script;
    return new Promise((resolve, reject) => {
      let serializedEnv: Record<any, any> = {};
      for (const key in this.vars) {
        const val = this.vars[key];
        let serializedVal = val;
        if (typeof val === 'object') {
          serializedVal = JSON.stringify(val);
        }
        serializedEnv[key] = serializedVal;
      }
      exec(script, { env: serializedEnv }, (err, stdout, stderr) => {
        if (err) {
          reject(err);
        }
        resolve(stdout);
      });
    });
  }
}
