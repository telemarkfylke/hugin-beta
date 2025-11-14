<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../style.css' // Add global css (and make it hot reload)
	import '../lib/axe.js'
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<slot></slot>