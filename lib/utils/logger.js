// utils/logger.js
import { logger, consoleTransport } from 'react-native-logs';

const config = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  severity: 'debug',
  transport: consoleTransport, // Use consoleTransport instead
  transportOptions: {
    colors: {
      info: 'yellow',
      warn: 'red',
      error: 'redBright',
      debug: 'green',
    },
  },
  async: true,
  dateFormat: 'time',
  printLevel: true,
  printDate: true,
  enabled: true,
};

const log = logger.createLogger(config);

export default log;
