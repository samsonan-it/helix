-- Story 4.5: notifications are now fully background/transparent; no UI tracking needed
ALTER TABLE "demands" DROP COLUMN "notification_status";
