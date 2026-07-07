/**
 * Types for Supabase Edge Functions (Deno).
 * Runtime: Supabase runs this function with Deno; these declarations satisfy the IDE.
 */
declare module 'npm:@supabase/supabase-js@2' {
  export { createClient } from '@supabase/supabase-js';
}

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
