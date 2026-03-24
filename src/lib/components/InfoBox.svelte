<script>
    
    /**
     * @typedef {Object} Props
     * @property {any} title - Props
     * @property {boolean} [open]
     * @property {import('svelte').Snippet} [children]
     */

    /** @type {Props} */
    /* eslint-disable-next-line prefer-const */
    let { title, open = $bindable(false), children } = $props();

</script>

<div class="infoBox">
    <button class="title" onclick={() => { open = !open }}><span class="material-symbols-outlined">{open ? 'keyboard_arrow_down' : 'chevron_right'}</span><strong>{title}</strong></button>
    {#if open}
        <div class="content">
            {@render children?.()}
        </div>
    {/if}
</div>

<style>
    .infoBox {
        background-color: var(--vann-10);
        margin-bottom: 1rem;
    }
    .title {
        border: 0px;
        border-radius: 0px;
        padding: 5px;
        width: 100%;
        display: flex;
        align-items: center;
        background-color: var(--vann-20);
    }
    .title:hover {
        cursor: pointer;
        background-color: var(--vann-40);
    }
    .content {
        padding: 40px;
    }


    @media only screen and (max-width: 768px) {
        /* For mobile phones: */
        .title {
            width: 100%;
        }
    }  
</style>