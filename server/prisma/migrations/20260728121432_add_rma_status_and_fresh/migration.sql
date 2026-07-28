-- AlterTable
ALTER TABLE `requests` ADD COLUMN `rma_status` VARCHAR(191) NOT NULL DEFAULT 'RMA Not Received',
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'fresh';
