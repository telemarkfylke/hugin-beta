<script lang="ts">
	import { page } from "$app/state"
	import { canEditWebsiteSource } from "$lib/authorization"
	import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte"
	import type { WebsiteSource } from "$lib/types/website-source"
	import { WebsiteSourcesApi } from "$lib/website-sources/adapters/websiteSourcesApi"
	import "$lib/ragservice/components/ragservice-shared.css"
	import WebsiteSourceForm from "./WebsiteSourceForm.svelte"

	type Props = {
		sources: WebsiteSource[]
	}
	let { sources = $bindable() }: Props = $props()

	const api = new WebsiteSourcesApi()

	let currentUser = $derived(page.data.authenticatedUser)
	let appRoles = $derived(page.data.APP_CONFIG.APP_ROLES)

	function canEdit(source: WebsiteSource): boolean {
		return canEditWebsiteSource(source, currentUser, appRoles)
	}

	function ownerLabel(source: WebsiteSource): string {
		if (source.createdBy.id === currentUser.userId) return "Deg"
		return source.createdBy.name ?? "Ukjent"
	}

	// null = list view, undefined = creating new, a source = editing that one
	let editing: WebsiteSource | null | undefined = $state(null)

	let deleteTarget: WebsiteSource | null = $state(null)
	let showDeleteConfirm = $state(false)
	let deleteError: string | null = $state(null)

	function entryLabel(source: WebsiteSource): string {
		const count = source.entries.length
		return count === 1 ? "1 URL" : `${count} URL-er`
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

	function onFormDone(result: WebsiteSource | null) {
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
	<WebsiteSourceForm source={editing ?? null} onDone={onFormDone} />
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
		<p class="rag-muted">Ingen nettside-kilder opprettet ennå.</p>
	{:else}
		<table class="rag-table">
			<thead>
				<tr>
					<th>Navn</th>
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
						<td>{entryLabel(source)}</td>
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
