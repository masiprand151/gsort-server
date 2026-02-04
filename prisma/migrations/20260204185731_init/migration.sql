-- CreateTable
CREATE TABLE `Book` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookId` VARCHAR(191) NOT NULL,
    `bookName` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `subDescription` TEXT NULL,
    `isHot` BOOLEAN NOT NULL DEFAULT false,
    `language` VARCHAR(191) NULL,
    `totalChapter` INTEGER NULL,
    `thumbUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Book_bookId_key`(`bookId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookTag` (
    `bookId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    PRIMARY KEY (`bookId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `seriesId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `intro` TEXT NULL,
    `cover` VARCHAR(191) NULL,
    `episodeCount` INTEGER NULL,
    `followed` BOOLEAN NOT NULL DEFAULT false,
    `followedCount` INTEGER NULL,
    `bookRef` INTEGER NOT NULL,

    UNIQUE INDEX `Series_seriesId_key`(`seriesId`),
    UNIQUE INDEX `Series_bookRef_key`(`bookRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Video` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `videoId` VARCHAR(191) NOT NULL,
    `index` INTEGER NULL,
    `title` TEXT NULL,
    `duration` INTEGER NULL,
    `mainUrl` VARCHAR(191) NOT NULL,
    `backupUrl` VARCHAR(191) NULL,
    `cover` VARCHAR(191) NULL,
    `episodeCover` VARCHAR(191) NULL,
    `videoWidth` INTEGER NULL,
    `videoHeight` INTEGER NULL,
    `expireTime` BIGINT NULL,
    `seriesRef` INTEGER NOT NULL,

    UNIQUE INDEX `Video_videoId_key`(`videoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookTag` ADD CONSTRAINT `BookTag_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookTag` ADD CONSTRAINT `BookTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Series` ADD CONSTRAINT `Series_bookRef_fkey` FOREIGN KEY (`bookRef`) REFERENCES `Book`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Video` ADD CONSTRAINT `Video_seriesRef_fkey` FOREIGN KEY (`seriesRef`) REFERENCES `Series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
