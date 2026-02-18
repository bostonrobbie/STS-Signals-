CREATE TABLE `benchmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` datetime NOT NULL,
	`open` int NOT NULL,
	`high` int NOT NULL,
	`low` int NOT NULL,
	`close` int NOT NULL,
	`volume` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `benchmarks_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`market` varchar(50),
	`strategyType` varchar(50),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategies_id` PRIMARY KEY(`id`),
	CONSTRAINT `strategies_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategyId` int NOT NULL,
	`entryDate` datetime NOT NULL,
	`exitDate` datetime NOT NULL,
	`direction` varchar(10) NOT NULL,
	`entryPrice` int NOT NULL,
	`exitPrice` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`pnl` int NOT NULL,
	`pnlPercent` int NOT NULL,
	`commission` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
