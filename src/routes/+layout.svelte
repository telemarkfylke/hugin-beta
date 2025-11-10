<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../lib/axe.js'
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<slot></slot>