<template>
  <PageShell title="Add a canister" :back="{ name: 'ScrubberList', params: { teamId } }">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <AppCard>
        <div class="flex flex-col gap-4">
          <TextField
            id="canister-label"
            v-model="label"
            label="Name"
            placeholder="e.g. Sofnolime #4"
            required
          />
          <TextField
            id="canister-capacity"
            v-model="capacity"
            label="Size"
            unit="kg"
            inputmode="decimal"
            class="max-w-56"
          />
        </div>
      </AppCard>
      <AppCard title="Cost (optional)">
        <CostPayers v-model="payments" />
      </AppCard>
      <AppButton type="submit" :loading="saving">Add canister</AppButton>
    </form>
  </PageShell>
</template>

<script setup lang="ts">
import CostPayers from '@/components/bank/CostPayers.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useScrubbersApi } from '@/lib/api/scrubbers'
import { parseDecimal } from '@/lib/format/number'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { costLinesOf, newCostRow, type CostRow } from '@/lib/utils/banks'
import { USUAL_CAPACITY_KG } from '@/lib/utils/scrubber'
import { useTeamStore } from '@/stores/team'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

// A new canister: what it holds and who paid for it, one person or several.
const router = useRouter()
const team = useTeamStore()
const { teamId } = useTeamRoute()
const label = ref('')
const capacity = ref(USUAL_CAPACITY_KG)
const payments = ref<CostRow[]>([newCostRow(team.myMemberId ?? 0)])
const saving = ref(false)

async function submit() {
  const capacityKg = parseDecimal(capacity.value)
  if (capacityKg === null || capacityKg <= 0) {
    toast.error('Enter the size in kg.')
    return
  }
  const initialCostLines = costLinesOf(payments.value)
  if (typeof initialCostLines === 'string') {
    toast.error(initialCostLines)
    return
  }
  saving.value = true
  try {
    const canister = await useScrubbersApi().create(teamId.value, {
      label: label.value.trim(),
      capacityKg,
      initialCostLines,
    })
    await router.replace({
      name: 'ScrubberDetail',
      params: { teamId: teamId.value, canisterId: canister.canisterId },
    })
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}
</script>
