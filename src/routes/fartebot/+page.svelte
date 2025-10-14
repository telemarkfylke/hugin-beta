<script>
  let response = '';
  let loading = false;
  let error = '';
  let question = '';

  async function callFartebot() {
    if (!question.trim()) {
      error = 'Please enter a question';
      return;
    }

    loading = true;
    error = '';
    response = '';

    try {
      const res = await fetch('/api/fartebot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: question.trim() })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Request failed');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') return;

            try {
              const event = JSON.parse(dataStr);

              if (event.delta) {
                response += event.delta;
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Network error';
    } finally {
      loading = false;
    }
  }


</script>

<main>
  <h1>Fartebot</h1>
  <p>Ask questions about city bike rentals and transportation</p>

  <section>
    <h2>Ask a Question</h2>

    <div style="margin-bottom: 10px;">
      <label for="question">Your question:</label>
      <input
        id="question"
        type="text"
        bind:value={question}
        placeholder="Enter your question here..."
        style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px;"
        disabled={loading}
      />
    </div>

    <button on:click={callFartebot} disabled={loading || !question.trim()}>
      {loading ? 'Asking...' : 'Ask Fartebot'}
    </button>

    {#if error}
      <div style="color: red; margin-top: 10px;">
        <strong>Error:</strong> {error}
      </div>
    {/if}

    {#if response}
      <div style="margin-top: 10px; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">
        <strong>Response:</strong>
        <pre style="width: 60%; white-space: pre-wrap; word-wrap: break-word;">{response}</pre>
      </div>
    {/if}
  </section>
</main>