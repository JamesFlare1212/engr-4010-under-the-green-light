<script lang="ts">let { compact = false }: { compact?: boolean } = $props();</script>
<svg class:compact class="seascape" viewBox="0 0 920 560" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x2="0" y2="560" gradientUnits="userSpaceOnUse"><stop stop-color="#123c49"/><stop offset="1" stop-color="#2e626a"/></linearGradient>
    <linearGradient id="ocean" x2="0" y2="230" gradientUnits="userSpaceOnUse"><stop stop-color="#487a7d"/><stop offset="1" stop-color="#173f4d"/></linearGradient>
    <radialGradient id="lamp"><stop stop-color="#bce5ae" stop-opacity=".7"/><stop offset="1" stop-color="#bce5ae" stop-opacity="0"/></radialGradient>
    <pattern id="rain" width="84" height="86" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M8 0v20M50 40v12" stroke="#cee0df" stroke-opacity=".12"/></pattern>
  </defs>
  <rect width="920" height="560" fill="url(#sky)"/>
  <circle cx="714" cy="99" r="39" fill="#bfd2c2" opacity=".8"/>
  <path d="M590 91c63-22 133-22 215 0M658 116c57-15 126-9 190 7" stroke="#214b56" stroke-width="15" stroke-linecap="round"/>
  <path d="M0 243 75 218 132 231 207 209 265 246 351 232 431 256 520 242 641 267 739 249 920 276V560H0Z" fill="#365c65"/>
  <path d="M0 325c125-44 212 31 326 0s191 23 298 2 211 9 296-16v249H0Z" fill="url(#ocean)"/>
  <path d="M0 253 103 233 165 271 222 285 243 352 281 389 270 480 309 560H0Z" fill="#17343f"/>
  <path d="m102 235 41 61 30 73 47 40-15 73 35 78" stroke="#688389" opacity=".4"/>
  <path d="M39 267c0-66 48-105 108-105s110 39 110 105Z" fill="#adc0b5"/>
  <path d="M55 266c0-51 40-88 92-88s94 37 94 88M92 266c0-40 22-88 55-88s55 48 55 88M148 177v89" stroke="#536d6d" stroke-width="3"/>
  <path d="M31 267h231v17H31z" fill="#c6cbb6"/>
  <path d="M95 243h105v26H95z" fill="#314f54"/>
  <path d="M106 248h16m11 0h16m11 0h16m11 0h9" stroke="#bcdbc5" stroke-width="4"/>
  <path d="M154 284v27l260 62" stroke="#bac8bf" stroke-width="2"/>
  <path d="m265 325 88 8 49 36" stroke="#b0c2b7" stroke-width="2" stroke-dasharray="4 5"/>
  <path d="m374 355 84-24 80 19-1 100-163-28Z" fill="#23434a"/>
  <path d="m374 355 80-17v89l-80-5Z" fill="#84998d"/>
  <path d="m454 338 84 12v100l-84-23Z" fill="#586f6b"/>
  <path d="m365 352 91-27 93 23-11 10-84-14-80 21Z" fill="#b9bd9f"/>
  <path d="m394 375 22-5v20l-22 4Z" fill="#233d43"/>
  <path d="m470 370 17 2v22l-17-3Z" fill="#173f48"/>
  <path d="m501 374 17 2v22l-17-2Z" fill="#173f48"/>
  <path d="M456 324v-24" stroke="#c7c3a2" stroke-width="3"/>
  <circle cx="456" cy="296" r="48" fill="url(#lamp)"/><circle cx="456" cy="296" r="6" fill="#b5e5a7"/>
  <path d="M0 445c94-26 152 29 257 1s169-24 259-2 171 19 266-6 115-9 138-6v128H0Z" fill="#285663"/>
  <path d="M260 450c74-18 144-28 217-9M547 470c91 16 144 8 194-3M660 383c45 10 84 10 119-1M295 510c95-21 181-14 255 4M74 492c36 8 73 9 98 1M744 536c53-13 101-9 146 0" stroke="#8eb5ad" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
  <path d="m640 433 49 4-9 12-32-3Z" fill="#c3bba1"/><path d="m653 433 2-13 23 2 1 14" fill="#4d6c6c"/>
  <path d="M474 146q12-14 23 0 11-13 23-1M557 190q9-10 17 0 8-10 17-1" stroke="#b8cec3" stroke-width="2" stroke-linecap="round"/>
  <rect width="920" height="560" fill="url(#rain)"/>
  <g fill="#b7d1ca" font-size="12" font-family="sans-serif"><text x="38" y="139">The Shell</text><text x="549" y="321">Coastal pump station</text><text x="723" y="496">Luminis Sea</text></g>
</svg>
