import { useApi } from '@/composables/useApi'
import type {
  AddMemberRequest,
  InviteLink,
  InvitePreview,
  Member,
  Team,
  TeamInput,
  UpdateMemberRequest,
} from './types'

/** API.md §1 (teams) and §2 (members). */
export function useTeamsApi() {
  const { getWithToken, postWithToken, putWithToken, deleteWithToken } = useApi()
  const team = (teamId: number) => `/v1/teams/${teamId}`
  return {
    createTeam: async (input: TeamInput) => (await postWithToken<Team>('/v1/teams', input)).data,
    getTeam: async (teamId: number) => (await getWithToken<Team>(team(teamId))).data,
    updateTeam: async (teamId: number, input: TeamInput) =>
      (await putWithToken<Team>(team(teamId), input)).data,
    members: async (teamId: number) =>
      (await getWithToken<Member[]>(`${team(teamId)}/members`)).data,
    addMember: async (teamId: number, request: AddMemberRequest) =>
      (await postWithToken<Member>(`${team(teamId)}/members`, request)).data,
    inviteLink: async (teamId: number) =>
      (await getWithToken<InviteLink>(`${team(teamId)}/invite-link`)).data,
    resetInviteLink: async (teamId: number) =>
      (await postWithToken<InviteLink>(`${team(teamId)}/invite-link`)).data,
    turnOffInviteLink: async (teamId: number) =>
      (await deleteWithToken<InviteLink>(`${team(teamId)}/invite-link`)).data,
    previewInvite: async (token: string) =>
      (await getWithToken<InvitePreview>(`/v1/invites/${encodeURIComponent(token)}`)).data,
    joinByInvite: async (token: string) =>
      (await postWithToken<InvitePreview>(`/v1/invites/${encodeURIComponent(token)}/join`)).data,
    updateMember: async (teamId: number, memberId: number, request: UpdateMemberRequest) =>
      (await putWithToken<Member>(`${team(teamId)}/members/${memberId}`, request)).data,
    leave: async (teamId: number) => {
      await postWithToken(`${team(teamId)}/members/me/leave`)
    },
  }
}
