<script lang="ts">
	import { onMount } from "svelte"
	import { slide } from "svelte/transition"
	import { page } from "$app/state"
	import { canEditPredefinedConfig, canPublishChatConfig, canSetAnonymousEmbed, canUseRagservice } from "$lib/authorization"
	import { RagServiceApi } from "$lib/ragservice/adapters/ragserviceApi"
	import type { StoreConfig } from "$lib/ragservice/types"
	import type { ChatConfig, VendorId } from "$lib/types/chat"
	import GrowingTextArea from "../GrowingTextArea.svelte"
	import VendorModelSelector from "../VendorModelSelector.svelte"
	import ChatConfigStats from "./ChatConfigStats.svelte"
	import type { ChatState } from "./ChatState.svelte"

	type Props = {
		chatState: ChatState
	}

	let { chatState = $bindable() }: Props = $props()

	let userCanEditPredefinedConfig = $derived(canEditPredefinedConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES))
	let userCanSetAnonymousEmbed = $derived(canSetAnonymousEmbed(chatState.user, chatState.APP_CONFIG.APP_ROLES))
	let userCanUseRagservice = $derived(canUseRagservice(chatState.user, chatState.APP_CONFIG.APP_ROLES))
	let embedUrl = $derived(chatState.chat.config._id ? `${page.url.origin}/embed/agents/${chatState.chat.config._id}` : "")
	let publicEmbedUrl = $derived(chatState.chat.config._id ? `${page.url.origin}/public/embed/agents/${chatState.chat.config._id}` : "")
	// Recommended snippet - drops a floating, ready-styled chat bubble via static/widget.js, rather
	// than requiring the embedding site to build/style its own <iframe> around publicEmbedUrl.
	// The escape below is required, not defensive: the closing tag's raw text (unescaped) would
	// truncate this file's own enclosing script block at compile time, since both Svelte's and
	// Biome's script-boundary scanners work off raw text, not JS syntax.
	// biome-ignore lint/suspicious/noUselessEscapeInString: see comment above
	let publicWidgetSnippet = $derived(chatState.chat.config._id ? `<script src="${page.url.origin}/widget.js" data-agent-id="${chatState.chat.config._id}"><\/script>` : "")

	// Not reactive state, to "remember" predefined vs manual config when toggling
	let predefinedConfigCache: Partial<ChatConfig> = {
		vendorId: "MISTRAL",
		vendorAgent: { id: "" }
	}
	let manualConfigCache: Partial<ChatConfig> = {
		vendorId: "MISTRAL",
		model: "mistral-medium-latest",
		instructions: ""
	}

	const getAvailableProjects = (vendorId: VendorId) => {
		return chatState.APP_CONFIG.VENDORS[vendorId].PROJECTS
	}

	const copyAgentUrl = async () => {
		await navigator.clipboard.writeText(page.url.href)
		chatState.chat.config.shared = true
		alert("Assistentens adresse er kopiert til utklippstavlen og kan limes inn i en mail eller melding for å deles med andre.\n\nNB: Alle med lenken kan bruke assistenten.")
	}

	// Almost illegal effect, but we need to auto-select first available model when changing vendor in manual config
	$effect(() => {
		console.log("project effect ran, be careful")
		if (chatState.chat.config.vendorId) {
			const availableProjects = getAvailableProjects(chatState.chat.config.vendorId)
			if (!availableProjects.includes(chatState.chat.config.project)) {
				if (!availableProjects[0]) {
					throw new Error(`No available projects for vendor ${chatState.chat.config.vendorId}`)
				}
				chatState.chat.config.project = availableProjects[0]
			}
		}
	})

	const ragApi = new RagServiceApi()
	let availableStores: StoreConfig[] = $state([])

	onMount(async () => {
		if (userCanUseRagservice) {
			availableStores = await ragApi.getStores()
		}
	})

	function addDataSource(storeId: string) {
		if (!storeId) return
		const existing = chatState.chat.config.dataSources ?? []
		if (existing.some((s) => s.id === storeId)) return
		chatState.chat.config.dataSources = [...existing, { type: "ragservice", id: storeId }]
	}

	function removeDataSource(storeId: string) {
		chatState.chat.config.dataSources = (chatState.chat.config.dataSources ?? []).filter((s) => s.id !== storeId)
	}

	// Categories drive write-time question statistics (see $lib/statsstore/types) - every incoming user
	// question gets classified into one of these by a utility model, purely for anonymous, aggregate
	// counts. Kept as free-text, author-defined labels rather than a fixed taxonomy.
	let newCategoryInput = $state("")

	function addCategory() {
		const trimmed = newCategoryInput.trim()
		if (!trimmed) return
		const existing = chatState.chat.config.categories ?? []
		if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return
		chatState.chat.config.categories = [...existing, trimmed]
		newCategoryInput = ""
	}

	function removeCategory(category: string) {
		chatState.chat.config.categories = (chatState.chat.config.categories ?? []).filter((c) => c !== category)
	}

	let activeTab: "settings" | "stats" = $state("settings")

	const onConfigTypeChange = (event: Event) => {
		const target = event.target as HTMLInputElement
		if (target.value === "predefined") {
			manualConfigCache = {
				vendorId: chatState.chat.config.vendorId,
				project: chatState.chat.config.project,
				model: chatState.chat.config.model,
				instructions: chatState.chat.config.instructions
			}
			chatState.chat.config.vendorId = predefinedConfigCache.vendorId as VendorId
			chatState.chat.config.project = predefinedConfigCache.project as string
			chatState.chat.config.vendorAgent = predefinedConfigCache.vendorAgent
			delete chatState.chat.config.model
			delete chatState.chat.config.instructions
		} else {
			predefinedConfigCache = {
				vendorId: chatState.chat.config.vendorId,
				project: chatState.chat.config.project,
				vendorAgent: { id: chatState.chat.config.vendorAgent?.id || "" }
			}
			chatState.chat.config.vendorId = manualConfigCache.vendorId as VendorId
			chatState.chat.config.project = manualConfigCache.project as string
			chatState.chat.config.model = manualConfigCache.model as string
			chatState.chat.config.instructions = manualConfigCache.instructions as string
			delete chatState.chat.config.vendorAgent
		}
	}
