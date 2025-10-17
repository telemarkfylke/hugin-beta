<!--
  OrgBotter - AI-assistent basert på OpenAI ChatKit
  Denne siden viser en fullverdig chatbot-komponent for generell AI-assistanse
-->
<script>
  import Orgbott from "$lib/components/Orgbott.svelte";

  let isOpen = $state(true);

  function openBot() {
    isOpen = true;
    window.parent.postMessage(
      { type: "setChatbotFrameSize", height: 700, width: 300 },
      "*",
    );
  }

  function closeBot() {
    isOpen = false;
    window.parent.postMessage(
      { type: "setChatbotFrameSize", height: 100, width: 50 },
      "*",
    );
  }
</script>

<div>
  {#if isOpen}
    <div class="wrapper">
      <div style="display:inline-flex" class="topbar">
        <span class="bigemoji">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-white"
          >
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            />
          </svg>
        </span>

        <div class="assistant_header">
          <span class="assistant_header_text"> KI -assistent</span>
        </div>
        <button
          class="bot_controller close"
          onclick={() => closeBot()}
          title="Minimize chat"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg></button
        >
      </div>
      <Orgbott />
    </div>
  {:else}
    <button
      class="closedbutton absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-15 h-15 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 pointer-events-auto z-50"
      onclick={openBot}
      aria-label="Expand chat"
      title="Expand chat"
    >
      <div class="flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-white"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          />
        </svg>
      </div>
    </button>
  {/if}
</div>

<style>
  .topbar {
    
    background-color: rgb(255, 255, 255);
    /*width: 285px; */
    /*
    border-radius: 2px; 
    padding: 7px 2px 4px 5px; */
  }

  .wrapper {
    vertical-align: bottom;
     /* width:250px; 
     height: 700px; */
  }

  .assistant_header {
    width: 240px !important;
    vertical-align: top;
  }

  .assistant_header_text {
    text-align: center;
    display: inline-block;
    font-weight: bold;
    width: 240px;
    font-family: Arial, Helvetica, sans-serif;
  }

  button.close {
    align-self: right;
  }

  span.bigemoji {
    padding-left: 5px;
  }

  button.bot_controller {
    border: 0px;
    background-color: transparent;
  }

  button.closedbutton {
    border-width: 1px;
    border-radius: 5px;
    padding-top: 4px;
  }
</style>
