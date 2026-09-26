<script lang="ts">
	import { defaultProfileSelection, getPinnableModels, getPinnedModelLabel, getProfileBadges, getSelectableProfiles, pinnedSelection, profileSelection } from "$lib/model-profiles"
	import type { AppConfig } from "$lib/types/app-config"
	import type { AuthenticatedPrincipal } from "$lib/types/authentication"
	import type { ChatConfig } from "$lib/types/chat"
	import { type ClientModelProfile, DEFAULT_PROJECT_ID } from "$lib/types/model-profiles"

	type Props = {
		config: ChatConfig
		appConfig: AppConfig
		user: AuthenticatedPrincipal
	}

	let { config = $bindable(), appConfig, user }: Props = $props()

	const isAdmin = $derived(user.roles.includes(appConfig.APP_ROLES.ADMIN))
	const profiles = $derived(getSelectableProfiles(appConfig.MODEL_PROFILES, user, appConfig.APP_ROLES, config.profile))
	const pinnableModels = $derived(getPinnableModels(appConfig))

	// A pinned assistant is locked for anyone but an admin - the radios must be disabled (not just
	// dimmed) and config.pinned must never be touched from this path, or saving returns 403.
	const lockedForNonAdmin = $derived(Boolean(config.pinned) && !config.pinned?.legacy && !isAdmin)

	// config.profile can point at a profile whose vendor is disabled in this deployment - it's then
	// absent from `profiles` entirely (APP_CONFIG.MODEL_PROFILES only ships enabled-vendor profiles).
	// Never auto-select a replacement here - that would silently change the stored profile on save.
	const profileUnavailable = $derived(Boolean(config.profile) && !config.pinned && !profiles.some((p) => p.id === config.profile))

	const selectProfile = (profile: ClientModelProfile) => {
		if (lockedForNonAdmin) {
			return
		}
		Object.assign(config, profileSelection(profile))
		delete config.pinned
	}

	const pinModel = (modelKey: string, project: string) => {
		const selection = pinnedSelection(appConfig, modelKey, project)
		if (selection) {
			Object.assign(config, selection)
		}
	}

	const resetPin = () => {
		delete config.pinned
		const profile = profiles.find((p) => p.id === config.profile)
		if (profile) {
			selectProfile(profile)
			return
		}
		// The assistant's profile isn't offered here (its vendor is disabled) - keep it rather than silently
		// switching vendor; the server resolves it (and fails closed for a dataLocation profile)
		if (config.profile) {
			return
		}
		const fallback = defaultProfileSelection(appConfig, "ASSISTANT")
		if (fallback) {
			Object.assign(config, fallback)
		}
	}
</script>

