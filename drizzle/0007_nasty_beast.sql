CREATE TABLE `open_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategyId` int NOT NULL,
	`strategySymbol` varchar(20) NOT NULL,
	`direction` varchar(10) NOT NULL,
	`entryPrice` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`entryTime` datetime NOT NULL,
	`entryWebhookLogId` int,
	`status` enum('open','closing','closed') NOT NULL DEFAULT 'open',
	`exitPrice` int,
	`exitTime` datetime,
	`exitWebhookLogId` int,
	`pnl` int,
	`tradeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `open_positions_id` PRIMARY KEY(`id`)
);
