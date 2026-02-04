-- AlterTable
ALTER TABLE `book` MODIFY `thumbUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `series` MODIFY `cover` TEXT NULL;

-- AlterTable
ALTER TABLE `video` MODIFY `mainUrl` TEXT NOT NULL,
    MODIFY `backupUrl` TEXT NULL,
    MODIFY `cover` TEXT NULL,
    MODIFY `episodeCover` TEXT NULL;
