'use strict';

const pino = require('pino');
const path = require('path');

const logFile = path.join(__dirname, '..', 'server.log');

const logger = pino({
  level: process.env.LOG_LEVEL || 'debug', // Turunkan ke debug agar Baileys log lebih terlihat
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' }
      },
      {
        target: 'pino/file',
        options: { destination: logFile, mkdir: true }
      }
    ]
  }
});

module.exports = logger;
