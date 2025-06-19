-- AlterTable
ALTER TABLE `User` ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `premiumUntil` DATETIME(3) NULL;
