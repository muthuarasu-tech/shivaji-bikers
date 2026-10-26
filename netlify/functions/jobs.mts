import type { Config, Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { getUser } from "@netlify/identity";

const db = getDatabase();

const toJob = (r: any) => ({
  ...r,
  spare_price: Number(r.spare_price),
  labor_price: Number(r.labor_price),
  total: Number(r.total),
  date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
});

export default async (req: Request, context: Context) => {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const id = context.params.id ? Number(context.params.id) : null;

  if (req.method === "GET" && id) {
    const [job] = await db.sql`SELECT * FROM jobs WHERE id = ${id}`;
    return job ? Response.json(toJob(job)) : new Response("Not found", { status: 404 });
  }

  if (req.method === "GET") {
    const search = new URL(req.url).searchParams.get("search")?.trim() || "";
    const q = `%${search}%`;
    const rows = search
      ? await db.sql`SELECT * FROM jobs WHERE customer_name ILIKE ${q} OR bike_number ILIKE ${q}
          OR customer_phone ILIKE ${q} OR job_no ILIKE ${q} ORDER BY id DESC`
      : await db.sql`SELECT * FROM jobs ORDER BY id DESC`;
    return Response.json(rows.map(toJob));
  }

  if (req.method === "POST") {
    const b = await req.json();
    for (const f of ["customer_name", "customer_phone", "bike_name", "bike_number", "bike_problem"]) {
      if (!String(b[f] ?? "").trim()) return new Response(`${f} is required`, { status: 400 });
    }
    const spare = Number(b.spare_price) || 0;
    const labor = Number(b.labor_price) || 0;
    const [job] = await db.sql`
      INSERT INTO jobs (customer_name, customer_phone, bike_name, bike_number, bike_problem,
                        spare_price, labor_price, total, notes)
      VALUES (${b.customer_name}, ${b.customer_phone}, ${b.bike_name}, ${String(b.bike_number).toUpperCase()},
              ${b.bike_problem}, ${spare}, ${labor}, ${spare + labor}, ${b.notes || ""})
      RETURNING *`;
    const jobNo = "SBJ" + String(job.id).padStart(5, "0");
    await db.sql`UPDATE jobs SET job_no = ${jobNo} WHERE id = ${job.id}`;
    return Response.json(toJob({ ...job, job_no: jobNo }), { status: 201 });
  }

  if (req.method === "PATCH" && id) {
    const { status } = await req.json();
    await db.sql`UPDATE jobs SET status = ${status} WHERE id = ${id}`;
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE" && id) {
    await db.sql`DELETE FROM jobs WHERE id = ${id}`;
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: ["/api/jobs", "/api/jobs/:id"] };
