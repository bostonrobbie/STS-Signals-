ALTER TABLE `users` ADD `freeAlertsRemaining` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `freeTrialStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `freeTrialExhaustedAt` timestamp;