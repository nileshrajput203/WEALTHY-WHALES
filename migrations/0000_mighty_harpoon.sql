CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar NOT NULL,
	"message" text NOT NULL,
	"role" varchar NOT NULL,
	"stock_context" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fugu_candlestick_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"candlestick_name" varchar(50) NOT NULL,
	"total_occurrences" integer DEFAULT 0 NOT NULL,
	"win_rate_5d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_20d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_60d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fugu_candlestick_stats_candlestick_name_unique" UNIQUE("candlestick_name")
);
--> statement-breakpoint
CREATE TABLE "fugu_elite_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"pick_date" timestamp DEFAULT now() NOT NULL,
	"fugu_score" numeric(5, 2) NOT NULL,
	"reasoning" text NOT NULL,
	"verdict" varchar(15) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fugu_factor_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"weights" jsonb NOT NULL,
	"accuracy" numeric(5, 2),
	"sample_size" integer,
	"notes" text,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "fugu_factor_weights_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "fugu_learning_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"findings" text NOT NULL,
	"raw_data" jsonb,
	"gemini_reasoning" text
);
--> statement-breakpoint
CREATE TABLE "fugu_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"price_5d" numeric(10, 2),
	"price_10d" numeric(10, 2),
	"price_20d" numeric(10, 2),
	"price_30d" numeric(10, 2),
	"price_60d" numeric(10, 2),
	"price_90d" numeric(10, 2),
	"return_5d" numeric(6, 2),
	"return_10d" numeric(6, 2),
	"return_20d" numeric(6, 2),
	"return_30d" numeric(6, 2),
	"return_60d" numeric(6, 2),
	"return_90d" numeric(6, 2),
	"max_drawdown" numeric(5, 2),
	"volatility" numeric(5, 2),
	"benchmark_performance" numeric(6, 2),
	"outcome_5d" varchar(10),
	"outcome_10d" varchar(10),
	"outcome_20d" varchar(10),
	"outcome_30d" varchar(10),
	"outcome_60d" varchar(10),
	"outcome_90d" varchar(10),
	"filled_at_5d" timestamp,
	"filled_at_10d" timestamp,
	"filled_at_20d" timestamp,
	"filled_at_30d" timestamp,
	"filled_at_60d" timestamp,
	"filled_at_90d" timestamp
);
--> statement-breakpoint
CREATE TABLE "fugu_pattern_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_name" varchar(50) NOT NULL,
	"total_occurrences" integer DEFAULT 0 NOT NULL,
	"win_rate_5d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_20d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_60d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fugu_pattern_stats_pattern_name_unique" UNIQUE("pattern_name")
);
--> statement-breakpoint
CREATE TABLE "fugu_regime_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"regime_type" varchar(30) NOT NULL,
	"win_rate_5d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_20d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_60d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"average_return_5d" numeric(6, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fugu_regime_stats_regime_type_unique" UNIQUE("regime_type")
);
--> statement-breakpoint
CREATE TABLE "fugu_sector_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"sector_name" varchar(50) NOT NULL,
	"total_occurrences" integer DEFAULT 0 NOT NULL,
	"win_rate_5d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_20d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"win_rate_60d" numeric(5, 2) DEFAULT '0' NOT NULL,
	"momentum_score" numeric(5, 2) DEFAULT '50' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fugu_sector_stats_sector_name_unique" UNIQUE("sector_name")
);
--> statement-breakpoint
CREATE TABLE "fugu_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"scanner_source" varchar(50) NOT NULL,
	"scan_date" timestamp DEFAULT now() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"technical_score" integer DEFAULT 0 NOT NULL,
	"pattern_score" integer DEFAULT 0 NOT NULL,
	"pattern_confidence" integer DEFAULT 0 NOT NULL,
	"candlestick_score" integer DEFAULT 0 NOT NULL,
	"fundamental_score" integer DEFAULT 0 NOT NULL,
	"sector_score" integer DEFAULT 0 NOT NULL,
	"macro_score" integer DEFAULT 0 NOT NULL,
	"fugu_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"similarity_to_winners" numeric(5, 2) DEFAULT '50' NOT NULL,
	"similarity_to_losers" numeric(5, 2) DEFAULT '50' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight_version" integer DEFAULT 1 NOT NULL,
	"elite_reasoning" text
);
--> statement-breakpoint
CREATE TABLE "hermes_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"price_5d" numeric(10, 2),
	"price_10d" numeric(10, 2),
	"price_20d" numeric(10, 2),
	"return_5d" numeric(6, 2),
	"return_10d" numeric(6, 2),
	"return_20d" numeric(6, 2),
	"outcome_5d" varchar(10),
	"outcome_10d" varchar(10),
	"outcome_20d" varchar(10),
	"filled_5d_at" timestamp,
	"filled_10d_at" timestamp,
	"filled_20d_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hermes_regime_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"regime" varchar(20) NOT NULL,
	"nifty_price" numeric(10, 2),
	"nifty_change_1w" numeric(6, 2),
	"nifty_change_1m" numeric(6, 2),
	"advance_decline_ratio" numeric(5, 2),
	"market_breadth" varchar(10),
	"gemini_analysis" text
);
--> statement-breakpoint
CREATE TABLE "hermes_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"scan_date" timestamp DEFAULT now() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"volume" numeric(15, 0),
	"volume_avg_20d" numeric(15, 0),
	"rvol" numeric(5, 2),
	"rsi_14" numeric(5, 2),
	"sma_20" numeric(10, 2),
	"sma_50" numeric(10, 2),
	"ema_12" numeric(10, 2),
	"ema_26" numeric(10, 2),
	"macd_histogram" numeric(8, 4),
	"adx" numeric(5, 2),
	"atr_14" numeric(10, 2),
	"pe" numeric(8, 2),
	"roe" numeric(6, 2),
	"debt_to_equity" numeric(6, 2),
	"opm" numeric(6, 2),
	"roce" numeric(6, 2),
	"peg" numeric(6, 2),
	"market_cap_value" numeric(15, 0),
	"dividend_yield" numeric(5, 2),
	"return_1w" numeric(6, 2),
	"return_1m" numeric(6, 2),
	"return_3m" numeric(6, 2),
	"return_6m" numeric(6, 2),
	"proximity_52w_high" numeric(5, 2),
	"iq_total" integer,
	"iq_fundamentals" integer,
	"iq_technicals" integer,
	"iq_momentum" integer,
	"iq_insider" integer,
	"pattern_detected" varchar(50),
	"pattern_stage" varchar(30),
	"sector" varchar(50),
	"market_cap_bucket" varchar(10),
	"hermes_score" numeric(5, 2),
	"hermes_verdict" varchar(10),
	"weight_version" integer
);
--> statement-breakpoint
CREATE TABLE "hermes_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"weights" jsonb NOT NULL,
	"accuracy" numeric(5, 2),
	"sample_size" integer,
	"win_rate_5d" numeric(5, 2),
	"win_rate_10d" numeric(5, 2),
	"win_rate_20d" numeric(5, 2),
	"notes" text,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "hermes_weights_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "market_data_cache" (
	"key" varchar PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"source" varchar,
	"url" varchar,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scanner_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scanner_type" varchar NOT NULL,
	"stock_symbol" varchar NOT NULL,
	"stock_name" varchar NOT NULL,
	"exchange" varchar NOT NULL,
	"price" varchar NOT NULL,
	"change" varchar NOT NULL,
	"change_percent" varchar NOT NULL,
	"volume" varchar,
	"market_cap" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"data" jsonb NOT NULL,
	"scraped_at" timestamp DEFAULT now(),
	CONSTRAINT "screener_cache_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"signal_type" varchar(50) NOT NULL,
	"direction" varchar(5) NOT NULL,
	"confidence" integer,
	"price_at_signal" numeric(10, 2) NOT NULL,
	"rsi" numeric(5, 2),
	"macd_histogram" numeric(8, 4),
	"adx" numeric(5, 2),
	"rvol" numeric(5, 2),
	"ema_alignment" integer,
	"sector" varchar(50),
	"market_cap" varchar(10),
	"market_condition" varchar(10),
	"price_5d" numeric(10, 2),
	"price_10d" numeric(10, 2),
	"price_20d" numeric(10, 2),
	"return_5d" numeric(6, 2),
	"return_10d" numeric(6, 2),
	"return_20d" numeric(6, 2),
	"outcome" varchar(10),
	"outcome_checked_at" timestamp,
	"fired_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_symbol" varchar NOT NULL,
	"stock_name" varchar NOT NULL,
	"exchange" varchar NOT NULL,
	"recommendation_type" varchar NOT NULL,
	"reason_to_buy" text NOT NULL,
	"target_price" varchar NOT NULL,
	"stop_loss" varchar NOT NULL,
	"current_price" varchar NOT NULL,
	"image_url" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false,
	"telegram_chat_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fugu_elite_picks" ADD CONSTRAINT "fugu_elite_picks_snapshot_id_fugu_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."fugu_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fugu_outcomes" ADD CONSTRAINT "fugu_outcomes_snapshot_id_fugu_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."fugu_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hermes_outcomes" ADD CONSTRAINT "hermes_outcomes_snapshot_id_hermes_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."hermes_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_recommendations" ADD CONSTRAINT "stock_recommendations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fugu_elite_picks_symbol" ON "fugu_elite_picks" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_fugu_elite_picks_date" ON "fugu_elite_picks" USING btree ("pick_date");--> statement-breakpoint
CREATE INDEX "idx_fugu_outcomes_snapshot" ON "fugu_outcomes" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_fugu_outcomes_symbol" ON "fugu_outcomes" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_fugu_snapshots_symbol" ON "fugu_snapshots" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_fugu_snapshots_scan_date" ON "fugu_snapshots" USING btree ("scan_date");--> statement-breakpoint
CREATE INDEX "idx_fugu_snapshots_fugu_score" ON "fugu_snapshots" USING btree ("fugu_score");--> statement-breakpoint
CREATE INDEX "idx_hermes_outcomes_snapshot" ON "hermes_outcomes" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_hermes_outcomes_symbol" ON "hermes_outcomes" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_hermes_snapshots_symbol" ON "hermes_snapshots" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_hermes_snapshots_scan_date" ON "hermes_snapshots" USING btree ("scan_date");--> statement-breakpoint
CREATE INDEX "idx_hermes_snapshots_score" ON "hermes_snapshots" USING btree ("hermes_score");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");