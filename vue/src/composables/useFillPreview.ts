import { useTeamRoute } from '@/composables/useTeamRoute'
import { useFillsApi } from '@/lib/api/fills'
import type { FillInput, FillPreview } from '@/lib/api/types'
import type { Mapped } from '@/lib/fill/fillForm'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import axios from 'axios'
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

const PREVIEW_DELAY_MS = 300

/**
 * The live preview from the backend (debounced) of what a fill form holds. `replacingFillId`: the
 * edited fill, so the preview prices the edit as replacing it.
 */
export function useFillPreview(mapped: Ref<Mapped>, replacingFillId?: number) {
  const { teamId } = useTeamRoute()
  const preview = ref<FillPreview | null>(null)
  const previewError = ref<string | null>(null)
  const previewing = ref(false)
  const isEstimate = computed(
    () => preview.value?.stages.some((stage) => stage.isEstimate) ?? false,
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | undefined

  async function runPreview(input: FillInput) {
    const controller = new AbortController()
    inFlight = controller
    previewing.value = true
    try {
      preview.value = await useFillsApi().preview(
        teamId.value,
        input,
        controller.signal,
        replacingFillId,
      )
      previewError.value = null
    } catch (err) {
      if (controller.signal.aborted || axios.isCancel(err)) return
      preview.value = null
      previewError.value = extractErrorDetail(err)
    } finally {
      if (inFlight === controller) previewing.value = false
    }
  }

  watch(
    mapped,
    (current) => {
      clearTimeout(timer)
      inFlight?.abort()
      inFlight = undefined
      if ('problem' in current) return
      // the last result stays (dimmed) until the new one arrives: no layout jump while typing
      previewing.value = true
      timer = setTimeout(() => void runPreview(current.input), PREVIEW_DELAY_MS)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    clearTimeout(timer)
    inFlight?.abort()
  })

  return { preview, previewError, previewing, isEstimate }
}
