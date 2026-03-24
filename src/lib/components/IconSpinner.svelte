<script>
  /**
   * @typedef {Object} Props
   * @property {string} [width]
   */

  /** @type {Props} */
  const { width = '100px' } = $props();
  </script>
  
  <div class="spinnerContainer" style="width: {width}">
    <svg viewBox="0 0 50 50" focusable="false" aria-label="Laster innhold...">
        <title>Laster...</title>
        <circle cx="25" cy="25" r="20"></circle>
        <circle cx="25" cy="25" r="20"></circle>
    </svg> 
  </div>
  
  <style>
    circle {
        fill: transparent;
        stroke-width: 5;
        stroke-linecap: round;
    }
    svg {
        animation: svg-rotate 1.4s linear infinite;
    }
    svg circle:nth-child(2) {
        stroke: #eeeeee;
    }
    svg circle:nth-child(3) {
        animation: circle-rotate 1.4s ease-in-out infinite both;
        stroke-dasharray: 80px,200px;
        stroke-dashoffset: 0;
        stroke: #005260;
    }
    @keyframes svg-rotate {
        to {
            transform: rotate(1turn)
        }
    }
  
    @keyframes circle-rotate {
        0% {
            stroke-dasharray: 1px,200px;
            stroke-dashoffset: 0
        }
  
        50% {
            stroke-dasharray: 100px,200px;
            stroke-dashoffset: -15px
        }
  
        to {
            stroke-dasharray: 100px,200px;
            stroke-dashoffset: -120px
        }
    }
  </style>