import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://wnyaofugzxfnwvmqluer.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndueWFvZnVnenhmbnd2bXFsdWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDIwODAsImV4cCI6MjA5MDAxODA4MH0.RzAEw-sqdVR8SA_Vbx-tthpYdKWgo1Pj78XvuhDdx2k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
