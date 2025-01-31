const logger = require('./logger');
const { getFreeSpace } = require('./disk');
const { getOldestIncomingRelease, isDirectoryEmpty, deleteDirectory, getOldestArchiveRelease } = require('./utils');
const { proc_announce } = require('./announce');
const archive = require('./archive');
const fs = require('fs').promises;


/**
 * Manages incoming directories by checking free space and moving or deleting releases.
 * @param {Object} config - Configuration object.
 * @param {Object} incomingSection - Specific incoming section to manage.
 * @returns {Boolean} - Whether any actions were taken.
 */
const manageIncoming = async (config, incomingSection) => {
    const { path: incomingPath, device, section } = incomingSection;

    logger.log(`Checking incoming section: ${section}`, 'info');

    let freeSpace = await getFreeSpace(device);
    logger.log(
        `Current free space on device (${device}): ${freeSpace} GB`,
        'info2'
    );

    if (freeSpace >= config.freeSpaceLimitGBRace) {
        logger.log(
            `Free space (${freeSpace} GB) is above the limit (${config.freeSpaceLimitGBRace} GB). No action required.`,
            'info2'
        );
        return false;
    }

    const oldestRelease = await getOldestIncomingRelease(config.incomingDisksSections);

    if (!oldestRelease) {
        logger.log(`No valid releases found to manage in section: ${section}.`, 'info');
        return false;
    }

    const { path: releasePath, size, name, section: releaseSection } = oldestRelease; // Use the correct section
    const sizeMB = Math.round(size / (1024 ** 2)); // Convert size to MB and round to nearest integer

    if (await isDirectoryEmpty(releasePath)) {
        logger.log(
            `Release directory is empty: ${releasePath}. Deleting...`,
            'debug2'
        );

        try {
            if (!config.debug) {
                await deleteDirectory(releasePath);
                freeSpace = await getFreeSpace(device); // Update free space
                logger.log(
                    `Deleted empty release directory: ${releasePath}. Updated free space on device (${device}): ${freeSpace} GB`,
                    'info'
                );
                if (freeSpace >= config.freeSpaceLimitGBRace) {
                    logger.log(
                        `Free space (${freeSpace} GB) has reached or exceeded the limit (${config.freeSpaceLimitGBRace} GB).`,
                        'info'
                    );
                    return true;
                }
            } else {
                logger.log(
                    `DEBUG: Would delete empty directory: ${releasePath}`,
                    'debug'
                );
            }
        } catch (err) {
            logger.log(
                `Error deleting empty directory: ${releasePath}. Error: ${err.message}`,
                'error'
            );
            return false;
        }
    }

    logger.log(
        `Oldest release to manage: ${releasePath} (Section: ${releaseSection}, Size: ${sizeMB} MB)`,
        'debug2'
    );

    const archiveSection = config.archiveDisksSections.find(
        (archive) => archive.section === releaseSection // Match by the correct section
    );

    if (archiveSection) {
        const archiveFreeSpace = await getFreeSpace(archiveSection.device);

        if (archiveFreeSpace < (size / 1024 / 1024 + config.archiveBufferGB)) {
            logger.log(
                `Insufficient space on archive path: ${archiveSection.path}. ` +
                `Required: ${Math.round(size / 1024 / 1024 + config.archiveBufferGB)} GB, ` +
                `Available: ${archiveFreeSpace} GB.`,
                'warn'
            );
            return false;
        }

        proc_announce(
            config,
            `TSM: "${name}" "${sizeMB}" "${freeSpace}" "${archiveSection.path}" "${archiveFreeSpace}" "${releaseSection}"`
        );

        logger.log(
            `[ARCHiViNG] :: ${name} to ${archiveSection.path}...`,
            'debug2'
        );

        try {
            if (!config.debug) {
                await archive.manageArchive(config, {
                    ...oldestRelease,
                    section: releaseSection, // Ensure the correct section is passed
                });
                freeSpace = await getFreeSpace(device); // Update free space
                logger.log(
                    `Updated free space on device (${device}): ${freeSpace} GB`,
                    'info'
                );
                if (freeSpace >= config.freeSpaceLimitGBRace) {
                    logger.log(
                        `Free space (${freeSpace} GB) has reached or exceeded the limit (${config.freeSpaceLimitGBRace} GB).`,
                        'info'
                    );
                    return true;
                }
            } else {
                logger.log(
                    `DEBUG: Would archive ${releasePath} to ${archiveSection.path}`,
                    'debug'
                );
            }
        } catch (err) {
            logger.log(
                `Error moving release: ${releasePath} to ${archiveSection.path}. Error: ${err.message}`,
                'error'
            );
            return false;
        }
    } else {
        proc_announce(
            config,
            `TSD: "${name}" "${sizeMB}" "${freeSpace}" "${releaseSection}" "${freeSpace}" "${releaseSection}"`
        );

        logger.log(
            `[DELETE] :: ${name} :: [${sizeMB} MB] from [${releaseSection}]`,
            'debug2'
        );

        try {
            if (!config.debug) {
                await deleteDirectory(releasePath);
                freeSpace = await getFreeSpace(device); // Update free space
                logger.log(
                    `Updated free space on device (${device}): ${freeSpace} GB`,
                    'info'
                );
                if (freeSpace >= config.freeSpaceLimitGBRace) {
                    logger.log(
                        `Free space (${freeSpace} GB) has reached or exceeded the limit (${config.freeSpaceLimitGBRace} GB).`,
                        'info'
                    );
                    return true;
                }
            } else {
                logger.log(
                    `DEBUG: Would delete release: ${name} from section: ${releaseSection}`,
                    'debug'
                );
            }
        } catch (err) {
            logger.log(
                `Error deleting release: ${releasePath}. Error: ${err.message}`,
                'error'
            );
            return false;
        }
    }

    return true;
};

module.exports = {
    manageIncoming,
};
