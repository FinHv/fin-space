const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Get a list of releases from an incoming section.
 * @param {String} sectionPath - Path to the incoming section.
 * @param {Boolean} dated - Whether to prioritize dated directories.
 * @returns {Array} - List of release directories.
 */
async function getIncomingReleases(sectionPath, dated = false) {
    try {
        const entries = await fs.readdir(sectionPath, { withFileTypes: true });

        // Filter directories only
        let directories = entries
            .filter(entry => entry.isDirectory())
            .map(entry => ({
                path: path.join(sectionPath, entry.name),
                name: entry.name
            }));

        if (dated) {
            // Filter only dated directories
            directories = directories.filter((dir) => /^\d+$/.test(dir.name));
        }

        if (!directories.length) {
            return [];
        }

        // Get modification times for sorting
        const directoriesWithStats = await Promise.all(
            directories.map(async (dir) => {
                const stats = await fs.stat(dir.path);
                return {
                    ...dir,
                    mtime: stats.mtime,
                };
            })
        );

        // Sort by modification time (oldest first)
        directoriesWithStats.sort((a, b) => a.mtime - b.mtime);

        return directoriesWithStats;
    } catch (err) {
        console.error(`Error reading section path: ${sectionPath}`, err);
        return [];
    }
}

/**
 * Check if a release already exists in the archive.
 * @param {String} archivePath - Path to the archive section.
 * @param {String} releaseName - Name of the release to check.
 * @returns {Boolean} - True if the release exists, false otherwise.
 */
