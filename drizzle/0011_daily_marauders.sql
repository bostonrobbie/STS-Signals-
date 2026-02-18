CREATE TABLE `staging_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookLogId` int NOT NULL,
	`strategyId` int NOT NULL,
	`strategySymbol` varchar(20) NOT NULL,
	`entryDate` datetime NOT NULL,
	`exitDate` datetime,
	`direction` varchar(10) NOT NULL,
	`entryPrice` int NOT NULL,
	`exitPrice` int,
	`quantity` int NOT NULL DEFAULT 1,
	`pnl` int,
	`pnlPercent` int,
	`commission` int NOT NULL DEFAULT 0,
	`isOpen` boolean NOT NULL DEFAULT true,
	`status` enum('pending','approved','rejected','edited') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` datetime,
	`reviewNotes` text,
	`originalPayload` text,
	`productionTradeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staging_trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_staging_trades_webhook` ON `staging_trades` (`webhookLogId`);--> statement-breakpoint
CREATE INDEX `idx_staging_trades_strategy` ON `staging_trades` (`strategyId`);--> statement-breakpoint
CREATE INDEX `idx_staging_trades_status` ON `staging_trades` (`status`);--> statement-breakpoint
CREATE INDEX `idx_staging_trades_is_open` ON `staging_trades` (`isOpen`);--> statement-breakpoint
CREATE INDEX `idx_staging_trades_created` ON `staging_trades` (`createdAt`);