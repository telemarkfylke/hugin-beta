<script lang="ts">
</script>

<div class="typing">
  <div class="dot"></div>
  <div class="dot"></div>
  <div class="dot"></div>
</div>

<style>
  .typing {
    align-items: center;
    display: flex;
    height: 17px;
  }
  .typing .dot {
    animation: TypingAnimation 1.8s infinite ease-in-out;
    background-color: black;
    border-radius: 50%;
    height: 7px;
    margin-right: 4px;
    vertical-align: middle;
    width: 7px;
    display: inline-block;
  }
  .typing .dot:nth-child(1) {
    animation-delay: 200ms;
  }
  .typing .dot:nth-child(2) {
    animation-delay: 300ms;
  }
  .typing .dot:nth-child(3) {
    animation-delay: 400ms;
  }
  .typing .dot:last-child {
    margin-right: 0;
  }

  @keyframes TypingAnimation {
    0% {
      transform: translateY(0px);
    }
    28% {
      transform: translateY(-7px);
    }
    44% {
      transform: translateY(0px);
    }
  }
</style>