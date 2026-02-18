ALTER TABLE `user_subscriptions` ADD `accountValue` int DEFAULT 100000;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD `useLeveraged` boolean DEFAULT false NOT NULL;