import { pgTable, serial, text, integer, doublePrecision, date, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  username: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const sessions = pgTable("sessions", {
  token: text().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial().primaryKey(),
  jobNo: text("job_no").unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  bikeName: text("bike_name").notNull(),
  bikeNumber: text("bike_number").notNull(),
  bikeProblem: text("bike_problem").notNull(),
  sparePrice: doublePrecision("spare_price").notNull().default(0),
  laborPrice: doublePrecision("labor_price").notNull().default(0),
  profit: doublePrecision().notNull().default(0),
  total: doublePrecision().notNull().default(0),
  date: date({ mode: "string" }).notNull().defaultNow(),
  status: text().notNull().default("Pending"),
  notes: text(),
});

export type Job = typeof jobs.$inferSelect;
