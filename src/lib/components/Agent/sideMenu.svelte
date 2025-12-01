<script lang="ts">
  import type { DBAgent } from "$lib/types/agents";

  
  type Props = {
    agents?: DBAgent[];
    menuOpen?: boolean;
  };
  
  let { agents = [], menuOpen = $bindable(true) }: Props = $props();
</script>
<button class="toggle-btn" title="Skjul meny/Vis meny" onclick={() => menuOpen = !menuOpen}>☰</button>
<img class="TFK-logo" src="/images/t_logo_01_midtstilt_rgb.png" alt="">
    <div class="left-menu" class:hidden={!menuOpen}>
      <h2>Agents</h2>
      {#if agents.length === 0}
        <p>No agents found. Go play with yourself (or create a new agent)</p>
      {/if}
      {#each agents as agent}
        <div>
          <a href="/agents/{agent._id}">{agent.name}</a>
        </div>
      {/each}
      <div>
      </div>
    </div>

<style>
  h2{
    margin-top: 80px;
  }
  	.TFK-logo {
		max-height: 60px;
    margin-top: 20px;
		max-width: 200px;
    margin-left: 130px;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 20;
    font-size: 18px;
		object-fit: contain;
	}
  .left-menu {
  position: absolute;
  left: 0;
  top: 0;
  width: 220px;
  height: 100%;
  border-radius: 5px;
  flex-shrink: 0;
  z-index: 10;
  background-color:#D2E2E2;
  box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
  color: #333;
  transition: left 0.3s;
}
.left-menu.hidden {
  left: -260px;
}
.left-menu a {
  display: block;
  color: #333;
  text-decoration: none;
  padding: 0.3rem 0.5rem;
  width: calc(100% - 1rem);
  border-radius: 5px;
  margin-bottom: 0.2rem;
  transition: background 0.2s, color 0.2s;
}
.left-menu a:hover {
  background: #CCDCDF;
  border-color: #666;
}
.toggle-btn {
  position: absolute;
  top: 20px;
  left: 10px;
  z-index: 20;
  font-size: 18px;
  justify-content: center;
  display: flex;
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  background-color: #E7F2F3;
  box-shadow: 0 2px 4px rgba(44, 44, 44, 0.25);
  transition: background 0.2s, color 0.2s;
}
.toggle-btn:hover {
    background: #CCDCDF;
    border-color: #666;
}

h2 {
  justify-content: center;
  display: flex;
  }
</style>