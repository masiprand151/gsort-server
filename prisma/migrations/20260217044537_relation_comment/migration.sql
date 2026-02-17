-- DropForeignKey
ALTER TABLE `watchhistory` DROP FOREIGN KEY `WatchHistory_videoId_fkey`;

-- DropIndex
DROP INDEX `WatchHistory_videoId_fkey` ON `watchhistory`;

-- AlterTable
ALTER TABLE `watchhistory` MODIFY `videoId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `WatchHistory` ADD CONSTRAINT `WatchHistory_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`videoId`) ON DELETE RESTRICT ON UPDATE CASCADE;
