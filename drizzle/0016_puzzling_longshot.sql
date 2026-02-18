ALTER TABLE `benchmarks` DROP INDEX `benchmarks_date_unique`;--> statement-breakpoint
ALTER TABLE `benchmarks` ADD `symbol` varchar(10) DEFAULT 'SPY' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_benchmarks_symbol_date` ON `benchmarks` (`symbol`,`date`);