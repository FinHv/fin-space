const fs = require('fs');
const path = require('path');
const logger = require('./logger');


function formatDate(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const day = days[date.getUTCDay()];
    const month = months[date.getUTCMonth()];
    const dayOfMonth = date.getUTCDate().toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    const time = date.toTimeString().split(' ')[0]; // HH:MM:SS format
    return `${day} ${month} ${dayOfMonth} ${time} ${year}`;
}

function proc_announce(config, announceText) {
    const dateLine = formatDate(new Date());
    const logLine = `${dateLine} ${announceText}`;

    const glLogPath = config.GLLogFile;

    if (!glLogPath || config.debug) {
        logger.log(
            `Would Log to GL log: ${logLine}.`,
            'debug2'
        );

        return;
    }

    try {
        fs.appendFileSync(glLogPath, logLine + '\n');

        logger.log(
            `Logged to GL log: ${logLine}.`,
            'debug2'
        );
    } catch (error) {
        console.error(`Failed to write to GL log: ${error.message}`);
    }
}

module.exports = {
    proc_announce,
};
