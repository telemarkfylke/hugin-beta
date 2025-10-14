<script>
  let response = '';
  let loading = false;
  let error = '';

  async function testOpenAI() {
    loading = true;
    error = '';
    response = '';

    try {
      const res = await fetch('/api/openai');
      const data = await res.json();

      if (res.ok) {
        response = JSON.stringify(data, null, 2);
      } else {
        error = data.error || 'Request failed';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Network error';
    } finally {
      loading = false;
    }
  }

  async function testMistral() {
    loading = true;
    error = '';
    response = '';

    try {
      const res = await fetch('/api/mistral');
      const data = await res.json();

      if (res.ok) {
        response = JSON.stringify(data, null, 2);
      } else {
        error = data.error || 'Request failed';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Network error';
    } finally {
      loading = false;
    }
  }
</script>

<main>
  <h1>Welcome to SvelteKit</h1>
  <p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

  <section>
    <h2>OpenAI API Test</h2>

    <button on:click={testOpenAI} disabled={loading}>
      {loading ? 'Testing...' : 'Test OpenAI API'}
    </button>

  </section>

  <section>
    <h2>Mistral API Test</h2>

    <button on:click={testMistral} disabled={loading}>
      {loading ? 'Testing...' : 'Test Mistral API'}
    </button>

    {#if error}
      <div style="color: red; margin-top: 10px;">
        <strong>Error:</strong> {error}
      </div>
    {/if}

    {#if response}
      <div style="margin-top: 10px; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">
        <strong>Response:</strong>
        <pre>{response}</pre>
      </div>
    {/if}
  </section>
</main>