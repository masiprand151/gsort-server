-- DropForeignKey
ALTER TABLE `comment` DROP FOREIGN KEY `Comment_videoId_fkey`;

-- DropIndex
DROP INDEX `Comment_videoId_fkey` ON `comment`;

-- AlterTable
ALTER TABLE `comment` MODIFY `videoId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`videoId`) ON DELETE RESTRICT ON UPDATE CASCADE;
