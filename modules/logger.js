const chalk = require('chalk');
const fs = require('fs');
const config = require('./config'); // Import config to get logFile path

/**
 * Log messages with colors and write them to a log file.
 * @param {String} message - The message to log.
 * @param {String} level - The log level (e.g., 'info', 'debug', 'error').
 */
const log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  const logFile = config.logFile; // Get log file path from config
  let formattedMessage = '';

  switch (level) {
    case 'info':
      formattedMessage = `[${chalk.blue(timestamp)}] ${chalk.magenta(message)}`;
      console.log(formattedMessage);
      break;
    case 'info2':
      formattedMessage = `[${chalk.blue(timestamp)}] ${chalk.green(message)}`;
      console.log(formattedMessage);
      break;
    case 'debug':
      formattedMessage = `[${chalk.blue(timestamp)}] ${chalk.cyan(message)}`;
      console.log(formattedMessage);
      break;
    case 'debug2':
      formattedMessage = `[${chalk.blue(timestamp)}] ${chalk.cyan(message)}`;
      console.log(formattedMessage);
      break;
    case 'error':
      formattedMessage = `[${chalk.red(timestamp)}] ${chalk.red(message)}`;
      console.error(formattedMessage);
      break;
    default:
      formattedMessage = `[${chalk.blue(timestamp)}] ${message}`;
      console.log(formattedMessage);
  }

  // Write to log file
  try {
    fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
  } catch (err) {
    console.error(`[${chalk.red(timestamp)}] ${chalk.red('ERROR:')} Unable to write to log file: ${err.message}`);
  }
};

module.exports = { log };
