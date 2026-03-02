import { syncInvestor, syncAll } from "../sec13FSyncService";
import { INVESTOR_CIK_MAP } from "../sec13FService";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "all") {
    console.log(`Syncing all ${Object.keys(INVESTOR_CIK_MAP).length} investors...`);
    const results = await syncAll(undefined, (r) => {
      const status = r.success ? `✓ #1: ${r.top1}` : `✗ ${r.error}`;
      console.log(`  ${r.investorId}: ${status}`);
    });
    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    console.log(`\nDone: ${ok} succeeded, ${fail} failed`);
  } else {
    const id = args[0] || "druckenmiller";
    console.log(`Syncing ${id}...`);
    const result = await syncInvestor(id);
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
