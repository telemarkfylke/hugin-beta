locals {
  MUGIN_DISPLAY_NAME = "Hugin BETA"
  MUGIN_ENVIRONMENT_NAME = var.ENVIRONMENT == "dev" ? "test" : "prod"
  MUGIN_WEBAPP_URL = var.ENVIRONMENT == "dev" ? "https://hugin-test.telemarkfylke.no" : "https://hugin.telemarkfylke.no"
  TALE_TIL_NOTAT_CLIENT_ID = var.ENVIRONMENT == "dev" ? "f8683024-16e2-4055-8bdc-a6cfc44d5d23" : "18fbb753-ab57-43b6-897c-ace7410a5626"
  MUGIN_EMPLOYEE_ROLE = "Hugin.Employee"
  MUGIN_STUDENT_ROLE = "Hugin.Student"
  MUGIN_EDU_EMPLOYEE_ROLE = "Hugin.EduEmployee"
  MUGIN_ADMIN_ROLE = "Hugin.Admin"
  MUGIN_AGENT_MAINTAINER_ROLE = "Hugin.AgentMaintainer"
  MUGIN_CALLBACK_ROLE = "Hugin.Callback"
}

# Resource group for the function app
resource "azurerm_resource_group" "mugin2_web" {
  name     = "mugin2-web"
  location = "norwayeast"
}

# Random uuids
resource "random_uuid" "oauth2_user_impersonation_id_mugin2" {}
resource "random_uuid" "oauth2_employee_role_id_mugin2" {}
resource "random_uuid" "oauth2_student_role_id_mugin2" {}
resource "random_uuid" "oauth2_edu_employee_role_id_mugin2" {}
resource "random_uuid" "oauth2_admin_role_id_mugin2" {}
resource "random_uuid" "oauth2_agent_maintainer_role_id_mugin2" {}
resource "random_uuid" "oauth2_agent_callback_role_id_mugin2" {}

# App registration representing the frontend web app
resource "azuread_application" "mugin2_web_frontend" {
  display_name = "${local.MUGIN_DISPLAY_NAME} WEB (Frontend) - ${local.MUGIN_ENVIRONMENT_NAME}"
  description = "App registration representing ${local.MUGIN_DISPLAY_NAME} frontend WEB ${local.MUGIN_ENVIRONMENT_NAME}"
  owners = [data.azuread_client_config.current.object_id] # To make sure permission Application.ReadWrite.OwnedBy should work. (Might need User.Read.All as well..)
  
  identifier_uris = [local.MUGIN_WEBAPP_URL] # Must be globally unique (does it really?)

  api {
    oauth2_permission_scope {
      admin_consent_description  = "Allow the application to access api on behalf of the signed-in user."
      admin_consent_display_name = "User impersonation"
      enabled                    = true
      id                         = random_uuid.oauth2_user_impersonation_id_mugin2.result
      type                       = "User"
      user_consent_description   = "Allow the application to access api on your behalf."
      user_consent_display_name  = "User impersonation"
      value                      = "user_impersonation"
    }
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Vanlig ansatt-bruker"
    display_name         = "Ansatt"
    enabled              = true
    id                   = random_uuid.oauth2_employee_role_id_mugin2.result
    value                = local.MUGIN_EMPLOYEE_ROLE
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Vanlig elev-bruker"
    display_name         = "Elev"
    enabled              = true
    id                   = random_uuid.oauth2_student_role_id_mugin2.result
    value                = local.MUGIN_STUDENT_ROLE
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Vanlig skole-ansatt"
    display_name         = "Skole-ansatt"
    enabled              = true
    id                   = random_uuid.oauth2_edu_employee_role_id_mugin2.result
    value                = local.MUGIN_EDU_EMPLOYEE_ROLE
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Administrator"
    display_name         = "Administrator"
    enabled              = true
    id                   = random_uuid.oauth2_admin_role_id_mugin2.result
    value                = local.MUGIN_ADMIN_ROLE
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Kan vedlikeholde og publisere agenter"
    display_name         = "Agent-utvikler"
    enabled              = true
    id                   = random_uuid.oauth2_agent_maintainer_role_id_mugin2.result
    value                = local.MUGIN_AGENT_MAINTAINER_ROLE
  }

    app_role {
    allowed_member_types = ["Application"]
    description          = "Callback-rettighet for eksterne APIer"
    display_name         = "Callback"
    enabled              = true
    id                   = random_uuid.oauth2_agent_callback_role_id_mugin2.result
    value                = local.MUGIN_CALLBACK_ROLE
  }

  web {
    homepage_url  = local.MUGIN_WEBAPP_URL
    redirect_uris = ["${local.MUGIN_WEBAPP_URL}/.auth/login/aad/callback"]

    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = true
    }
  }

  feature_tags {
    enterprise = true # Not sure if needed, but we use it here
  }

  group_membership_claims = [ "ApplicationGroup" ] # If you need group membership included in the token
  prevent_duplicate_names = true # Check for application registration with the same display name
  sign_in_audience = "AzureADMyOrg" # Only my entra id allowed access to the app

  lifecycle {
    ignore_changes = [ required_resource_access ] # Vi venter litt i første omgang med å sette disse med id-er. Dette er altså API permissions, settes manuelt per nå.
  }
}

