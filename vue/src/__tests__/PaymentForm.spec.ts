import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PaymentForm from '@/components/money/PaymentForm.vue'
import type { Member } from '@/lib/api/types'

const member = (memberId: number, displayName: string): Member =>
  ({ memberId, displayName, status: 'ACTIVE', role: 'MEMBER' }) as Member

const team = [member(1, 'Dana'), member(2, 'Alice'), member(3, 'Bob')]

const mountForm = (members: Member[] = team) =>
  mount(PaymentForm, { props: { members, currency: 'CHF', myMemberId: 1 } })

const optionIds = (wrapper: ReturnType<typeof mountForm>, id: string) =>
  wrapper.findAll<HTMLOptionElement>(`#${id} option`).map((option) => Number(option.element.value))
const selected = (wrapper: ReturnType<typeof mountForm>, id: string) =>
  Number(wrapper.find<HTMLSelectElement>(`#${id}`).element.value)

describe('PaymentForm', () => {
  it('never offers the payer as recipient', () => {
    const wrapper = mountForm()

    expect(optionIds(wrapper, 'payment-from')).toEqual([1, 2, 3])
    expect(optionIds(wrapper, 'payment-to')).toEqual([2, 3])
    expect(selected(wrapper, 'payment-to')).toBe(2)
  })

  it('updates the recipients when the payer changes', async () => {
    const wrapper = mountForm()

    await wrapper.find('#payment-from').setValue(3)

    expect(optionIds(wrapper, 'payment-to')).toEqual([1, 2])
    expect(selected(wrapper, 'payment-to')).toBe(2)
  })

  it('moves the recipient on when it becomes the payer, and sends valid people', async () => {
    const wrapper = mountForm()

    await wrapper.find('#payment-from').setValue(2)
    await flushPromises()

    expect(optionIds(wrapper, 'payment-to')).toEqual([1, 3])
    expect(selected(wrapper, 'payment-to')).toBe(1)

    await wrapper.find('#payment-amount').setValue('12.50')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      fromMemberId: 2,
      toMemberId: 1,
      amount: '12.50',
    })
  })

  it('sends nothing in a team of one', async () => {
    const wrapper = mountForm([member(1, 'Dana')])

    expect(optionIds(wrapper, 'payment-to')).toEqual([])
    await wrapper.find('#payment-amount').setValue('5')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
