import { createClient } from '@supabase/supabase-js';

// 1. A URL do seu projeto (que vimos no print anterior)
const supabaseUrl = "https://inkeqwysfgovftrwlqgt.supabase.co"; 

// 2. A Chave ANON que você mandou agora (a correta!)
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlua2Vxd3lzZmdvdmZ0cndscWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTg1MzAsImV4cCI6MjA4MDMzNDUzMH0.Jr3UBjVjoEK5wo_Im9n6Jy0DrbcAWGRUdcL4mR2qbgs";

export const supabase = createClient(supabaseUrl, supabaseKey);
