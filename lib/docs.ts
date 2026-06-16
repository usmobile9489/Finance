import { supabase } from './supabase'

// Uploads a file to the private "documents" bucket and returns its storage path + original name.
export async function uploadDoc(companyId: string, file: File): Promise<{ file_path: string; file_name: string }> {
  const ext = file.name.split('.').pop()
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
  if (error) throw error
  return { file_path: path, file_name: file.name }
}

// Opens an uploaded document via a short-lived signed URL (bucket is private).
export async function viewDoc(path: string) {
  const { data } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

// Removes an uploaded document from storage (ignore errors).
export async function removeDoc(path: string | null | undefined) {
  if (path) await supabase.storage.from('documents').remove([path])
}
