<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../style.css' // Add global css (and make it hot reload)
	import '../lib/axe.js'

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>


<header>
	<h1>Hugin Beta</h1>
	<menu>
		<li><a class="menu_links" href="/">Home</a></li>
		<li><a class="menu_links" href="/agents">Agents</a></li>
	</menu>
</header>

<main>
	{#if children}
		{@render children()}
	{:else}
		<p>fallback content</p>
	{/if}
</main>



<style>
	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		font-family: Arial, Helvetica, sans-serif;
	}


	:global(html) {
		background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAAA/CAYAAABKIS5EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHMSURBVHhe7dvLjqMwEIXh0y2S939S5EAwN1M1i4SeHi9adYw0i5nzLbFQnN8oixL5GIbBIWGf9QX5mYKRwsGmacI8z/XlEHfHOI4opdRLIcdxYBxHuLf9eszzjGma6ssh5963bQOYYFe1flm8771y/1XfP/tDP/qcv/aE/SsUjKRgJAUjKRhJwUgKRlIwkoKRFIykYCQFIykYKRTM3fF4PDCOY70U4u7o+x77vtdLIaUU9H3fPOJ5Pp9IKTXdf+59WRaAGe+cw7+u6+qlkG3b0HUdPj9DZ/QHM0MpBff7vV4KKaXA3XG73eqlkO97DweTF/64/3MKRlIwkoKRFIykYCQFIykYScFICkZSMJKCkcLBzAxmVl8OM7Om8QreI5arn331/nPvoWDnO1Kt71iZGVJKze+HlVKQUmr+0jlnDMPQdGDujpQS1nUFmHmYvISeMPlNwUgKRlIwkoKRFIykYCQFIykYScFICkZSMJKCkcLBlmX5GnGw3B05ZxzHUS+FmBlyzk3jGQBY1/XSXxdzzl+jqXCwbdua3+/Ce9Ot8ywzaz4svOdp+75fCn4etuZhpPATJi8KRlIwkoKRFIykYCQFIykYScFICkb6BTA8Gc4GWfA4AAAAAElFTkSuQmCC');
		background-color: #fafafa;
		background-image: 
		radial-gradient(circle,  #80A8AF 0.3px, transparent 1px),
        radial-gradient(circle,  #B2CBCF 0.3px, transparent 1px);
        background-size: 32px 32px;
        background-position: 0 0, 16px 16px;
		height: 100%;
		max-height: 100%;
}
	
	
	header {
		display: flex;
		align-items: center;
		position: relative;
		justify-content: center;
		color: #333;
		height: 45px;

		
	}
	
	h1 {
		margin: 0;
	}
	
	
	.menu_links {
		color: #333;
	}
	menu {
		display: flex;
		gap: 1rem;
		list-style-type: none;
		align-items: center;
		position: absolute;
		right: 1rem;

	}
	main {
		box-sizing: border-box;
		min-height: calc(100vh - 45px); /* Trekk fra header høyde */
		max-height: calc(100vh - 45px);
		width: 1200px;
		margin-left: auto;
		margin-right: auto;
		display: block;
		overflow: hidden;
	}
</style>