<div class="profile-picker">
	<span class="picker-label" id="profile-picker-label">Hvilken type modell trenger assistenten?</span>
	<div class="profile-list" class:dimmed={Boolean(config.pinned)} role="radiogroup" aria-labelledby="profile-picker-label">
		{#each profiles as profile (profile.id)}
			<label class="profile-item" class:selected={!config.pinned && config.profile === profile.id} class:disabled={lockedForNonAdmin}>
				<input
					type="radio"
					name="model-profile"
					value={profile.id}
					checked={!config.pinned && config.profile === profile.id}
					disabled={lockedForNonAdmin}
					onchange={() => selectProfile(profile)}
				/>
				<span class="profile-title">{profile.icon} {profile.label}</span>
				<span class="profile-description">{profile.description}</span>
				<span class="profile-badges">
					{#each getProfileBadges(profile) as badge}
						<span class="badge" class:location={badge.kind === "location"} title={badge.label}>{badge.icon} {badge.label}</span>
					{/each}
				</span>
			</label>
		{/each}
	</div>

	{#if lockedForNonAdmin}
		<div class="picker-note">Denne assistenten er låst til en bestemt modell av en administrator.</div>
	{:else if config.pinned?.legacy}
		<div class="picker-note">
			Denne assistenten bruker avdelingens egen API-nøkkel (prosjekt {config.pinned.project}). Velger du en profil, går den over til standardnøkkelen.
		</div>
	{/if}

	{#if profileUnavailable}
		<div class="picker-note">Den valgte profilen er ikke tilgjengelig i dette miljøet.</div>
	{/if}

	{#if isAdmin}
		<details class="advanced" open={Boolean(config.pinned)}>
			<summary>Avansert</summary>
			<div class="advanced-row">
				<div class="advanced-item">
					<label for="pinned-model">Lås til modell</label>
					<select
						id="pinned-model"
						value={config.pinned?.model ?? ""}
						onchange={(e) => {
							const modelKey = e.currentTarget.value
							if (modelKey) {
								pinModel(modelKey, config.pinned?.project ?? DEFAULT_PROJECT_ID)
							} else {
								resetPin()
							}
						}}
					>
						<option value="">Følg profil</option>
						{#each pinnableModels as group (group.vendorId)}
							<optgroup label={group.vendorName}>
								{#each group.models as model (model.KEY)}
									<option value={model.KEY}>{model.ID}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				{#if config.pinned}
					<div class="advanced-item">
						<label for="pinned-project">Prosjekt</label>
						<select id="pinned-project" value={config.pinned.project} onchange={(e) => pinModel(config.pinned?.model ?? "", e.currentTarget.value)}>
							{#each appConfig.VENDORS[config.vendorId].PROJECTS as project}
								<option value={project}>{project}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
			{#if config.pinned}
				<div class="pinned-note">
					<span>📌 Assistenten er låst til <b>{getPinnedModelLabel(config.pinned, appConfig)}</b> og følger ikke profilendringer.</span>
					<button type="button" class="link-button" onclick={resetPin}>Tilbakestill til profil</button>
				</div>
			{/if}
		</details>
	{/if}
</div>

<style>
	.profile-picker {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.picker-label,
	.advanced-item label {
		color: var(--color-primary);
		font-size: small;
		padding-bottom: 0.5rem;
	}
	.profile-list {
		border: 1px solid var(--color-primary-20);
		border-radius: 10px;
		overflow: hidden;
	}
	.profile-list.dimmed {
		opacity: 0.45;
	}
	.profile-item {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.6rem 0.9rem;
		border-bottom: 1px solid var(--color-primary-10);
		cursor: pointer;
	}
	.profile-item:last-child {
		border-bottom: none;
	}
	.profile-item:hover {
		background-color: var(--color-primary-10);
	}
	.profile-item.selected {
		background-color: var(--color-primary-10);
		box-shadow: inset 3px 0 0 var(--color-primary);
	}
	.profile-item.disabled {
		cursor: default;
	}
	.profile-title {
		font-weight: 700;
		width: 8rem;
		flex-shrink: 0;
	}
	.profile-description {
		flex: 1;
		font-size: 0.85rem;
	}
	.profile-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		justify-content: flex-end;
	}
	.badge {
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background-color: var(--color-secondary-10);
		white-space: nowrap;
	}
	.badge.location {
		background-color: var(--color-primary-10);
		color: var(--color-primary);
	}
	.picker-note {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-primary-80);
	}
	.advanced {
		margin-top: 0.9rem;
		border: 1px dashed var(--color-primary-30);
		border-radius: 8px;
		padding: 0.5rem 0.8rem;
	}
	.advanced summary {
		cursor: pointer;
		color: var(--color-primary);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.advanced-row {
		display: flex;
		gap: 1rem;
		margin-top: 0.7rem;
	}
	.advanced-item {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.advanced-item select {
		font-family: var(--font-family);
		font-size: inherit;
		padding: 0.25rem;
		border: none;
		background-color: inherit;
	}
	.pinned-note {
		margin-top: 0.6rem;
		font-size: 0.8rem;
		background-color: var(--color-secondary-10);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.link-button {
		background: none;
		border: none;
		color: var(--color-primary);
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
	}
	@media (max-width: 700px) {
		.profile-item {
			flex-wrap: wrap;
		}
		.profile-badges {
			justify-content: flex-start;
		}
	}
</style>