# Enterprise application for frontend
resource "azuread_service_principal" "mugin2_web_frontend" {
  client_id = azuread_application.mugin2_web_frontend.client_id
  app_role_assignment_required = true # No one can simply use it without specified access
  owners                       = [data.azuread_client_config.current.object_id]
  description = "Enterprise application for ${local.MUGIN_DISPLAY_NAME} frontend WEB ${local.MUGIN_ENVIRONMENT_NAME}"

  feature_tags {
    enterprise = true
  }
}

# Client secret for the application (for azure ad auth)
resource "time_rotating" "mugin2_web_authentication_secret_rotation" {
  rotation_days = 30
}
resource "azuread_application_password" "mugin2_web_auth_secret" {
  display_name = "Generated for built in authentication"
  application_id = azuread_application.mugin2_web_frontend.id
  
  rotate_when_changed = {
    rotation = time_rotating.mugin2_web_authentication_secret_rotation.id
  }
}

# App registration representing the frontend web app
resource "azuread_application" "mugin2_web_backend" {
  display_name = "${local.MUGIN_DISPLAY_NAME} (Backend) - ${local.MUGIN_ENVIRONMENT_NAME}"
  description = "App registration representing ${local.MUGIN_DISPLAY_NAME} backend WEB ${local.MUGIN_ENVIRONMENT_NAME}"
  owners = [data.azuread_client_config.current.object_id] # To make sure permission Application.ReadWrite.OwnedBy should work. (Might need User.Read.All as well..)
  
  feature_tags {
    enterprise = true # Not sure if needed, but we use it here
  }

  prevent_duplicate_names = true # Check for application registration with the same display name
  sign_in_audience = "AzureADMyOrg" # Only my entra id allowed access to the app

  lifecycle {
    ignore_changes = [ required_resource_access ] # Vi venter litt i første omgang med å sette disse med id-er. Dette er altså API permissions, settes manuelt per nå.
  }
}

# Enterprise application for backend
resource "azuread_service_principal" "mugin2_web_backend" {
  client_id = azuread_application.mugin2_web_backend.client_id
  app_role_assignment_required = true # No one can simply use it without specified access
  owners                       = [data.azuread_client_config.current.object_id]
  description = "Enterprise application for ${local.MUGIN_DISPLAY_NAME} backend WEB ${local.MUGIN_ENVIRONMENT_NAME}"

  feature_tags {
    enterprise = true
    hide = true
  }
}

# Client secret for the accessing internal apis
resource "time_rotating" "mugin2_web_api_access_secret_rotation" {
  rotation_days = 30
}
resource "azuread_application_password" "mugin2_web_api_access_secret" {
  display_name = "Generated for internal API requests"
  application_id = azuread_application.mugin2_web_backend.id

  rotate_when_changed = {
    rotation = time_rotating.mugin2_web_api_access_secret_rotation.id
  }
}


# App service plan for function app
# Uses common app service plan for LZ