async function releaseExistsInArchive(archivePath, releaseName) {
  try {
    const entries = await fs.readdir(archivePath, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory() && entry.name === releaseName);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.log(`Archive path does not exist: ${archivePath}`, 'warn');
      return false;
    }
    logger.log(`Error checking existence in archive: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Delete a directory recursively.
 * @param {String} dirPath - Path to the directory.
 */
async function deleteDirectory(dirPath) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        await Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await deleteDirectory(fullPath);
                } else {
                    await fs.unlink(fullPath);
                }
            })
        );
        await fs.rmdir(dirPath);
        console.log(`Deleted directory: ${dirPath}`);
    } catch (err) {
        console.error(`Error deleting directory ${dirPath}: ${err.message}`);
        throw err;
    }
}

/**
 * Calculate the size of a directory (recursive).
 * @param {String} dirPath - Path to the directory.
 * @param {Boolean} recursive - Whether to include subdirectories.
 * @returns {Number} - Size of the directory in bytes.
 */
async function getDirectorySize(dirPath, recursive = true) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        const sizes = await Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(dirPath, entry.name);
                try {
                    if (entry.isDirectory()) {
                        if (recursive) {
                            return await getDirectorySize(fullPath, true);
                        }
                        return 0;
                    } else {
                        const stat = await fs.stat(fullPath);
                        return stat.size;
                    }
                } catch (err) {
                    logger.log(`Error accessing ${fullPath}: ${err.message}`, 'warn');
                    return 0;
                }
            })
        );

        return sizes.reduce((acc, size) => acc + size, 0);
    } catch (err) {
        logger.log(`Error calculating size for ${dirPath}: ${err.message}`, 'error');
        return 0;
    }
}

/**
 * Get the oldest release in a specified directory and log details.
 * @param {String} sectionPath - Path to the section directory.
 * @param {Boolean} dated - Whether to prioritize dated directories.
 * @returns {Object|null} - Details of the oldest release or null if none found.
 */
const getOldestReleaseBackup = async (sectionPath, dated = false) => {
    try {
        const entries = await fs.readdir(sectionPath, { withFileTypes: true });

        const directories = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({
                path: path.join(sectionPath, entry.name),
                name: entry.name,
            }));

        if (!directories.length) {
            logger.log(`No directories found in section: ${sectionPath}`, 'info');
            return null;
        }

        const directoriesWithStats = await Promise.all(
            directories.map(async (dir) => {
                const stats = await fs.stat(dir.path);
                const size = await getDirectorySize(dir.path);
                return {
                    ...dir,
                    mtime: stats.mtime,
                    size,
                };
            })
        );

        directoriesWithStats.sort((a, b) => a.mtime - b.mtime);
        const oldestRelease = directoriesWithStats[0];
        logger.log(
            `Oldest release: ${oldestRelease.name}, Path: ${oldestRelease.path}, Size: ${(oldestRelease.size / (1024 ** 3)).toFixed(
                2
            )} GB, Modified: ${oldestRelease.mtime}`,
            'info'
        );
        return oldestRelease;
    } catch (err) {
        logger.log(`Error finding oldest release in ${sectionPath}: ${err.message}`, 'error');
        return null;
    }
};

/**
 * Get the oldest release across all specified sections and log details.
 * @param {Array} incomingSections - Array of incoming sections with paths and metadata.
 * @returns {Object|null} - Details of the oldest release or null if none found.
 */
const getOldestReleaseBackup2 = async (incomingSections) => {
    try {
        let globalOldestRelease = null;

        for (const { path: sectionPath, section, dated } of incomingSections) {
            logger.log(`Checking section: ${section}`, 'info');

            let entries;
            try {
                entries = await fs.readdir(sectionPath, { withFileTypes: true });
            } catch (err) {
                logger.log(`Error reading section: ${sectionPath}. Error: ${err.message}`, 'error');
                continue;
            }

            const directories = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => ({
                    path: path.join(sectionPath, entry.name),
                    name: entry.name,
                }));

            if (!directories.length) {
                logger.log(`No releases found in section: ${section}`, 'info');
                continue;
            }

            const directoriesWithStats = await Promise.all(
                directories.map(async (dir) => {
                    try {
                        const stats = await fs.stat(dir.path);
                        const size = await getDirectorySize(dir.path);

                        // Skip if the directory is dated and not at least 1 day old
                        if (dated && !(await isOlderThanOneDay(dir.path))) {
                            logger.log(
                                `Skipping directory: ${dir.name} in section: ${section} because it is less than 1 day old.`,
                                'info'
                            );
                            return null;
                        }

                        return {
                            ...dir,
                            mtime: stats.mtime,
                            size,
                            section, // Include section explicitly for later use
                        };
                    } catch (err) {
                        logger.log(
                            `Error processing directory: ${dir.name} in section: ${section}. Error: ${err.message}`,
                            'warn'
                        );
                        return null;
                    }
                })
            );

            // Filter out skipped or errored directories
            const validDirectories = directoriesWithStats.filter((dir) => dir !== null);

            if (!validDirectories.length) {
                logger.log(`No valid releases found in section: ${section}`, 'info');
                continue;
            }

            validDirectories.sort((a, b) => a.mtime - b.mtime);
            const oldestRelease = validDirectories[0];

            logger.log(
                `Oldest release in section ${section}: ${oldestRelease.name}, Path: ${oldestRelease.path}, Size: ${(oldestRelease.size / (1024 ** 3)).toFixed(
                    2
                )} GB, Modified: ${oldestRelease.mtime}`,
                'info'
            );

            // Compare and update the global oldest release
            if (
                !globalOldestRelease ||
                new Date(oldestRelease.mtime) < new Date(globalOldestRelease.mtime)
            ) {
                globalOldestRelease = {
                    ...oldestRelease,
                    section, // Ensure section is included
                };
            }
        }

        if (globalOldestRelease) {
            logger.log(
                `Global oldest release: ${globalOldestRelease.name}, Path: ${globalOldestRelease.path}, Section: ${globalOldestRelease.section}, Size: ${(globalOldestRelease.size / (1024 ** 3)).toFixed(
                    2
                )} GB, Modified: ${globalOldestRelease.mtime}`,
                'info'
            );
        } else {
            logger.log(`No valid releases found across all sections.`, 'info');
        }

        return globalOldestRelease;
    } catch (err) {
        logger.log(`Error finding oldest release across sections: ${err.message}`, 'error');
        return null;
    }
};


// Specific function for incoming sections
const getOldestIncomingRelease = async (sections) => {
    return await findOldestDirectory(sections);
};

// Specific function for archive sections
const getOldestArchiveRelease = async (sections) => {
    return await findOldestDirectory(sections);
};


/**
 * Find the oldest directory across multiple sections.
 * @param {Array} sections - Array of sections with paths, metadata, and optional "dated" filter.
 * @returns {Object|null} - Details of the oldest directory or null if none found.
 */
const findOldestDirectory = async (sections) => {
    let globalOldestRelease = null;

    for (const { path: sectionPath, section, dated } of sections) {
        logger.log(`Checking section: ${section} at path: ${sectionPath}`, 'info');

        let entries;
        try {
            entries = await fs.readdir(sectionPath, { withFileTypes: true });
        } catch (err) {
            logger.log(
                `Error reading section: ${sectionPath}. Error: ${err.message}`,
                'error'
            );
            continue;
        }

        const directories = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({
                path: path.join(sectionPath, entry.name),
                name: entry.name,
            }));

        if (!directories.length) {
            logger.log(`No releases found in section: ${section}`, 'info');
            continue;
        }

        const directoriesWithStats = await Promise.all(
            directories.map(async (dir) => {
                try {
                    const stats = await fs.stat(dir.path);
                    const size = await getDirectorySize(dir.path);

                    // If the "dated" flag is set, skip directories less than a day old
                    if (dated && !(await isOlderThanOneDay(dir.path))) {
                        logger.log(
                            `Skipping directory: ${dir.name} in section: ${section} because it is less than 1 day old.`,
                            'info'
                        );
                        return null;
                    }

                    return {
                        ...dir,
                        mtime: stats.mtime,
                        size,
                        section, // Include section for reference
                    };
                } catch (err) {
                    logger.log(
                        `Error processing directory: ${dir.name} in section: ${section}. Error: ${err.message}`,
                        'warn'
                    );
                    return null;
                }
            })
        );

        // Filter out invalid or skipped directories
        const validDirectories = directoriesWithStats.filter((dir) => dir !== null);

        if (!validDirectories.length) {
            logger.log(`No valid releases found in section: ${section}`, 'info');
            continue;
        }

        validDirectories.sort((a, b) => a.mtime - b.mtime);
        const oldestRelease = validDirectories[0];

        logger.log(
            `Oldest release in section ${section}: ${oldestRelease.name}, Path: ${oldestRelease.path}, Size: ${(oldestRelease.size / (1024 ** 3)).toFixed(
                2
            )} GB, Modified: ${oldestRelease.mtime}`,
            'info'
        );

        // Update global oldest release if necessary
        if (
            !globalOldestRelease ||
            new Date(oldestRelease.mtime) < new Date(globalOldestRelease.mtime)
        ) {
            globalOldestRelease = oldestRelease;
        }
    }

    if (globalOldestRelease) {
        logger.log(
            `Global oldest release: ${globalOldestRelease.name}, Path: ${globalOldestRelease.path}, Section: ${globalOldestRelease.section}, Size: ${(globalOldestRelease.size / (1024 ** 3)).toFixed(
                2
            )} GB, Modified: ${globalOldestRelease.mtime}`,
            'info'
        );
    } else {
        logger.log(`No valid releases found across all sections.`, 'info');
    }

    return globalOldestRelease;
};


/**
 * Checks if a directory is empty.
 * @param {String} dirPath - Path to the directory.
 * @returns {Boolean} - True if the directory is empty, false otherwise.
 */
const isDirectoryEmpty = async (dirPath) => {
    try {
        const files = await fs.readdir(dirPath);
        return files.length === 0;
    } catch (err) {
        logger.log(`Error checking if directory is empty: ${dirPath}. Error: ${err.message}`, 'error');
        return false;
    }
};


/**
 * Checks if the directory is at least 1 day old.
 * @param {String} dirPath - Path to the directory.
 * @returns {Boolean} - True if the directory is at least 1 day old, false otherwise.
 */
const isOlderThanOneDay = async (dirPath) => {
    try {
        const stats = await fs.stat(dirPath);
        const oneDayInMs = 24 * 60 * 60 * 1000; // 1 day in milliseconds
        const now = Date.now();
        return now - stats.mtimeMs > oneDayInMs;
    } catch (err) {
        logger.log(`Error checking age of directory ${dirPath}: ${err.message}`, 'error');
        return false;
    }
};


module.exports = {
    getDirectorySize,
    getIncomingReleases,
    releaseExistsInArchive,
    deleteDirectory,
    isOlderThanOneDay,
    isDirectoryEmpty,
    getOldestIncomingRelease,
    getOldestArchiveRelease,
};