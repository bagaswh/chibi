import { ChibiError } from '../../error';

export class ClientError extends ChibiError {}
export class ClientInitError extends ClientError {}
export class ClientQueryError extends ClientError {}
