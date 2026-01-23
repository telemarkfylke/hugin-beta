<script lang="ts">
</script>

<div class="typing">
	<div class="dot"></div>
	<div class="dot"></div>
	<div class="dot"></div>
</div>

<style>
	.typing {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.dot {
		width: 0.4rem;
		height: 0.4rem;
		background-color: currentColor;
		border-radius: var(--radius-full);
		animation: typing-bounce 1.8s infinite ease-in-out;
	}

	.dot:nth-child(1) { animation-delay: 0.2s; }
	.dot:nth-child(2) { animation-delay: 0.3s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes typing-bounce {
		0%, 44%, 100% { transform: translateY(0); }
		28% { transform: translateY(-0.4rem); }
	}
</style>
