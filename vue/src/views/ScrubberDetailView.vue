<template>
  <PageShell
    :title="canister?.label ?? 'Canister'"
    :back="{ name: 'ScrubberList', params: { teamId } }"
  >
    <LoadState :loading="loading" :error="error" :ready="canister !== null" @retry="reload">
      <template v-if="canister">
        <AppCard>
          <p class="flex items-baseline justify-between gap-3">
            <span class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              <template v-if="isOpen">≈ {{ formatKg(canister.remainingKg) }} left</template>
              <template v-else>Empty</template>
            </span>
            <span class="text-slate-600 dark:text-slate-400">{{
              formatKg(canister.capacityKg)
            }}</span>
          </p>
          <div
            v-if="isOpen"
            class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            aria-hidden="true"
          >
            <div
              class="h-full rounded-full bg-sky-500"
              :style="{ width: `${remainingPercent(canister)}%` }"
            />
          </div>
          <dl
            class="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300"
          >
            <dt>Recorded</dt>
            <dd class="text-right">{{ formatKg(canister.recordedKg) }}</dd>
            <dt>Price</dt>
            <dd class="text-right">
              {{ money(canister.pricePerKg) }}/kg
              <span v-if="canister.isEstimate" class="text-amber-700 dark:text-amber-400"
                >estimate</span
              >
            </dd>
            <dt>In use since</dt>
            <dd class="text-right">{{ formatDate(canister.openedAt) }}</dd>
            <template v-if="canister.emptiedAt">
              <dt>Empty since</dt>
              <dd class="text-right">{{ formatDate(canister.emptiedAt) }}</dd>
            </template>
          </dl>
          <p v-if="canister.isEstimate" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The price is an estimate until the canister is empty; then its cost is shared by what
            everyone recorded.
          </p>
        </AppCard>

        <AppCard v-if="isOpen" title="Record use">
          <ScrubberUseForm :canisters="[canister]" :team-id="teamId" @saved="canister = $event" />
        </AppCard>

        <AppCard title="Uses">
          <p v-if="canister.uses.length === 0" class="text-slate-500 dark:text-slate-400">
            Nothing recorded yet.
          </p>
          <ul v-else class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="use in canister.uses"
              :key="use.useId"
              class="flex items-center justify-between gap-2 py-2"
            >
              <span class="flex min-w-0 flex-col">
                <span class="text-slate-900 dark:text-slate-100">
                  {{ formatKg(use.kg) }} · {{ use.member.displayName }} · {{ money(use.charge) }}
                </span>
                <span class="truncate text-sm text-slate-500 dark:text-slate-400">
                  {{ formatDate(use.usedAt) }}
                </span>
              </span>
              <AppButton
                v-if="
                  team.isAdmin ||
                  use.member.memberId === team.myMemberId ||
                  use.recordedBy.memberId === team.myMemberId
                "
                variant="ghost"
                :aria-label="`Delete ${formatKg(use.kg)} for ${use.member.displayName}`"
                :loading="busyId === use.useId"
                @click="deleteUse(use.useId)"
              >
                <i class="fa-solid fa-trash" aria-hidden="true" />
              </AppButton>
            </li>
          </ul>
        </AppCard>

        <AppCard title="Costs">
          <dl class="grid grid-cols-[1fr_auto] gap-x-4 text-slate-700 dark:text-slate-300">
            <dt>Paid for this canister</dt>
            <dd class="text-right font-medium">{{ money(canister.totalCost) }}</dd>
          </dl>
          <ul
            v-if="canister.costLines.length"
            class="mt-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800"
          >
            <li
              v-for="line in canister.costLines"
              :key="line.costLineId"
              class="flex items-center justify-between gap-2 py-2"
            >
              <span class="min-w-0 text-slate-900 dark:text-slate-100">
                {{ money(line.amount) }} · {{ line.payer.displayName }}
              </span>
              <AppButton
                v-if="team.isAdmin"
                variant="ghost"
                :aria-label="`Delete cost ${money(line.amount)} by ${line.payer.displayName}`"
                :loading="busyId === line.costLineId"
                @click="deleteCost(line.costLineId)"
              >
                <i class="fa-solid fa-trash" aria-hidden="true" />
              </AppButton>
            </li>
          </ul>
          <form class="mt-3 flex flex-col gap-3" novalidate @submit.prevent="addCost">
            <CostPayers v-model="payments" />
            <AppButton type="submit" variant="secondary" :loading="addingCost">Add cost</AppButton>
          </form>
        </AppCard>

        <div class="flex flex-wrap gap-2">
          <ConfirmAction
            v-if="isOpen"
            v-model:open="confirmEmpty"
            label="It is empty now"
            message="Mark this canister as empty? Its cost is then shared by what everyone recorded, and the price is final."
            confirm-label="Yes, it is empty"
            :busy="busy"
            @confirm="markEmpty"
          />
          <AppButton v-else-if="team.isAdmin" variant="secondary" :loading="busy" @click="reopen">
            Reopen canister
          </AppButton>
        </div>
      </template>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import CostPayers from '@/components/bank/CostPayers.vue'
import PageShell from '@/components/layout/PageShell.vue'
import ScrubberUseForm from '@/components/scrubber/ScrubberUseForm.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useScrubbersApi } from '@/lib/api/scrubbers'
import { formatDate } from '@/lib/format/dates'
import { formatMoney } from '@/lib/format/money'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { costLinesOf, newCostRow, type CostRow } from '@/lib/utils/banks'
import { formatKg, remainingPercent } from '@/lib/utils/scrubber'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

// One canister: what is left, who took what, who paid; anyone can say "it is empty now".
const team = useTeamStore()
const route = useRoute()
const { teamId } = useTeamRoute()
const canisterId = computed(() => Number(route.params.canisterId))
const {
  data: canister,
  loading,
  error,
  reload,
} = useLoad(() => useScrubbersApi().get(teamId.value, canisterId.value))
const isOpen = computed(() => canister.value?.status === 'OPEN')
const money = (value: string) => formatMoney(value, team.currency)
const payments = ref<CostRow[]>([newCostRow(team.myMemberId ?? 0)])
const confirmEmpty = ref(false)
const busy = ref(false)
const addingCost = ref(false)
const busyId = ref<number | null>(null)

async function deleteUse(useId: number) {
  busyId.value = useId
  try {
    canister.value = await useScrubbersApi().deleteUse(teamId.value, canisterId.value, useId)
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busyId.value = null
  }
}

async function deleteCost(costLineId: number) {
  busyId.value = costLineId
  try {
    canister.value = await useScrubbersApi().deleteCostLine(
      teamId.value,
      canisterId.value,
      costLineId,
    )
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busyId.value = null
  }
}

async function addCost() {
  const lines = costLinesOf(payments.value)
  if (typeof lines === 'string') {
    toast.error(lines)
    return
  }
  if (lines.length === 0) {
    toast.error('Enter the amount like 120.50.')
    return
  }
  addingCost.value = true
  try {
    for (const line of lines) {
      canister.value = await useScrubbersApi().addCostLine(teamId.value, canisterId.value, line)
    }
    payments.value = [newCostRow(team.myMemberId ?? 0)]
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    addingCost.value = false
  }
}

async function markEmpty() {
  busy.value = true
  try {
    canister.value = await useScrubbersApi().markEmpty(teamId.value, canisterId.value)
    confirmEmpty.value = false
    toast.success('Marked as empty; the price is now final.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

async function reopen() {
  busy.value = true
  try {
    canister.value = await useScrubbersApi().reopen(teamId.value, canisterId.value)
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

void reload()
</script>
