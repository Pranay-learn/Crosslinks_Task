-- Keep event ranges valid for API and direct database writers.
ALTER TABLE "CampusEvent" ADD CONSTRAINT "CampusEvent_range_check" CHECK ("endsAt" > "startsAt");
