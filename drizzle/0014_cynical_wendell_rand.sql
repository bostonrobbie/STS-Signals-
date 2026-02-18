CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`userId` int,
	`subject` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`category` enum('general','support','billing','feature_request','bug_report','partnership') NOT NULL DEFAULT 'general',
	`status` enum('new','read','in_progress','awaiting_response','resolved','closed') NOT NULL DEFAULT 'new',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`aiSuggestedResponse` text,
	`aiResponseGeneratedAt` datetime,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`responseText` text NOT NULL,
	`isAiGenerated` boolean NOT NULL DEFAULT false,
	`approvedBy` int,
	`approvedAt` datetime,
	`sentAt` datetime,
	`deliveryStatus` enum('draft','approved','sent','failed') NOT NULL DEFAULT 'draft',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_contact_messages_status` ON `contact_messages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_contact_messages_email` ON `contact_messages` (`email`);--> statement-breakpoint
CREATE INDEX `idx_contact_messages_created` ON `contact_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_contact_responses_message` ON `contact_responses` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_contact_responses_status` ON `contact_responses` (`deliveryStatus`);