const { execSync } = require('child_process');
const { readdir } = require('fs/promises');
const logger = require('./logger');
const config = require('./config');

/**
 * Sync a source directory into the destination, including the folder itself.
 * @param {String} sourcePath - Base path of the source (e.g., /glftpd/site/BLURAY).
 * @param {String} sourceName - Name of the release folder (e.g., Evil.Does.Not.Exist.2023.COMPLETE.BLURAY-BDA).
 * @param {String} destinationPath - Base path of the destination (e.g., /glftpd/DISK1/BLURAY).
 */
const rcloneSync = (sourcePath, sourceName, destinationPath) => {
    // Construct the rclone copy command
    const command = `rclone copy "${sourcePath}/${sourceName}/" "${destinationPath}/${sourceName}" ${config.copyOptions}`;
    if (config.debug) {
        logger.log(`DEBUG: Would execute: ${command}`, 'debug');
    } else {
        try {
            execSync(command, { stdio: 'inherit' });
        } catch (err) {
            logger.log(`Rclone copy failed: ${err.message}`, 'error');
            throw err;
        }
    }
};

/**
 * Restore the folder's timestamp after syncing.
 * @param {String} destination - Path to the destination folder.
 * @param {Number} timestamp - Unix timestamp to restore.
 */
const setTimestamp = (destination, timestamp) => {
    const command = `touch -d "@${timestamp}" "${destination}"`;
    if (config.debug) {
        logger.log(`DEBUG: Would execute: ${command}`, 'debug');
    } else {
        try {
            execSync(command, { stdio: 'inherit' });
        } catch (err) {
            logger.log(`Failed to set timestamp: ${err.message}`, 'error');
            throw new Error(`Failed to set timestamp: ${err.message}`);
        }
    }
};

/**
 * Ensure a clean destination by removing any existing folder.
 * @param {String} destinationPath - Destination path.
 * @param {String} releaseName - Release folder name.
 */
const wipeDestination = async (destinationPath, releaseName) => {
    const fullPath = `${destinationPath}/${releaseName}`;
    try {
        logger.log(`Ensuring clean destination: ${fullPath}`, 'info');
        execSync(`rm -rf "${fullPath}"`);
    } catch (err) {
        logger.log(`Failed to wipe destination: ${err.message}`, 'error');
        throw err;
    }
};

/**
 * Check if the number of files matches between source and destination.
 * @param {String} source - Source directory path.
 * @param {String} destination - Destination directory path.
 * @returns {Boolean} - True if the number of files matches.
 */
const verifyFileCount = async (source, destination) => {
    try {
        const [sourceFiles, destFiles] = await Promise.all([
            readdir(source),
            readdir(destination),
        ]);
        return sourceFiles.length === destFiles.length;
    } catch (err) {
        logger.log(`Failed to verify file counts: ${err.message}`, 'error');
        return false;
    }
};

module.exports = { rcloneSync, setTimestamp, wipeDestination, verifyFileCount };
