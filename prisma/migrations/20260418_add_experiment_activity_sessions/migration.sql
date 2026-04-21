CREATE TABLE "experiment_activity_sessions" (
    "id" SERIAL NOT NULL,
    "rid" TEXT NOT NULL,
    "client_session_id" TEXT NOT NULL,
    "page_path" TEXT,
    "visible_time_ms" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "scroll_count" INTEGER NOT NULL DEFAULT 0,
    "mousemove_count" INTEGER NOT NULL DEFAULT 0,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "experiment_activity_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "experiment_activity_sessions_rid_client_session_id_key"
ON "experiment_activity_sessions"("rid", "client_session_id");

CREATE INDEX "experiment_activity_sessions_rid_idx"
ON "experiment_activity_sessions"("rid");
