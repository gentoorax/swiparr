ALTER TABLE `Like` ADD `canonicalId` text;
--> statement-breakpoint
CREATE INDEX `Like_sessionCode_canonicalId_idx` ON `Like` (`sessionCode`,`canonicalId`);
--> statement-breakpoint
ALTER TABLE `Hidden` ADD `canonicalId` text;
--> statement-breakpoint
CREATE INDEX `Hidden_sessionCode_canonicalId_idx` ON `Hidden` (`sessionCode`,`canonicalId`);

