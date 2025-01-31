const logger = require('./logger');
const { getFreeSpace } = require('./disk');
const { rcloneSync, setTimestamp, wipeDestination, verifyFileCount } = require('./rclone');
const { stat } = require('fs/promises');
const { getOldestIncomingRelease, isDirectoryEmpty, deleteDirectory, getOldestArchiveRelease } = require('./utils');
const fs = require('fs').promises;
const path = require('path');
const { proc_announce } = require('./announce');

/**
 * Archive management function to move releases from incoming to archive sections.
 * Handles both archiving incoming releases and cleaning up archive space.
 * @param {Object} config - Configuration object.
 * @param {Object|null} incomingRelease - Incoming release details.
 * @returns {Boolean} - Returns true if the operation was successful.
 */
const manageArchive = async (config, incomingRelease = null) => {
    if (!incomingRelease) {
        await manageArchiveSpace(config);
        return false;
    }

    const incomingSection = config.incomingDisksSections.find(
        (section) => incomingRelease.path === `${section.path}/${incomingRelease.name}`
    );

    if (!incomingSection) {
        logger.log(
            `No matching incoming section found for release path: ${incomingRelease.path}`,
            'error'
        );
        return false;
    }

    const releaseSection = incomingSection.section;
    logger.log(`DEBUG: Strictly determined category for release: ${releaseSection}`, 'debug');

    const matchingArchiveSections = config.archiveDisksSections.filter(
        (section) => section.section === releaseSection
    );

    if (matchingArchiveSections.length === 0) {
        logger.log(
            `No matching archive section found for release category: ${releaseSection}`,
            'error'
        );
        return false;
    }

    // Find the archive section with the most free space globally
    let bestSection = null;
    let mostFreeSpace = 0;

    for (const archiveSection of config.archiveDisksSections) {
        try {
            const freeSpace = await getFreeSpace(archiveSection.device);

            if (freeSpace > mostFreeSpace) {
                mostFreeSpace = freeSpace;
                bestSection = archiveSection;
            }
        } catch (err) {
            logger.log(
                `Error checking archive section ${archiveSection.path}: ${err.message}`,
                'error'
            );
        }
    }

    if (!bestSection) {
        logger.log(
            `No archive section with sufficient free space found.`,
            'warn'
        );
        return false;
    }

    const releaseSizeInGB = incomingRelease.size / 1024;
    if (mostFreeSpace < releaseSizeInGB + config.archiveBufferGB) {
        logger.log(
            `Even the disk with the most free space (${bestSection.path}) does not have enough room. Required: ${Math.ceil(
                releaseSizeInGB + config.archiveBufferGB
            )} GB, Available: ${mostFreeSpace} GB.`,
            'warn'
        );
        return false;
    }

    try {
        const sourcePath = incomingSection.path;
        const sourceName = incomingRelease.name;
        const destinationPath = bestSection.path;

        logger.log(
            `[ARCHiViNG]: [MOViNG] :: ${sourceName} from [${incomingSection.section}] to [${bestSection.section}]`,
            'info'
        );

        if (!config.debug) {
            await wipeDestination(destinationPath, sourceName);
            rcloneSync(sourcePath, sourceName, destinationPath);

            const sourceFullPath = `${sourcePath}/${sourceName}`;
            const destFullPath = `${destinationPath}/${sourceName}`;
            const isVerified = await verifyFileCount(sourceFullPath, destFullPath);

            if (!isVerified) {
                logger.log(`File count mismatch after sync for: ${sourceName}`, 'error');
                return false;
            }

            const sourceStats = await stat(sourceFullPath);
            setTimestamp(destFullPath, Math.floor(sourceStats.mtimeMs / 1000));

            await wipeDestination(sourcePath, sourceName);
            logger.log(`Source directory deleted: ${sourcePath}/${sourceName}`, 'info');

            logger.log(
                `Successfully archived ${sourceName} to ${destinationPath}/${sourceName}`,
                'info'
            );
        } else {
            logger.log(
                `DEBUG: Would archive ${sourcePath}/${sourceName} to ${destinationPath}/${sourceName}`,
                'debug'
            );
        }

        return true;
    } catch (err) {
        logger.log(
            `Error archiving release: ${incomingRelease.name} to ${bestSection.path}: ${err.message}`,
            'error'
        );
        return false;
    }
};

/**
 * Cleans up space on archive disks by deleting the oldest releases until space requirements are met.
 * @param {Object} config - Configuration object.
 * @returns {Boolean} - True if cleanup was performed, otherwise false.
 */
const manageArchiveDiskSpace = async (config) => {
    let cleanupPerformed = false;

    logger.log(`Checking all archive disks for space cleanup...`, 'info');

    // Group sections by device
    const disks = config.archiveDisksSections.reduce((acc, section) => {
        acc[section.device] = acc[section.device] || [];
        acc[section.device].push(section);
        return acc;
    }, {});

    // Iterate over each disk
    for (const [device, sections] of Object.entries(disks)) {
        let freeSpace = await getFreeSpace(device);

        logger.log(
            `Free space on device (${device}): ${freeSpace} GB`,
            'info'
        );

        if (freeSpace >= config.freeSpaceLimitGBArchive) {
            logger.log(
                `Device (${device}) has sufficient free space (${freeSpace} GB). Skipping cleanup.`,
                'info'
            );
            continue;
        }

        // Clean up oldest releases until the space threshold is met
        while (freeSpace < config.freeSpaceLimitGBArchive) {
            const oldestRelease = await getOldestArchiveRelease(sections);
            if (!oldestRelease) {
                logger.log(
                    `No valid releases found for cleanup on device (${device}).`,
                    'info'
                );
                break;
            }

            const { path: releasePath, name, section, size, mtime } = oldestRelease;
            const sizeMB = Math.round(size / (1024 ** 2));

            logger.log(
                `Deleting oldest release: ${name} (Section: ${section}, Path: ${releasePath}, Size: ${sizeMB} MB, Date: ${mtime}).`,
                'info'
            );

            proc_announce(
                config,
                `TDELA: "${name}" "${sizeMB}" "${section}"`
            );

            try {
                if (!config.debug) {
                    await deleteDirectory(releasePath);
                    freeSpace = await getFreeSpace(device); // Update free space
                    logger.log(
                        `Successfully deleted ${name}. Updated free space on device (${device}): ${freeSpace} GB.`,
                        'info'
                    );
                    cleanupPerformed = true;
                } else {
                    logger.log(
                        `DEBUG: Would delete ${name} from ${releasePath}`,
                        'debug'
                    );
                }
            } catch (err) {
                logger.log(
                    `Error deleting release ${name} on device (${device}): ${err.message}`,
                    'error'
                );
                break;
            }
        }
    }

    return cleanupPerformed;
};

/**
 * Manages archive space by delegating to disk-specific cleanup logic.
 * @param {Object} config - Configuration object.
 * @returns {Boolean} - True if cleanup was performed, otherwise false.
 */
const manageArchiveSpace = async (config) => {
    return await manageArchiveDiskSpace(config);
};

module.exports = { manageArchive, manageArchiveSpace };
