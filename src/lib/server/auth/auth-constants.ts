import type { MSPrincipalClaimTyp } from "$lib/types/authentication"

export const MS_AUTH_PRINCIPAL_CLAIMS_HEADER = "x-ms-client-principal"
export const MS_AUTH_PRINCIPAL_NAME_HEADER = "x-ms-client-principal-name"
export const MS_AUTH_PRINCIPAL_ID_HEADER = "x-ms-client-principal-id"
export const MS_AUTH_PRINCIPAL_IDP_HEADER = "x-ms-client-principal-idp"

export const MS_PRINCIPAL_CLAIM_TYPS: MSPrincipalClaimTyp[] = [
  "aud",
  "iss",
  "iat",
  "nbf",
  "exp",
  "aio",
  "c_hash",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "groups",
  "nonce",
  "http://schemas.microsoft.com/identity/claims/objectidentifier",
  "preferred_username",
  "name",
  "roles",
  "rh",
  "sid",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  "http://schemas.microsoft.com/identity/claims/tenantid",
  "uti",
  "ver",
  "cc"
]
