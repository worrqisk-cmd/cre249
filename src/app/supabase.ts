import { inject, Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { SITE_CONFIG } from './site-config';

export const PHOTO_BUCKET = 'milana-catalog';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly config = inject(SITE_CONFIG);
  readonly client = createClient<Database>(
    this.config.supabaseUrl,
    this.config.supabasePublishableKey,
    {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    },
  );
}
