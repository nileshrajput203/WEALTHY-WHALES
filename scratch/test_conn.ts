import pg from "pg";

const poolerUrl = "postgresql://neondb_owner:npg_G8ClxfpYR6WU@ep-bold-sun-adfekmu3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const directUrl = "postgresql://neondb_owner:npg_G8ClxfpYR6WU@ep-bold-sun-adfekmu3.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function test(url: string, name: string) {
  console.log(`Testing ${name}...`);
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query("SELECT NOW()");
    console.log(`${name} SUCCESS:`, res.rows[0]);
  } catch (err: any) {
    console.error(`${name} FAILED:`, err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  await test(poolerUrl, "Pooler URL");
  await test(directUrl, "Direct URL");
}

main();
