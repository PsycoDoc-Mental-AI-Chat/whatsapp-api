-- CreateTable
CREATE TABLE `GeminiHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `waId` VARCHAR(191) NOT NULL,
    `history` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeminiHistory_waId_key`(`waId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
