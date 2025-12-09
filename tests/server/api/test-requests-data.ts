import { env } from "$env/dynamic/private";
import type { MSPrincipalClaims, MSUserClaim } from "$lib/types/authentication";
import type { RequestEvent } from "@sveltejs/kit";

export type TestRequestEvent = Omit<RequestEvent, 'cookies' | 'locals' | 'platform' | 'fetch' | 'getClientAddress' | 'route' | 'setHeaders' | 'url' | 'isDataRequest' | 'isSubRequest' | 'tracing' | 'isRemoteRequest'>

const createTestUserMSHeader = ({ oid, name, username, roles, groups }: { oid: string; name: string; username: string; roles: string[]; groups: string[] }): string => {
  const userClaims: MSPrincipalClaims = {
    auth_typ: "aad",
    claims: [
      {
        typ: "name",
        val: name
      },
      {
        typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
        val: oid
      },
      {
        typ: "preferred_username",
        val: username // The primary username that represents the user
      },
      ...roles.map((role) => ({
        typ: "roles",
        val: role
      })) as MSUserClaim[],
      ...groups.map((group) => ({
        typ: "groups",
        val: group
      })) as MSUserClaim[]
    ],
    name_typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    role_typ: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
  }
  return Buffer.from(JSON.stringify(userClaims), "utf-8").toString("base64");
}

const testEmployee = createTestUserMSHeader({
  oid: "user-oid-1234",
  name: "Regular User",
  username: "regular.user@example.com",
  roles: [env.APP_ROLE_EMPLOYEE],
  groups: ["test-agent-2-group", "test-agent-3-group"]
})

const testAdmin = createTestUserMSHeader({
  oid: "admin-oid-5678",
  name: "Admin User",
  username: "admin.user@example.com",
  roles: [env.APP_ROLE_ADMIN],
  groups: ["some-admin-group"]
})

export const TEST_USER_MS_HEADERS = {
  employee: testEmployee,
  admin: testAdmin
}