# Function app using the above storage account
resource "azurerm_linux_web_app" "mugin2_web" {
  name                = "${var.RESOURCE_NAMING_PREFIX}mugin2web"
  resource_group_name = azurerm_resource_group.mugin2_web.name
  location            = azurerm_resource_group.mugin2_web.location

  service_plan_id               = azurerm_service_plan.app_service_plan_linux_1.id # Common app service plan for LZ

  # Networking
  virtual_network_subnet_id     = azurerm_subnet.webfunc.id # App function vnet-integration goes into webfunc subnet (delegated to Microsoft serverfarms)
  https_only                    = true
  public_network_access_enabled = false
  
  # Web app settings
  site_config {
    vnet_route_all_enabled = true # Route all outbound traffic onto the vnet (internet access must be allowed in firewall)
    application_stack {
      node_version = "22-lts"
    }
    always_on = true # Don't want cold start
    app_command_line = "ORIGIN=${local.MUGIN_WEBAPP_URL} node /home/site/wwwroot/build/" # SvelteKit specific - don't know if this actually uses PM2, but hopefully it does. Need to set ORIGIN as well, for it to work with crsf
  }

  # Authentication
  auth_settings_v2 {
    auth_enabled = true
    require_authentication = true
    unauthenticated_action = "RedirectToLoginPage" // "Return401" for apis, "RedirectToLoginPage" for web apps
    default_provider = "azureactivedirectory"
    forward_proxy_convention = "Custom" # We are using Application gateway as a reverse proxy, so we need this to make App service use X-Original-Host when handling authentication (https://learn.microsoft.com/en-us/azure/app-service/overview-app-gateway-integration#authentication)
    forward_proxy_custom_host_header_name = "X-Original-Host"

    # excluded_paths = Her kan vi legge paths vi ikke vil ha auth på :P
    active_directory_v2 {
      client_id = azuread_application.mugin2_web_frontend.client_id # Use app registration client id for the function app
      tenant_auth_endpoint = "https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0"
      client_secret_setting_name = "APP_REG_AUTH_CLIENT_SECRET"
      allowed_audiences = [ local.MUGIN_WEBAPP_URL ] # MUST MATCH identifier_uris in app registration
      allowed_applications = [ azuread_application.mugin2_web_frontend.client_id, local.TALE_TIL_NOTAT_CLIENT_ID ]
    }

    login {
      # cookie_expiration_time = "08:00:00"
      token_store_enabled = true
    }
  }
  
  # App settings
  app_settings = {
    # "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true" # If you want zip-deploy to do build
    # "deployment_branch" = "main" # If you want to use kudu-api /deploy from a github repo, set to branch name to deploy from
    "APP_REG_AUTH_CLIENT_SECRET" = azuread_application_password.mugin2_web_auth_secret.value # Used for entra id auth on the function
    "APPREG_CLIENT_ID" = azuread_application.mugin2_web_backend.client_id
    "APPREG_CLIENT_SECRET" = azuread_application_password.mugin2_web_api_access_secret.value
    "APPREG_TENANT_ID" = data.azurerm_client_config.current.tenant_id
    "APP_ROLE_EMPLOYEE" = local.MUGIN_EMPLOYEE_ROLE
    "APP_ROLE_STUDENT" = local.MUGIN_STUDENT_ROLE
    "APP_ROLE_EDU_EMPLOYEE" = local.MUGIN_EDU_EMPLOYEE_ROLE
    "APP_ROLE_ADMIN" = local.MUGIN_ADMIN_ROLE
    "APP_ROLE_AGENT_MAINTAINER" = local.MUGIN_AGENT_MAINTAINER_ROLE
    "APP_ROLE_CALLBACK" = local.MUGIN_CALLBACK_ROLE
    "FRONTEND_APP_ID" = azuread_application.mugin2_web_frontend.client_id
  }

  lifecycle {
    ignore_changes = [
      app_settings["SETTING_YOU_WANT_TO_CONTROL_IN_AZURE"], # prevent terraform from overwriting / deleting this app setting
      app_settings["BETTERSTACK_URL"],
      app_settings["BETTERSTACK_TOKEN"],
      app_settings["BETTERSTACK_MIN_LOG_LEVEL"],
      app_settings["CONSOLE_ENABLED"],
      app_settings["CONSOLE_MIN_LOG_LEVEL"],
      app_settings["TEAMS_WEBHOOK_URL"],
      app_settings["TEAMS_MIN_LOG_LEVEL"],
      app_settings["TEAMS_LINKS"],
      app_settings["NODE_ENV"],
      app_settings["MOCK_DB"],
      app_settings["MONGODB_CONNECTION_STRING"],
      app_settings["MONGODB_DB_NAME"],
      app_settings["DEFAULT_AGENT_ID"],
      app_settings["OPENAI_API_KEY_PROJECT_DEFAULT"],
      app_settings["OPENAI_API_KEY_PROJECT_KOLLEKTIV"],
      app_settings["OPENAI_API_KEY_PROJECT_SKOLE"],
      app_settings["OPENAI_API_KEY_PROJECT_ORGANISASJON"],
      app_settings["OPENAI_API_KEY_PROJECT_SKOLELABS"],
      app_settings["OPENAI_API_KEY_PROJECT_PLANBYGG"],
      app_settings["OPENAI_API_KEY_PROJECT_VEGUTBYGGING"],
      app_settings["MISTRAL_API_KEY_PROJECT_DEFAULT"],
      app_settings["BODY_SIZE_LIMIT"],
      app_settings["APP_NAME"],
      app_settings["OLLAMA_HOST"],
      app_settings["CONVERSATION_EXPORT_DISABLED"],
			app_settings["AI_API_URI"], //fjerne disse når nytt endepunkt er på plass
			app_settings["TRANSCRIPTION_APPREG_ID"], //fjerne disse når nytt endepunkt er på plass
			app_settings["TRANSCRIPTION_APPREG_KEY"],//fjerne disse når nytt endepunkt er på plass
			app_settings["APPREG_TENANT_ID"], //denne ligger allerede inne, ta med i cleanup push
			app_settings["TRANSCRIPTION_SCOPES"],//fjerne disse når nytt endepunkt er på plass
      app_settings["COPYPARTY_BASE_URL"], 
      app_settings["TALE_TIL_NOTAT_URL"], 
      app_settings["TRANSCRIPTION_CALLBACK_SECRET"], 
      app_settings["LITELLM_BASE_URL"],
      app_settings["TRANSCRIPTION_GROUP_1_ID"],
      app_settings["TRANSCRIPTION_GROUP_2_ID"],
      app_settings["TRANSCRIPTION_GROUP_3_ID"],
      app_settings["TRANSCRIPTION_GROUP_1_LABEL"],
      app_settings["TRANSCRIPTION_GROUP_2_LABEL"],
      app_settings["TRANSCRIPTION_GROUP_3_LABEL"],
      app_settings["CANVAS_ENABLED"],

			app_settings["RAGSERVICE_URL"],
			app_settings["RAGSERVICE_SCOPE"],
			app_settings["ENTRA_TENANT_ID"],
			app_settings["ENTRA_CLIENT_ID"],
			app_settings["ENTRA_CLIENT_SECRET"]
    ]
  }
}

resource "azapi_update_resource" "web_app_auth_login_params" {
  type        = "Microsoft.Web/sites/config@2022-09-01"
  resource_id = "${azurerm_linux_web_app.mugin2_web.id}/config/authsettingsV2"

  body = {
    properties = {
      login = {
        loginParameters = [
          "scope=openid offline_access ${local.MUGIN_WEBAPP_URL}/user_impersonation"
        ]
      }
    }
  }
}


# Azure function private endpoint, used by application gateway for publishing
resource "azurerm_private_endpoint" "mugin2_web_endpoint" {
  name                = "${var.RESOURCE_NAMING_PREFIX}mugin2web"
  resource_group_name = azurerm_resource_group.mugin2_web.name
  location            = azurerm_resource_group.mugin2_web.location
  subnet_id           = azurerm_subnet.default.id
  private_service_connection {
    name                           = "${var.RESOURCE_NAMING_PREFIX}mugin2web"
    private_connection_resource_id = azurerm_linux_web_app.mugin2_web.id
    is_manual_connection           = false
    subresource_names              = ["sites"]
  }
  lifecycle {
    ignore_changes = [
      private_dns_zone_group # This is set automatically in azure - so we don't want terraform to mess with it
    ]
  }
}
