<script lang="ts">
	import { page } from "$app/state"
	import { canEditMcpSource } from "$lib/authorization"
	import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte"
	import { McpSourcesApi } from "$lib/mcp-sources/adapters/mcpSourcesApi"
	import type { McpSource } from "$lib/types/mcp-source"
	import "$lib/ragservice/components/ragservice-shared.css"
	import McpSourceForm from "./McpSourceForm.svelte"

	type Props = {
		sources: McpSource[]
	}
	let { sources = $bindable() }: Props = $props()

	const api = new McpSourcesApi()

	let currentUser = $derived(page.data.authenticatedUser)
	let appRoles = $derived(page.data.APP_CONFIG.APP_ROLES)

	function canEdit(source: McpSource): boolean {
		return canEditMcpSource(source, currentUser, appRoles)
	}

	function ownerLabel(source: McpSource): string {
		if (source.createdBy.id === currentUser.userId) return "Deg"
		return source.createdBy.name ?? "Ukjent"
	}

	// null = list view, undefined = creating new, a source = editing that one
	let editing: McpSource | null | undefined = $state(null)

	let deleteTarget: McpSource | null = $state(null)
	let showDeleteConfirm = $state(false)
	let deleteError: string | null = $state(null)

	function serverLabel(source: McpSource): string {
		return source.server === "sharepoint" ? "SharePoint" : source.server
	}

	function scopeLabel(source: McpSource): string {
		if (source.server !== "sharepoint") return ""
		const folderCount = source.folders.length
		const parts: string[] = []
		if (folderCount > 0) parts.push(folderCount === 1 ? "1 mappe" : `${folderCount} mapper`)
		if (source.searchEnabled) parts.push("fritekst-søk")
		return parts.join(", ") || "ingen tilgang"
	}

	async function confirmDelete() {
		if (!deleteTarget) return
		deleteError = null
		const success = await api.deleteSource(deleteTarget._id)
		if (success) {
			sources = sources.filter((s) => s._id !== deleteTarget?._id)
		} else {
			deleteError = "Kunne ikke slette kilden. Prøv igjen."
		}
		deleteTarget = null
	}

	function onFormDone(result: McpSource | null) {
		if (result) {
			const existingIndex = sources.findIndex((s) => s._id === result._id)
			if (existingIndex >= 0) {
				sources[existingIndex] = result
			} else {
				sources.push(result)
			}
		}
		editing = null
	}
</script>

{#if editing !== null}
	<McpSourceForm source={editing ?? null} onDone={onFormDone} />
{:else}
	<div class="list-header">
		<button onclick={() => (editing = undefined)}>
			<span class="material-symbols-outlined">add</span>Lag ny kilde
		</button>
	</div>

	{#if deleteError}
		<p class="delete-error">{deleteError}</p>
	{/if}

	{#if sources.length === 0}
		<p class="rag-muted">Ingen MCP-kilder opprettet ennå.</p>
	{:else}
		<table class="rag-table">
			<thead>
				<tr>
					<th>Navn</th>
					<th>Tjener</th>
					<th>Omfang</th>
					<th>Eier</th>
					<th>Synlighet</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each sources as source}
					<tr>
						<td>{source.name}</td>
						<td>{serverLabel(source)}</td>
						<td>{scopeLabel(source)}</td>
						<td>{ownerLabel(source)}</td>
						<td>{source.type === "published" ? "🌐 Offentlig" : "🔒 Privat"}</td>
						<td class="row-actions">
							{#if canEdit(source)}
								<button class="icon-button" onclick={() => (editing = source)} title="Rediger">
									<span class="material-symbols-outlined">edit</span>
								</button>
								<button
									class="icon-button"
									onclick={() => {
										deleteTarget = source;
										showDeleteConfirm = true;
									}}
									title="Slett"
								>
									<span class="material-symbols-outlined">delete</span>
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<ConfirmDeleteDialog
		bind:show={showDeleteConfirm}
		message={`Er du sikker på at du vil slette "${deleteTarget?.name ?? ""}"?`}
		subtext="Kilden fjernes fra alle assistenter som bruker den."
		onConfirm={confirmDelete}
	/>
{/if}

<style>
	.list-header {
		display: flex;
		margin-bottom: 16px;
	}

	.row-actions {
		display: flex;
		gap: 4px;
		justify-content: flex-end;
	}

	p.delete-error {
		color: var(--color-danger);
		margin-bottom: 16px;
	}
</style>
