CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailNotificationsEnabled` boolean NOT NULL DEFAULT true,
	`pushNotificationsEnabled` boolean NOT NULL DEFAULT true,
	`notifyOnEntry` boolean NOT NULL DEFAULT true,
	`notifyOnExit` boolean NOT NULL DEFAULT true,
	`notifyOnProfit` boolean NOT NULL DEFAULT true,
	`notifyOnLoss` boolean NOT NULL DEFAULT true,
	`quietHoursStart` varchar(5),
	`quietHoursEnd` varchar(5),
	`quietHoursTimezone` varchar(50) DEFAULT 'America/New_York',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyId` int NOT NULL,
	`emailEnabled` boolean NOT NULL DEFAULT true,
	`pushEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_notification_settings_id` PRIMARY KEY(`id`)
);
