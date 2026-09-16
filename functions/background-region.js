"use strict";

const LEGACY_REGION = "asia-south1";
const PRIMARY_REGION = "us-central1";
const ROUTING_COLLECTION = "_functionMigration";
const ROUTING_DOCUMENT = "regions";

// Both regional triggers read the same routing record. Route by the event's
// original time, not delivery time, so delayed events retain one owner.
function regionForEvent(config, event) {
  if (config.cutoverAt == null) return LEGACY_REGION;
  if (!Number.isFinite(config.cutoverAt)) throw new Error("Invalid function cutover time.");
  const eventTime = event?.data?.createTime?.toMillis?.()
    ?? Date.parse(event?.scheduleTime ?? event?.time);
  if (!Number.isFinite(eventTime)) throw new Error("Background event time is missing.");
  if (config.rollbackAt != null) {
    if (!Number.isFinite(config.rollbackAt) || config.rollbackAt <= config.cutoverAt) {
      throw new Error("Invalid function rollback time.");
    }
    if (eventTime >= config.rollbackAt) return LEGACY_REGION;
  }
  return eventTime >= config.cutoverAt ? PRIMARY_REGION : LEGACY_REGION;
}

async function shouldHandleEvent(db, region, event) {
  const snapshot = await db.collection(ROUTING_COLLECTION).doc(ROUTING_DOCUMENT).get();
  return regionForEvent(snapshot.data() || {}, event) === region;
}

module.exports = { LEGACY_REGION, PRIMARY_REGION, ROUTING_COLLECTION, ROUTING_DOCUMENT, regionForEvent, shouldHandleEvent };
