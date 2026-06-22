<script lang="ts">
	import { page } from "$app/state";
	import type { StoreConfig } from "$lib/ragservice/types";

	type Props = {
		stores: StoreConfig[],
		onStoreClick: (storeId: string) => void
	};
	let { stores = $bindable(), onStoreClick = $bindable() }: Props = $props();
</script>

<ul>
	{#each stores as store}
		<li class:active={page.url.pathname === "/stores/" + store.storeId}>
			<button type="button" onclick={() => onStoreClick(store.storeId)}>
				<span class="name">{store.name}</span>
				<span class="meta">{store.description} · {store.createdBy.name}</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 400px;
		overflow-y: auto;
	}

	li {
		border-bottom: 1px solid #e0e0e0;
	}

	li button {
		width: 100%;
		padding: 10px 12px 14px 12px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
		font-family: inherit;
		color: inherit;
	}

	li button:hover {
		background-color: #f5f5f5;
	}

	li.active button {
		background-color: #e8e8e8;
	}

	.name {
		font-size: 0.95rem;
		font-weight: normal;
		color: #1a1a1a;
	}

	li.active .name {
		font-weight: 600;
	}

	.meta {
		font-size: 0.8rem;
		color: #666;
		font-weight: normal;
	}
</style>