</script>

{#if chatState.configMode}
	<div class="chat-config-container" transition:slide={{ duration: 200 }}>
		<div class="config-tabs">
			<button class="config-tab-button" disabled={activeTab === "settings"} onclick={() => { activeTab = "settings" }}>Innstillinger</button>
			<button class="config-tab-button" disabled={activeTab === "stats"} onclick={() => { activeTab = "stats" }}>Statistikk</button>
		</div>

		<div class="chat-config">
			{#if activeTab === "settings"}
				<!-- Name -->
				<div class="config-section">
					<div class="config-item">
						<label for="agent-name">Navn</label>
						<textarea
							class="name-input"
							id="agent-name"
							rows="1"
							placeholder="Gi assistenten et navn"
							bind:value={chatState.chat.config.name}
							onkeydown={(e) => { if (e.key === "Enter") e.preventDefault() }}
						></textarea>
					</div>
				</div>

				<!-- Description -->
				<div class="config-section">
					<div class="config-item">
						<label for="description">Beskrivelse av assistent</label>
						<GrowingTextArea id="description" style="textarea" initialRows={1} placeholder="Skriv en beskrivelse av assistenten her" bind:value={chatState.chat.config.description} />
					</div>
				</div>

				<!-- Sharing -->
				<div class="config-section">
					<div class="share-row">
						<label class="toggle-label">
							<span>Del assistent</span>
							<span class="toggle">
								<input type="checkbox" bind:checked={chatState.chat.config.shared} />
								<span class="toggle-track"></span>
							</span>
						</label>
						<button class="icon-button" disabled={!chatState.chat.config.shared || !chatState.chat.config._id} onclick={copyAgentUrl} title="Kopier lenke">
							<span class="material-symbols-outlined">content_copy</span>
						</button>
					</div>
					<div class="share-description">
						Ved å dele din assistent kan de som har lenken bruke den, men den blir ikke listet opp noe sted.
					</div>
				</div>

				<!-- Embed link (chrome-less, but still requires login + normal access rules) -->
				{#if chatState.chat.config._id}
					<div class="config-section">
						<div class="share-row">
							<span>Embed-lenke (for iframe på interne sider)</span>
							<button class="icon-button" onclick={() => navigator.clipboard.writeText(embedUrl)} title="Kopier embed-lenke">
								<span class="material-symbols-outlined">content_copy</span>
							</button>
						</div>
						<div class="share-description">
							Chrome-løst chatvindu uten meny/header. Krever fortsatt innlogging og de samme tilgangsreglene som selve assistenten.
						</div>
					</div>
				{/if}

				<!-- Anonymous embed - independent of type/shared, admin-only -->
				{#if userCanSetAnonymousEmbed}
					<div class="config-section">
						<div class="share-row">
							<label class="toggle-label">
								<span>Tillat anonym embedding (ingen innlogging)</span>
								<span class="toggle">
									<input type="checkbox" bind:checked={chatState.chat.config.allowAnonymousEmbed} />
									<span class="toggle-track"></span>
								</span>
							</label>
						</div>
						<div class="share-description">
							Gjør assistenten tilgjengelig helt uten innlogging via en egen embed-URL, uansett publiseringsstatus under. Listes ikke opp noe sted - kun de med lenken kan bruke den. Samtaler lagres aldri.
						</div>
						{#if chatState.chat.config.allowAnonymousEmbed && publicEmbedUrl}
							<div class="config-item">
								<label for="public-embed-widget-snippet">Widget-kode (anbefalt)</label>
								<div class="share-row">
									<input id="public-embed-widget-snippet" type="text" readonly value={publicWidgetSnippet} />
									<button class="icon-button" onclick={() => navigator.clipboard.writeText(publicWidgetSnippet)} title="Kopier widget-kode">
										<span class="material-symbols-outlined">content_copy</span>
									</button>
								</div>
								<div class="share-description">Lim inn på en ekstern side - gir en ferdig styled, flytende chat-boble nederst til høyre.</div>
							</div>
							<div class="config-item">
								<label for="public-embed-url">Offentlig embed-URL (avansert)</label>
								<div class="share-row">
									<input id="public-embed-url" type="text" readonly value={publicEmbedUrl} />
									<button class="icon-button" onclick={() => navigator.clipboard.writeText(publicEmbedUrl)} title="Kopier offentlig embed-URL">
										<span class="material-symbols-outlined">content_copy</span>
									</button>
								</div>
								<div class="share-description">For manuell &lt;iframe src="..."&gt;-embedding uten widget-boblen (egen styling/plassering).</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Publish options -->
				{#if canPublishChatConfig(chatState.user, chatState.APP_CONFIG.APP_ROLES)}
					<div class="config-section">
						<div class="config-item">
							<label for="publish-status">Publiseringsstatus</label>
							<select id="publish-status" bind:value={chatState.chat.config.type}>
								<option value="private">Privat</option>
								<option value="published">Publisert</option>
							</select>
						</div>
						{#if chatState.chat.config.type === "published"}
							<div class="config-item">
								<label for="access-groups">Tilgang</label>
								<select multiple id="access-groups" bind:value={chatState.chat.config.accessGroups}>
									<option value="all">Alle</option>
									<option value="employee">Ansatte</option>
									<option value="edu_employee">Skole-ansatte</option>
									<option value="student">Elever og skole-ansatte</option>
								</select>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Config type selection -->
				{#if userCanEditPredefinedConfig}
					<div class="config-section">
						<div class="config-item radio-group">
							<label class="radio-label">
								<input type="radio" name="configType" value="manual" onchange={onConfigTypeChange} checked={!chatState.chat.config.vendorAgent} />
								Manuell konfigurasjon
							</label>
							<label class="radio-label">
								<input type="radio" name="configType" value="predefined" onchange={onConfigTypeChange} checked={Boolean(chatState.chat.config.vendorAgent)} />
								Leverandør-konfigurasjon
							</label>
						</div>
					</div>
				{/if}

				<!-- Model / vendor-agent -->
				<div class="config-section">
					{#if !chatState.chat.config.vendorAgent}
						<VendorModelSelector bind:vendorId={chatState.chat.config.vendorId} bind:model={chatState.chat.config.model as string} appConfig={chatState.APP_CONFIG} />
					{:else}
						<div class="config-item">
							<label for="vendor">KI-leverandør</label>
							<select id="vendor" bind:value={chatState.chat.config.vendorId}>
								{#each Object.entries(chatState.APP_CONFIG.VENDORS).filter(([_k, v]) => v.ENABLED) as [id, vendor]}
									<option value={id}>{vendor.NAME}</option>
								{/each}
							</select>
						</div>
					{/if}
					{#if userCanEditPredefinedConfig}
						<div class="config-item">
							<label for="vendor-project">Prosjekt</label>
							<select id="vendor-project" bind:value={chatState.chat.config.project}>
								{#each getAvailableProjects(chatState.chat.config.vendorId) as projectId}
									<option value={projectId}>{projectId}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>

				<!-- Instructions (only for manual config) -->
				{#if !chatState.chat.config.vendorAgent}
					<div class="config-section">
						<div class="config-item">
							<label for="instructions">Instruksjoner til modellen</label>
							<GrowingTextArea id="instructions" style="textarea" initialRows={1} placeholder="Skriv instruksjoner til modellen her..." bind:value={chatState.chat.config.instructions} />
						</div>
					</div>
				{/if}

				<!-- Data sources -->
				{#if userCanUseRagservice}
					<div class="config-section">
						<div class="config-item">
							<label>Datakilder</label>
							{#each chatState.chat.config.dataSources ?? [] as source}
								<div class="source-row">
									<span>{availableStores.find((s) => s.storeId === source.id)?.name ?? source.id}</span>
									<button class="remove-source" onclick={() => removeDataSource(source.id)}>×</button>
								</div>
							{/each}
							<select onchange={(e) => { addDataSource(e.currentTarget.value); e.currentTarget.value = "" }}>
								<option value="">Legg til datakilde...</option>
								{#each availableStores.filter((s) => !(chatState.chat.config.dataSources ?? []).some((d) => d.id === s.storeId)) as store}
									<option value={store.storeId}>{store.name}</option>
								{/each}
							</select>
						</div>
					</div>
				{/if}

				<!-- Vendor agent (only for predefined config) -->
				{#if chatState.chat.config.vendorAgent}
					<div class="config-section">
						<div class="config-item">
							<label for="vendorAgentId">Assistent-id</label>
							<input id="vendorAgentId" placeholder="agent/prompt-id" type="text" bind:value={chatState.chat.config.vendorAgent.id} />
						</div>
					</div>
				{/if}
			{:else if activeTab === "stats"}
				<!-- Categories for write-time question statistics -->
				<div class="config-section">
					<div class="config-item">
						<label for="new-category">Kategorier (for statistikk)</label>
						{#each chatState.chat.config.categories ?? [] as category}
							<div class="source-row">
								<span>{category}</span>
								<button class="remove-source" onclick={() => removeCategory(category)}>×</button>
							</div>
						{/each}
						<div class="share-row">
							<input
								id="new-category"
								type="text"
								placeholder="Legg til kategori..."
								bind:value={newCategoryInput}
								onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory() } }}
							/>
							<button onclick={addCategory}>Legg til</button>
						</div>
						<div class="share-description">
							Hvert spørsmål brukere stiller assistenten kategoriseres automatisk inn i en av disse (eller «Ukategorisert»), og telles anonymt - ingen samtaleinnhold eller brukeridentitet lagres.
						</div>
					</div>
				</div>

				<!-- Only meaningful once the bot is saved and has categories defined -->
				{#if chatState.chat.config._id && (chatState.chat.config.categories?.length ?? 0) > 0}
					<ChatConfigStats chatConfigId={chatState.chat.config._id} categories={chatState.chat.config.categories ?? []} />
				{/if}
			{/if}
		</div>

		<!-- Actions -->
		<div class="config-actions">
			<div class="config-action-item">
				{#if chatState.chat.config._id}
					<button class="filled danger" onclick={chatState.deleteChatConfig}><span class="material-symbols-outlined">delete</span>Slett assistent</button>
				{:else}
					&nbsp;
				{/if}
			</div>
			<div class="config-action-item right">
				{#if chatState.configEdited}
					<button onclick={() => chatState.configMode = false} title="Test endringer i samtalen">
						<span class="material-symbols-rounded">experiment</span>
						Test assistent
					</button>
				{/if}
				<button onclick={() => { chatState.chat.config = JSON.parse(JSON.stringify(chatState.initialConfig)); chatState.configMode = false; }}>Avbryt</button>
				{#if chatState.chat.config._id}
					<button disabled={!chatState.configEdited} class="filled" onclick={chatState.updateChatConfig}><span class="material-symbols-outlined">save</span>Lagre endringer</button>
				{:else}
					<button disabled={!chatState.configEdited} class="filled" onclick={chatState.saveChatConfig}><span class="material-symbols-outlined">save</span>Lagre som ny assistent</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Unsaved changes banner: visible when testing with unsaved edits -->
{#if chatState.configEdited && !chatState.configMode}
	<div class="unsaved-banner" transition:slide={{ duration: 200 }}>
		<span class="material-symbols-rounded">edit_note</span>
		<span>Ulagrede endringer</span>
	</div>
{/if}

<style>
	.chat-config-container {
		max-width: 50rem;
		margin: 0 auto 2rem;
		width: 100%;
		box-sizing: border-box;
		padding: 0 0.5rem;
	}
	.config-tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0 0.5rem;
		border-bottom: 2px solid var(--color-primary-20);
	}
	.config-tab-button {
		border: none;
		background: none;
		height: auto;
		padding: 0.5rem 0.875rem;
		font-size: 0.9rem;
		color: var(--color-primary-80);
		border-radius: 6px 6px 0 0;
	}
	.config-tab-button:hover {
		background-color: var(--color-primary-20);
	}
	.config-tab-button:disabled {
		background-color: var(--color-primary-10);
		color: var(--color-primary);
		font-weight: 600;
		cursor: default;
		box-shadow: inset 0 -2px 0 var(--color-primary);
	}
	.config-section, .config-actions {
		display: flex;
		padding: 1rem 0;
	}
	.config-section {
		column-gap: 0.5rem;
		border-bottom: 1px solid var(--color-primary-30);
		flex-wrap: wrap;
	}
	.config-item {
		display: flex;
		flex: 1;
		flex-direction: column;
	}
	.config-item.radio-group {
		flex-direction: row;
		align-items: center;
		gap: 1rem;
	}
	.config-actions {
		justify-content: space-between;
		gap: 1rem;
	}
	.config-action-item {
		display: flex;
		align-items: center;
	}
	.config-action-item.right {
		flex-shrink: 0;
		gap: 0.5rem;
	}
	.unsaved-banner {
		max-width: 50rem;
		margin: 0 auto 0.75rem;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background-color: var(--color-primary-20);
		border-left: 3px solid var(--color-primary);
		border-radius: 4px;
		font-size: small;
	}
	.share-row button.icon-button:disabled {
		background-color: transparent;
		opacity: 0.3;
	}
	.share-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-size: small;
		color: var(--color-primary);
		padding-bottom: 0;
	}
	.toggle {
		position: relative;
		display: inline-block;
		width: 2.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}
	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}
	.toggle-track {
		position: absolute;
		inset: 0;
		background-color: var(--color-primary-30);
		border-radius: 999px;
		transition: background-color 0.2s;
	}
	.toggle-track::after {
		content: "";
		position: absolute;
		top: 0.2rem;
		left: 0.2rem;
		width: 0.85rem;
		height: 0.85rem;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}
	.toggle input:checked + .toggle-track {
		background-color: var(--color-primary);
	}
	.toggle input:checked + .toggle-track::after {
		transform: translateX(1rem);
	}
	.share-description {
		font-size: smaller;
		color: #888;
		margin-top: 0.25rem;
	}
	.source-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0.25rem 0.25rem 0;
		font-size: small;
	}
	button.remove-source {
		background: none;
		border: none;
		cursor: pointer;
		color: #888;
		font-size: 1rem;
		line-height: 1;
		padding: 0 0.25rem;
	}
	button.remove-source:hover {
		color: #c00;
	}
	label {
		color: var(--color-primary);
		font-size: small;
		display: inline-block;
		padding-bottom: 0.5rem;
	}
	textarea.name-input {
		font: inherit;
		padding: 0.5rem;
		background-color: #f7f7f7;
		border: none;
		resize: none;
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
	}
	select, input[type="text"] {
		width: calc(100% - 0.5rem);
		font-family: var(--font-family);
		font-size: inherit;
		padding: 0.25rem;
	}
	select {
		border: none;
		background-color: inherit;
	}
	select:hover, input[type="radio"]:hover, .radio-label:hover {
		background-color: var(--color-primary-20);
		cursor: pointer;
	}
</style>
