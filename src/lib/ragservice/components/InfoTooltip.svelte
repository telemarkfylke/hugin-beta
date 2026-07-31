<script lang="ts">
	type Props = {
		text: string
	}
	let { text }: Props = $props()
</script>

<span class="info-icon" title={text}>ⓘ</span>

<style>
	span.info-icon {
		display: inline-block;
		margin-left: 2px;
		color: var(--color-primary-70);
		cursor: help;
		font-size: 0.9em;
	}

	span.info-icon:hover {
		color: var(--color-primary);
	}
</style>
