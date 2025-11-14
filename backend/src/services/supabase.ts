import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function uploadImageFromBuffer(path: string, buffer: Buffer, contentType: string) {
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data: pub } = supabase.storage.from(env.SUPABASE_BUCKET).getPublicUrl(path);
  return { path: data.path, publicUrl: pub.publicUrl };
}

export async function deleteObjectByPublicUrl(publicUrl: string) {
  const base = `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_BUCKET}/`;
  if (!publicUrl.startsWith(base)) return false;
  const path = publicUrl.slice(base.length);
  const { error } = await supabase.storage.from(env.SUPABASE_BUCKET).remove([path]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  return true;
}
