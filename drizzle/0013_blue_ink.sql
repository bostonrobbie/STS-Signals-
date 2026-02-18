CREATE TABLE `broker_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookLogId` int,
	`openPositionId` int,
	`tradeId` int,
	`internalOrderId` varchar(64) NOT NULL,
	`brokerOrderId` varchar(64),
	`broker` varchar(20) NOT NULL,
	`strategySymbol` varchar(50) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`action` enum('buy','sell') NOT NULL,
	`orderType` enum('market','limit','stop','stop_limit') NOT NULL DEFAULT 'market',
	`quantity` int NOT NULL,
	`requestedPrice` int,
	`limitPrice` int,
	`stopPrice` int,
	`filledQuantity` int NOT NULL DEFAULT 0,
	`avgFillPrice` int,
	`commission` int DEFAULT 0,
	`status` enum('pending','submitted','acknowledged','working','partially_filled','filled','cancelled','rejected','expired','error') NOT NULL DEFAULT 'pending',
	`brokerStatus` varchar(100),
	`rejectReason` text,
	`submittedAt` datetime,
	`acknowledgedAt` datetime,
	`filledAt` datetime,
	`cancelledAt` datetime,
	`isTest` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `broker_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `broker_orders_internalOrderId_unique` UNIQUE(`internalOrderId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('trade_executed','trade_error','position_opened','position_closed','webhook_failed','daily_digest','system') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`strategyId` int,
	`tradeId` int,
	`webhookLogId` int,
	`read` boolean NOT NULL DEFAULT false,
	`dismissed` boolean NOT NULL DEFAULT false,
	`emailSent` boolean NOT NULL DEFAULT false,
	`emailSentAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paper_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`balance` int NOT NULL DEFAULT 10000000,
	`startingBalance` int NOT NULL DEFAULT 10000000,
	`realizedPnl` int DEFAULT 0,
	`totalTrades` int DEFAULT 0,
	`winningTrades` int DEFAULT 0,
	`losingTrades` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paper_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paper_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`strategyId` int,
	`symbol` varchar(20) NOT NULL,
	`side` enum('LONG','SHORT') NOT NULL,
	`quantity` int NOT NULL,
	`entryPrice` int NOT NULL,
	`entryDate` datetime NOT NULL,
	`exitPrice` int,
	`exitDate` datetime,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`unrealizedPnl` int DEFAULT 0,
	`realizedPnl` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paper_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paper_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`positionId` int,
	`strategyId` int,
	`symbol` varchar(20) NOT NULL,
	`side` enum('BUY','SELL') NOT NULL,
	`quantity` int NOT NULL,
	`price` int NOT NULL,
	`orderType` enum('MARKET','LIMIT','STOP') NOT NULL,
	`pnl` int DEFAULT 0,
	`commission` int DEFAULT 0,
	`executedAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paper_trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `position_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openPositionId` int,
	`strategySymbol` varchar(50) NOT NULL,
	`adjustmentType` enum('force_close','force_open','quantity_adjust','price_adjust','sync_from_broker','manual_override') NOT NULL,
	`beforeDirection` varchar(10),
	`beforeQuantity` int,
	`beforeEntryPrice` int,
	`afterDirection` varchar(10),
	`afterQuantity` int,
	`afterEntryPrice` int,
	`reason` text NOT NULL,
	`adjustedBy` varchar(100) NOT NULL,
	`reconciliationLogId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `position_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reconciliation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reconciliationId` varchar(64) NOT NULL,
	`runAt` datetime NOT NULL,
	`broker` varchar(20) NOT NULL,
	`accountId` varchar(64),
	`strategySymbol` varchar(50),
	`symbol` varchar(20) NOT NULL,
	`dbPositionId` int,
	`dbDirection` varchar(10),
	`dbQuantity` int,
	`dbEntryPrice` int,
	`brokerDirection` varchar(10),
	`brokerQuantity` int,
	`brokerAvgPrice` int,
	`discrepancyType` enum('missing_in_db','missing_in_broker','quantity_mismatch','direction_mismatch','price_mismatch','matched') NOT NULL,
	`discrepancyDetails` text,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedAt` datetime,
	`resolvedBy` varchar(100),
	`resolutionAction` varchar(50),
	`resolutionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reconciliation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signal_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(50) NOT NULL,
	`strategySymbol` varchar(20) NOT NULL,
	`windowStartAt` datetime NOT NULL,
	`windowEndAt` datetime,
	`signalCount` int NOT NULL DEFAULT 0,
	`netDirection` varchar(10),
	`netQuantity` int NOT NULL DEFAULT 0,
	`avgPrice` int,
	`status` enum('collecting','processing','completed','failed') NOT NULL DEFAULT 'collecting',
	`resultWebhookLogId` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signal_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_batches_batchId_unique` UNIQUE(`batchId`)
);
--> statement-breakpoint
CREATE TABLE `webhook_retry_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalPayload` text NOT NULL,
	`correlationId` varchar(50) NOT NULL,
	`strategySymbol` varchar(20),
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 5,
	`nextRetryAt` datetime NOT NULL,
	`lastError` text,
	`status` enum('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` datetime,
	CONSTRAINT `webhook_retry_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_wal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walId` varchar(64) NOT NULL,
	`correlationId` varchar(64) NOT NULL,
	`rawPayload` text NOT NULL,
	`strategySymbol` varchar(50),
	`action` varchar(20),
	`direction` varchar(10),
	`price` int,
	`quantity` int,
	`status` enum('received','processing','completed','failed','retrying') NOT NULL DEFAULT 'received',
	`attempts` int NOT NULL DEFAULT 0,
	`lastAttemptAt` datetime,
	`completedAt` datetime,
	`resultWebhookLogId` int,
	`errorMessage` text,
	`sourceIp` varchar(45),
	`userAgent` varchar(255),
	`receivedAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_wal_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_wal_walId_unique` UNIQUE(`walId`)
);
--> statement-breakpoint
ALTER TABLE `broker_connections` MODIFY COLUMN `broker` enum('tradovate','ibkr','tradestation','alpaca') NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `globalMute` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `muteTradeExecuted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `muteTradeError` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `mutePositionOpened` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `mutePositionClosed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `muteWebhookFailed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `muteDailyDigest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `emailEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `emailAddress` varchar(320);--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `inAppEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `soundEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `source` enum('csv_import','webhook','manual') DEFAULT 'csv_import' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `startingCapital` int DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `contractSize` enum('mini','micro') DEFAULT 'micro' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
CREATE INDEX `idx_broker_orders_internal` ON `broker_orders` (`internalOrderId`);--> statement-breakpoint
CREATE INDEX `idx_broker_orders_broker` ON `broker_orders` (`brokerOrderId`);--> statement-breakpoint
CREATE INDEX `idx_broker_orders_status` ON `broker_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_broker_orders_strategy` ON `broker_orders` (`strategySymbol`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notifications_type` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notifications_read` ON `notifications` (`read`);--> statement-breakpoint
CREATE INDEX `idx_notifications_created` ON `notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_paper_accounts_user` ON `paper_accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_paper_positions_account` ON `paper_positions` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_paper_positions_status` ON `paper_positions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_paper_positions_symbol` ON `paper_positions` (`symbol`);--> statement-breakpoint
CREATE INDEX `idx_paper_trades_account` ON `paper_trades` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_paper_trades_position` ON `paper_trades` (`positionId`);--> statement-breakpoint
CREATE INDEX `idx_paper_trades_executed` ON `paper_trades` (`executedAt`);--> statement-breakpoint
CREATE INDEX `idx_position_adjustments_position` ON `position_adjustments` (`openPositionId`);--> statement-breakpoint
CREATE INDEX `idx_position_adjustments_strategy` ON `position_adjustments` (`strategySymbol`);--> statement-breakpoint
CREATE INDEX `idx_position_adjustments_type` ON `position_adjustments` (`adjustmentType`);--> statement-breakpoint
CREATE INDEX `idx_reconciliation_run` ON `reconciliation_logs` (`reconciliationId`);--> statement-breakpoint
CREATE INDEX `idx_reconciliation_broker` ON `reconciliation_logs` (`broker`);--> statement-breakpoint
CREATE INDEX `idx_reconciliation_discrepancy` ON `reconciliation_logs` (`discrepancyType`);--> statement-breakpoint
CREATE INDEX `idx_reconciliation_unresolved` ON `reconciliation_logs` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_signal_batches_batch` ON `signal_batches` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_signal_batches_strategy` ON `signal_batches` (`strategySymbol`);--> statement-breakpoint
CREATE INDEX `idx_signal_batches_status` ON `signal_batches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_retry_queue_status` ON `webhook_retry_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_retry_queue_next_retry` ON `webhook_retry_queue` (`nextRetryAt`);--> statement-breakpoint
CREATE INDEX `idx_retry_queue_correlation` ON `webhook_retry_queue` (`correlationId`);--> statement-breakpoint
CREATE INDEX `idx_webhook_wal_wal_id` ON `webhook_wal` (`walId`);--> statement-breakpoint
CREATE INDEX `idx_webhook_wal_status` ON `webhook_wal` (`status`);--> statement-breakpoint
CREATE INDEX `idx_webhook_wal_correlation` ON `webhook_wal` (`correlationId`);--> statement-breakpoint
CREATE INDEX `idx_webhook_wal_received_at` ON `webhook_wal` (`receivedAt`);--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `emailNotificationsEnabled`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `pushNotificationsEnabled`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `notifyOnEntry`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `notifyOnExit`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `notifyOnProfit`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `notifyOnLoss`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `quietHoursStart`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `quietHoursEnd`;--> statement-breakpoint
ALTER TABLE `notification_preferences` DROP COLUMN `quietHoursTimezone`;