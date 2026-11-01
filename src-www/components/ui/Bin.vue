<script setup lang="ts">
/** The wheelie bin of the bin ticker in a colour, with an optional word on it ("MORGEN"). */
defineProps<{ color: string; label?: string; width: number }>();
</script>

<template>
  <span class="relative inline-block flex-none" :style="{ width: `${width}px` }">
    <svg viewBox="0 0 152 157" class="block w-full" aria-hidden="true">
      <g transform="translate(0,157) scale(0.1,-0.1)" :fill="color">
        <path d="M290 1430 c-22 -21 -30 -37 -28 -55 2 -14 6 -25 11 -25 4 0 183 0 397 0 l390 0 0 23 c-1 26 -15 46 -50 70 -22 15 -60 17 -356 17 l-332 0 -32 -30z" />
        <path d="M186 1307 c-30 -22 -17 -60 24 -73 43 -14 45 -20 60 -264 6 -102 16 -250 21 -330 5 -80 14 -206 19 -280 12 -189 -2 -180 270 -180 114 0 215 3 224 6 11 4 14 13 10 30 -8 30 12 90 44 133 28 38 92 70 139 71 38 0 34 -18 58 290 9 113 20 243 26 290 5 47 9 111 9 142 0 82 9 88 136 88 58 0 114 5 125 10 25 14 25 56 0 70 -31 16 -1142 14 -1165 -3z" />
        <path d="M970 383 c-85 -31 -120 -73 -120 -144 0 -78 70 -149 147 -149 69 0 143 77 143 150 0 59 -46 117 -109 139 -37 12 -39 12 -61 4z m64 -94 c61 -48 6 -138 -68 -109 -51 19 -54 99 -4 120 34 13 43 12 72 -11z" />
      </g>
    </svg>
    <span v-if="label" class="absolute flex items-center justify-center text-white font-extrabold"
      :style="{ inset: '0 22% 18% 0', fontSize: `calc(${width}px / 8.6)`, letterSpacing: '-0.02em' }">{{ label }}</span>
  </span>
</template>
