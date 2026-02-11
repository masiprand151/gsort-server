/*
  Warnings:

  - You are about to drop the column `disclaimer` on the `book` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `book` DROP COLUMN `disclaimer`;

-- AlterTable
ALTER TABLE `video` ADD COLUMN `disclaimer` JSON NULL;
