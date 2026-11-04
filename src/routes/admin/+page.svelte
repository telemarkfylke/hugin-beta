<script lang="ts">
	import type { PageProps } from "./$types"

	// Get layout props, data will be accessible for children as well, so do not put too much here to avoid overfetching
	let { data }: PageProps = $props()
</script>
<p><a href="/admin/features">Tilgangsstyring</a> - hvilke roller som har tilgang til hvilke funksjoner</p>
  <div id="user-debug-for-now">
	<h3>User claims for debugging (and actually knowing what they are...)</h3>
	<pre>{JSON.stringify(data, null, 2)}</pre>
</div>