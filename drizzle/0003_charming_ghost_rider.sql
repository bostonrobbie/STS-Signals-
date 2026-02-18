CREATE TABLE `webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`status` enum('pending','processing','success','failed','duplicate') NOT NULL DEFAULT 'pending',
	`strategyId` int,
	`strategySymbol` varchar(20),
	`tradeId` int,
	`direction` varchar(10),
	`entryPrice` int,
	`exitPrice` int,
	`pnl` int,
	`entryTime` datetime,
	`exitTime` datetime,
	`ipAddress` varchar(45),
	`processingTimeMs` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_logs_id` PRIMARY KEY(`id`)
);
