/**
  PM2 Process Configuration File (echoconfig.cjs)
  Usage:
    pm2 start echoconfig.cjs
    pm2 start echoconfig.cjs --env production
*/

module.exports = require("./ecosystem.config.cjs");
