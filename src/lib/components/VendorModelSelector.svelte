<script lang="ts">
	import type { AppConfig } from "$lib/types/app-config"
	import type { VendorId } from "$lib/types/chat"

	type Props = {
		vendorId: VendorId
		model: string
		appConfig: AppConfig
	}

	let { vendorId = $bindable(), model = $bindable(), appConfig }: Props = $props()

	const getVendors = () => {
		return Object.entries(appConfig.VENDORS)
			.filter(([_key, vendor]) => vendor.ENABLED)
			.map(([key, vendor]) => ({
				id: key as VendorId,
				name: vendor.NAME
			}))
	}

	const getAvailableModels = (vid: VendorId) => {
		return appConfig.VENDORS[vid].MODELS.map((m) => m.ID)
	}

	$effect(() => {
		const availableModels = getAvailableModels(vendorId)
		if (!availableModels.includes(model)) {
			model = availableModels[0] ?? ""
		}
	})
</script>

<div class="vendor-model-selector">
	<div class="selector-item">
		<label for="vms-vendor">KI-leverandør</label>
		<select id="vms-vendor" bind:value={vendorId}>
			{#each getVendors() as vendor}
				<option value={vendor.id}>{vendor.name}</option>
			{/each}
		</select>
	</div>
	<div class="selector-item">
		<label for="vms-model">Modell</label>
		<select id="vms-model" bind:value={model}>
			{#each getAvailableModels(vendorId) as modelId}
				<option value={modelId}>{modelId}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.vendor-model-selector {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.selector-item {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	label {
		color: var(--color-primary);
		font-size: small;
		padding-bottom: 0.5rem;
	}
	select {
		font-family: var(--font-family);
		font-size: inherit;
		padding: 0.25rem;
		border: none;
		background-color: inherit;
		width: calc(100% - 0.5rem);
	}
	select:hover {
		background-color: var(--color-primary-20);
		cursor: pointer;
	}
</style>
