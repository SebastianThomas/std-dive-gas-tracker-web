<template>
  <PageShell title="Record a fill">
    <template #actions>
      <AppButton variant="link" :to="{ name: 'FillList', params: { teamId } }">All fills</AppButton>
    </template>
    <LoadState :loading="loading" :error="error" :ready="banks !== null" @retry="reload">
      <FillForm
        v-if="banks"
        :key="formKey"
        :banks="banks"
        :initial="initialDraft"
        submit-label="Save fill"
        :saving="saving"
        @submit="save"
      />
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import FillForm from '@/components/fill/FillForm.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useFillsApi } from '@/lib/api/fills'
import type { FillInput } from '@/lib/api/types'
import { useVesselsApi } from '@/lib/api/vessels'
import { emptyDraft } from '@/lib/fill/fillForm'
import { mixLabel } from '@/lib/format/mix'
import { formatMoney } from '@/lib/format/money'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { safeLocalStorage } from '@/lib/utils/safeLocalStorage'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

// F5: the most used screen. After saving, the form starts over (same cylinder size, fresh
// default banks) so the next cylinder is quick; the toast links to the saved fill.
const LAST_SIZE_KEY = 'gas-last-cylinder-size'

const router = useRouter()
const team = useTeamStore()
const { teamId } = useTeamRoute()
const {
  data: banks,
  loading,
  error,
  reload,
} = useLoad(() => useVesselsApi().list(teamId.value, 'IN_SERVICE'))
const saving = ref(false)
const formKey = ref(0)

const initialDraft = computed(() =>
  emptyDraft(
    banks.value ?? [],
    team.myMemberId ?? 0,
    safeLocalStorage.getItem(LAST_SIZE_KEY) ?? '',
  ),
)

async function save(input: FillInput) {
  saving.value = true
  try {
    const fill = await useFillsApi().create(teamId.value, input)
    if (input.target.type === 'CYLINDER') {
      safeLocalStorage.setItem(LAST_SIZE_KEY, String(input.target.waterVolumeLitres))
    }
    toast.success(
      `Saved: ${mixLabel(fill.endMix)}, ${formatMoney(fill.totalCharge, team.currency)}`,
      {
        action: {
          label: 'Open',
          onClick: () =>
            void router.push({
              name: 'FillDetail',
              params: { teamId: teamId.value, fillId: fill.fillId },
            }),
        },
      },
    )
    await reload()
    formKey.value++
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}

void reload()
</script>
