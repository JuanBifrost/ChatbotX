-- Migration: Add conversation assigned tracking
-- New tracking for conversation_assigned events

-- ============================================================
-- PART 1: Create conversation_assigned_hourly table
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_assigned_hourly (
    chatbot_id String,
    hour DateTime,
    assigned_count_state AggregateFunction(count)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (chatbot_id, hour)
TTL hour + INTERVAL 3 YEAR
SETTINGS index_granularity = 8192;

-- ============================================================
-- PART 2: Create materialized view for conversation_assigned
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS conversation_assigned_hourly_mv
TO conversation_assigned_hourly
AS SELECT
    chatbot_id,
    toStartOfHour(toDateTime(occurred_at, 'UTC')) as hour,
    countState() as assigned_count_state
FROM conversation_events
WHERE event_type = 'conversation_assigned'
GROUP BY chatbot_id, hour;

-- ============================================================
-- PART 3: Backfill conversation_assigned_hourly (if any exist)
-- ============================================================

INSERT INTO conversation_assigned_hourly
SELECT
    chatbot_id,
    toStartOfHour(toDateTime(occurred_at, 'UTC')) as hour,
    countState() as assigned_count_state
FROM conversation_events
WHERE event_type = 'conversation_assigned'
GROUP BY chatbot_id, hour;
