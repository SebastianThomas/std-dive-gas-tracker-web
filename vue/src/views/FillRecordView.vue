<template>
  <PageShell title="Record a fill">
    <template #actions>
      <AppButton variant="link" :to="{ name: 'FillList', params: { teamId } }">All fills</AppButton>
    </template>
    <div
      class="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800"
      role="group"
      aria-label="What to record"
    >
      <button
        v-for="option in PANES"
        :key="option.key"
        type="button"
        class="min-h-11 rounded-lg px-2 font-medium"
        :class="
          pane === option.key
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
            : 'text-slate-600 dark:text-slate-300'
        "
        :aria-pressed="pane === option.key"
        @click="choosePane(option.key)"
      >
        {{ option.label }}
      </button>
    </div>
    <LoadState :loading="loading" :error="error" :ready="banks !== null" @retry="reload">
      <template v-if="banks">
        <FillForm
          v-if="pane === 'CYLINDER'"
          :key="formKey"
          :banks="banks"
          :initial="initialDraft"
          submit-label="Save fill"
          :saving="saving"
          @submit="save"
        />
        <BankDrawForm
          v-else
          :key="`draw-${formKey}`"
          :banks="banks"
          :initial="emptyBankDraw(banks, team.myMemberId ?? 0)"
          submit-label="Save fill"
          :saving="saving"
          @submit="save"
        />
      </template>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import BankDrawForm from '@/components/fill/BankDrawForm.vue'
import FillForm from '@/components/fill/FillForm.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useFillsApi } from '@/lib/api/fills'
import type { FillInput } from '@/lib/api/types'
import { useVesselsApi } from '@/lib/api/vessels'
import { emptyBankDraw, emptyDraft } from '@/lib/fill/fillForm'
import { mixLabel } from '@/lib/format/mix'
import { formatMoney } from '@/lib/format/money'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { safeLocalStorage } from '@/lib/utils/safeLocalStorage'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

// F5: the most used screen, two ways to record: a cylinder with its gases, or just how far a bank
// went down. After saving, the form starts over (same cylinder size, fresh default banks) so the
// next cylinder is quick; the toast links to the saved fill.
type Pane = 'CYLINDER' | 'BANK_DRAW'

const LAST_SIZE_KEY = 'gas-last-cylinder-size'
const LAST_PANE_KEY = 'gas-last-fill-pane'
const PANES: readonly { key: Pane; label: string }[] = [
  { key: 'CYLINDER', label: 'Fill a cylinder' },
  { key: 'BANK_DRAW', label: 'Bank went down' },
]

const router = useRouter()
const route = useRoute()
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
const pane = ref<Pane>(
  // "Fill this mix" needs the cylinder form's gases; otherwise the way last used.
  route.query.into === undefined && safeLocalStorage.getItem(LAST_PANE_KEY) === 'BANK_DRAW'
    ? 'BANK_DRAW'
    : 'CYLINDER',
)

function choosePane(next: Pane) {
  pane.value = next
  safeLocalStorage.setItem(LAST_PANE_KEY, next)
}

const initialDraft = computed(() => {
  const draft = emptyDraft(
    banks.value ?? [],
    team.myMemberId ?? 0,
    safeLocalStorage.getItem(LAST_SIZE_KEY) ?? '',
  )
  // "Fill this mix": into that bank, starting from what it holds now.
  const into = banks.value?.find((bank) => String(bank.vesselId) === route.query.into)
  return into
    ? {
        ...draft,
        intoVesselId: into.vesselId,
        startPressure: String(Math.round(into.estimatedPressureBar)),
      }
    : draft
})

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
