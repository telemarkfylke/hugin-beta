<script lang="ts">
	type Props = {
		text: string
	}
	let { text }: Props = $props()

	const tooltipId = $props.id()
</script>

<span class="info-tooltip">
	<!-- type="button" inside a <label> (see NullableRangeField) matters here: per the HTML label
	     spec, clicking a nested form control does NOT forward-activate the label's own control,
	     so this can't accidentally toggle a sibling checkbox the way a plain <span> click would.
	     No onclick - hover or keyboard focus alone show the bubble (:hover / :focus-visible below),
	     matching the standard tooltip pattern rather than a click-to-toggle popover. :focus-visible
	     (not :focus) matters here too: it's the browser's own mouse-vs-keyboard heuristic, so a
	     click still focuses the button without keeping the bubble open - only Tab does. -->
	<button type="button" class="info-icon" aria-describedby={tooltipId}>ⓘ</button>
	<span id={tooltipId} class="info-bubble" role="tooltip">{text}</span>
</span>

<style>
	.info-tooltip {
		position: relative;
		display: inline-flex;
		vertical-align: middle;
	}

	button.info-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: auto;
		margin-left: 2px;
		padding: 0;
		border: none;
		background-color: transparent;
		color: var(--color-primary-70);
		cursor: help;
		font-size: 0.9em;
		line-height: 1;
	}

	button.info-icon:hover,
	button.info-icon:active {
		background-color: transparent;
		color: var(--color-primary);
	}

	button.info-icon:focus-visible {
		color: var(--color-primary);
	}

	.info-bubble {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		width: max-content;
		max-width: 260px;
		background: var(--color-primary);
		color: white;
		font-size: 0.8rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		line-height: 1.4;
		padding: 6px 10px;
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.1s ease;
		pointer-events: none;
	}

	.info-tooltip:hover .info-bubble,
	button.info-icon:focus-visible + .info-bubble {
		opacity: 1;
		visibility: visible;
	}
</style>
