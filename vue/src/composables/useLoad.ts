import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { ref, type Ref } from 'vue'

/**
 * One loading/error/data triple per screen: `reload()` runs the loader again; a failed load keeps
 * the previous data and exposes the backend's message (for an inline error with a Retry button).
 */
export function useLoad<T>(loader: () => Promise<T>) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function reload(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      data.value = await loader()
    } catch (err) {
      error.value = extractErrorDetail(err)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, reload }
}
