const config = require('./modules/config');
const logger = require('./modules/logger');
const { manageIncoming } = require('./modules/incoming');
const { manageArchive } = require('./modules/archive');
const { getFreeSpace } = require('./modules/disk');

/**
 * Main function to manage disk space for incoming and archive sections.
 */
async function main() {
    logger.log('Starting fin-space management...', 'info');

    while (true) {
        try {
            logger.log('Starting round-robin space management loop...', 'info');

            let spaceFreed = false;

            // Check and manage Incoming Sections
            for (const incomingSection of config.incomingDisksSections) {
                const actionTaken = await manageIncoming(config, incomingSection);
                if (actionTaken) {
                    spaceFreed = true;
                }
            }

            // Check and manage Archive Sections
            for (const archiveSection of config.archiveDisksSections) {
                if (!archiveSection || !archiveSection.path || !archiveSection.device) {
                    logger.log(
                        `Skipping invalid archive section configuration: ${JSON.stringify(archiveSection)}`,
                        'error'
                    );
                    continue;
                }

                const freeSpace = await getFreeSpace(archiveSection.device);

                logger.log(
                    `Free space on disk (${archiveSection.device}): ${freeSpace} GB (Section: ${archiveSection.section})`,
                    'info'
                );

                if (freeSpace < config.freeSpaceLimitGBArchive) {
                    logger.log(
                        `Archive section (${archiveSection.section}) has insufficient space: ${freeSpace} GB. Initiating cleanup...`,
                        'warn'
                    );

                    const actionTaken = await manageArchive(config, null); // Null release since archive handles cleanup
                    if (actionTaken) {
                        spaceFreed = true;
                    }
                } else {
                    logger.log(
                        `Archive section (${archiveSection.section}) has sufficient space: ${freeSpace} GB. No cleanup required.`,
                        'info'
                    );
                }
            }

            // Delay before restarting the loop
            const waitTime = config.waitTimeMinutes || 5; // Default to 5 minutes if not set in config
            logger.log(`Waiting ${waitTime} minutes before restarting the loop...`, 'info');
            await new Promise((resolve) => setTimeout(resolve, waitTime * 60 * 1000));
        } catch (err) {
            logger.log(`Unexpected error: ${err.message}`, 'error');
            const waitTime = 5; // Default wait time on error
            logger.log(`Restarting loop in ${waitTime} minutes...`, 'error');
            await new Promise((resolve) => setTimeout(resolve, waitTime * 60 * 1000));
        }
    }
}

main().catch((err) => {
    logger.log(`Fatal error: ${err.message}`, 'error');
    process.exit(1);
});
