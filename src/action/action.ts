export abstract class Action {
  abstract execute(): Promise<any>;
}
