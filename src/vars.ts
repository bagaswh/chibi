import app from './app';
import { hostname } from 'os';

const globalVars = {
  __CHIBI_HOSTNAME: hostname(),
  ...app.config().vars,
};
export default globalVars;
