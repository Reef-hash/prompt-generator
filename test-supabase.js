const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ddwdwbhcnonbhmlipuvm.supabase.co', 'sb_publishable_REOH4QcENBCviLSQJg3Tdg_N98y5CG7');

async function test() {
  const { data: tables, error } = await supabase.from('prompts').select('*').limit(1);
  if (error) {
    console.error("Error querying 'prompts' table:", error);
  } else {
    console.log("Table 'prompts' exists.");
  }
}
test();
