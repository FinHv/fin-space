const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Error reading configuration file:', err);
  process.exit(1);
}

module.exports = config;
