import { PublicClientApplication } from '@azure/msal-browser'

/**
 * @type {import('@azure/msal-browser').Configuration}
 */
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID ?? 'klientID',
    authority: import.meta.env.VITE_CLIENT_ISS ?? 'autiruireuir',
    redirectUri: import.meta.env.VITE_REDIRECT_URI ?? 'uriSomewhere',
    navigateToLoginRequestUrl: false // Vi redirecter selv etter succesful login - MSAL klarer det særdeles dårlig...
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
    storeAuthStateInCookie: false // Set this to "true" if you are having issues on IE11 or Edge
  }
}

let msalClient = null // Vi prøver å beholde den i minne for moro skyld, slik at getMsalClient bruker den om den finnes

/**
 *
 * @returns {import('@azure/msal-browser').PublicClientApplication} msalClient
 */
export const getMsalClient = async () => {
  if (!msalClient) msalClient = await PublicClientApplication.createPublicClientApplication(msalConfig)
  if (msalClient.getActiveAccount()) return msalClient
  const accounts = msalClient.getAllAccounts()
  if (accounts.length === 1) {
    msalClient.setActiveAccount(accounts[0])
    return msalClient
  }
  if (accounts.length > 1) {
    console.log('WOAHWOAHWOAH, flere enn en active bruker i MSAL HER! Åpne en ny fane a...')
    msalClient.setActiveAccount(accounts[0])
  }
  return msalClient
}

/**
 * @typedef LoginResponse
 * @property { import('@azure/msal-browser').AccountInfo } account
 * @property { string } loginRequestUrl
 */

/**
 * @param {boolean} [forceLogin=false]
 * @param {boolean} [loginRequestUrl='/'] Hvilken path logget brukeren inn fra
 * @returns { Promise<LoginResponse> } loginResponse
 */
export const login = async (forceLogin = false, loginRequestUrl = '/') => {
  // if (import.meta.env.VITE_MOCK_MSAL === 'true') return { account: { username: 'demospøkelse@domene.no', name: 'Demo Spøkelse' }, loginRequestUrl }
  const msalClient = await getMsalClient()

  const loginResponse = await msalClient.handleRedirectPromise()

  if (loginResponse && !forceLogin) {
    msalClient.setActiveAccount(loginResponse.account)
    return { account: loginResponse.account, loginRequestUrl: loginResponse.state }
  } else {
    if (msalClient.getActiveAccount() && !forceLogin) { // Dette steget er vel kanskje ikke nødvendig...
      return { account: msalClient.getActiveAccount(), loginRequestUrl }
    }
    msalClient.loginRedirect({ scopes: ['User.Read'], state: loginRequestUrl }) // Vi logger inn og slenger inn url der det logges på til state - slik at denne kommer med i loginResponse når det redirectes
  }
}

export const logout = async () => {
  const msalClient = await getMsalClient()
  const currentAccounts = msalClient.getAllAccounts()
  if (currentAccounts.length === 0) return null
  const currentAccount = currentAccounts[0]
  await msalClient.logoutRedirect({
    account: currentAccount,
    postLogoutRedirectUri: import.meta.env.VITE_LOGOUT_URI
  })
}
