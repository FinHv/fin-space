const { exec } = require('child_process');

/**
 * Get free space for a specified device.
 * @param {String} device - The device path to check free space for.
 * @returns {Promise<Number>} - Free space in GB.
 */
function getFreeSpace(device) {
    return new Promise((resolve, reject) => {
        exec(`df -BG ${device}`, (err, stdout, stderr) => {
            if (err || stderr) {
                return reject(`Error getting free space for ${device}: ${err || stderr}`);
            }

            try {
                const output = stdout.toString().trim(); // Ensure stdout is a string
                const lines = output.split('\n');
                if (lines.length < 2) {
                    return reject(`Unexpected output from df command for device ${device}`);
                }

                const fields = lines[1].split(/\s+/); // Split second line by whitespace
                const freeSpaceGB = parseInt(fields[3].replace('G', ''), 10);
                resolve(freeSpaceGB);
            } catch (error) {
                reject(`Error parsing free space data for ${device}: ${error.message}`);
            }
        });
    });
}


module.exports = {
    getFreeSpace,
};
