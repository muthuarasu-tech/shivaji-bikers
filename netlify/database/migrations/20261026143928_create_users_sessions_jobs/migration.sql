CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY,
	"job_no" text UNIQUE,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"bike_name" text NOT NULL,
	"bike_number" text NOT NULL,
	"bike_problem" text NOT NULL,
	"spare_price" double precision DEFAULT 0 NOT NULL,
	"labor_price" double precision DEFAULT 0 NOT NULL,
	"profit" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;