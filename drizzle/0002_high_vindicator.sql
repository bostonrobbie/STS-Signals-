ALTER TABLE `strategies` ADD `contractSize` enum('mini','micro') DEFAULT 'mini' NOT NULL;--> statement-breakpoint
ALTER TABLE `strategies` ADD `microToMiniRatio` int DEFAULT 10 NOT NULL;