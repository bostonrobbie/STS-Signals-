CREATE TABLE `waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','converted','unsubscribed') NOT NULL DEFAULT 'pending',
	`source` varchar(50) NOT NULL DEFAULT 'homepage',
	`convertedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_waitlist_email` ON `waitlist` (`email`);--> statement-breakpoint
CREATE INDEX `idx_waitlist_status` ON `waitlist` (`status`);