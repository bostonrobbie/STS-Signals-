CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`resourceType` varchar(50),
	`resourceId` int,
	`ipAddress` varchar(45),
	`userAgent` text,
	`previousValue` text,
	`newValue` text,
	`status` enum('success','failure') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dead_letter_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalPayload` text NOT NULL,
	`ipAddress` varchar(45),
	`failureReason` text NOT NULL,
	`attempts` int NOT NULL,
	`lastAttemptAt` datetime,
	`errorHistory` text,
	`status` enum('unresolved','resolved','ignored') NOT NULL DEFAULT 'unresolved',
	`resolvedBy` int,
	`resolvedAt` datetime,
	`resolutionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dead_letter_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int,
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(100),
	`stripeInvoiceId` varchar(100),
	`receiptUrl` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_tiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` text,
	`priceMonthly` int NOT NULL,
	`priceYearly` int,
	`maxStrategies` int,
	`maxBrokerConnections` int,
	`autoExecuteAllowed` boolean NOT NULL DEFAULT false,
	`prioritySupport` boolean NOT NULL DEFAULT false,
	`stripeProductId` varchar(100),
	`stripePriceIdMonthly` varchar(100),
	`stripePriceIdYearly` varchar(100),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_payment_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tierId` int NOT NULL,
	`status` enum('active','past_due','cancelled','paused','trialing') NOT NULL DEFAULT 'active',
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`currentPeriodStart` datetime,
	`currentPeriodEnd` datetime,
	`trialStart` datetime,
	`trialEnd` datetime,
	`stripeCustomerId` varchar(100),
	`stripeSubscriptionId` varchar(100),
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`cancelledAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_payment_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_payment_subscriptions_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`webhookLogId` int NOT NULL,
	`strategyId` int NOT NULL,
	`direction` varchar(10) NOT NULL,
	`price` int NOT NULL,
	`quantity` int NOT NULL,
	`action` enum('pending','executed','skipped','expired') NOT NULL DEFAULT 'pending',
	`executionLogId` int,
	`signalReceivedAt` datetime NOT NULL,
	`actionTakenAt` datetime,
	`expiresAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyId` int NOT NULL,
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`autoExecuteEnabled` boolean NOT NULL DEFAULT false,
	`quantityMultiplier` decimal(10,4) DEFAULT '1.0000',
	`maxPositionSize` int,
	`subscribedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`ipAddress` varchar(45),
	`status` enum('pending','processing','completed','failed','dead') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 5,
	`nextRetryAt` datetime,
	`lastError` text,
	`webhookLogId` int,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` datetime,
	`completedAt` datetime,
	`processingTimeMs` int,
	`correlationId` varchar(50),
	CONSTRAINT `webhook_queue_id` PRIMARY KEY(`id`)
);
