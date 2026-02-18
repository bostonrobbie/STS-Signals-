ALTER TABLE `open_positions` ADD `isTest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `isTest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `webhook_logs` ADD `isTest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_open_positions_is_test` ON `open_positions` (`isTest`);--> statement-breakpoint
CREATE INDEX `idx_trades_is_test` ON `trades` (`isTest`);--> statement-breakpoint
CREATE INDEX `idx_webhook_logs_is_test` ON `webhook_logs` (`isTest`);