<script lang="ts">
	import { FEATURE_ROLE_LABELS, FEATURE_ROLES, FEATURES, type FeatureFlag, type FeatureRole } from "$lib/featureflags/types"
	import type { PageProps } from "./$types"

	let { data }: PageProps = $props()

	let flags: FeatureFlag[] = $state(data.flags.map((flag) => ({ ...flag, roles: { ...flag.roles } })))
	let saving: string | null = $state(null)
	let errorMessage = $state("")

	const formatUpdated = (flag: FeatureFlag): string => {
		if (!flag.updatedAt || !flag.updatedBy) return "Ny - ikke satt av noen ennå"
		return `${flag.updatedBy.name}, ${new Date(flag.updatedAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}`
	}

	// One cell at a time, saved immediately - the whole row is sent so the server never has to guess
	const toggle = async (flag: FeatureFlag, role: FeatureRole) => {
		const previous = { ...flag.roles }
		flag.roles[role] = !flag.roles[role]
		saving = `${flag.feature}:${role}`
		errorMessage = ""
		try {
			const response = await fetch(`/api/feature-flags/${flag.feature}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ roles: flag.roles })
			})
			if (!response.ok) throw new Error(`${response.status}`)
			const updated: FeatureFlag = await response.json()
			flag.updatedAt = updated.updatedAt
			flag.updatedBy = updated.updatedBy
		} catch (error) {
			flag.roles = previous
			errorMessage = `Kunne ikke lagre ${FEATURES[flag.feature].label} (${error instanceof Error ? error.message : "ukjent feil"})`
		} finally {
			saving = null
		}
	}
</script>

<div class="features-page">
	<h1>Tilgangsstyring</h1>
	<p class="intro">
		Hvilke roller som har tilgang til hvilke funksjoner. En bruker får tilgang hvis <em>minst én</em> av rollene sine er krysset av. Admin har alltid tilgang til alt.
		Endringer lagres med en gang og gjelder for alle innen ett minutt.
	</p>

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th scope="col">Funksjon</th>
					{#each FEATURE_ROLES as role (role)}
						<th scope="col" class="role">{FEATURE_ROLE_LABELS[role]}</th>
					{/each}
					<th scope="col" class="role">Admin</th>
					<th scope="col">Sist endret</th>
				</tr>
			</thead>
			<tbody>
				{#each flags as flag (flag.feature)}
					{@const disabledReason = data.environmentDisabled[flag.feature]}
					<tr class:env-disabled={disabledReason}>
						<th scope="row">
							<span class="feature-label">{FEATURES[flag.feature].label}</span>
							<span class="feature-description">{FEATURES[flag.feature].description}</span>
							{#if disabledReason}
								<span class="env-note">Av i dette miljøet: {disabledReason}</span>
							{/if}
						</th>
						{#each FEATURE_ROLES as role (role)}
							<td class="role">
								<input
									type="checkbox"
									checked={flag.roles[role]}
									disabled={saving !== null}
									aria-label={`${FEATURES[flag.feature].label} for ${FEATURE_ROLE_LABELS[role]}`}
									onchange={() => toggle(flag, role)}
								/>
							</td>
						{/each}
						<td class="role"><input type="checkbox" checked disabled aria-label={`${FEATURES[flag.feature].label} for Admin (alltid)`} /></td>
						<td class="updated">{formatUpdated(flag)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.features-page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
	}

	h1 {
		color: var(--color-primary);
		margin-bottom: 0.5rem;
	}

	.intro {
		max-width: 70ch;
		margin-bottom: 1.5rem;
	}

	.error {
		color: var(--color-danger);
		font-weight: 600;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: 100%;
	}

	th,
	td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--color-primary-20);
		text-align: left;
		vertical-align: top;
	}

	thead th {
		color: var(--color-primary);
		font-weight: 600;
		border-bottom: 2px solid var(--color-primary-30);
		white-space: nowrap;
	}

	tbody th {
		font-weight: 400;
	}

	.role {
		text-align: center;
	}

	td.role input {
		width: 1.1rem;
		height: 1.1rem;
		cursor: pointer;
	}

	td.role input:disabled {
		cursor: default;
	}

	.feature-label {
		display: block;
		font-weight: 600;
	}

	.feature-description,
	.env-note {
		display: block;
		font-size: 0.85rem;
		color: var(--color-primary-80);
	}

	.env-note {
		color: var(--color-danger);
	}

	tr.env-disabled td.role {
		opacity: 0.5;
	}

	.updated {
		font-size: 0.85rem;
		color: var(--color-primary-80);
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.features-page {
			padding: 0.75rem;
		}
	}
</style>
