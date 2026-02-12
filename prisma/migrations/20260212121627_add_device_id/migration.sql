/*
  Warnings:

  - A unique constraint covering the columns `[deviceId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `deviceId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_deviceId_key` ON `User`(`deviceId`);
