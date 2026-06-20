<template>
  <div class="app-load-progress column items-center justify-center">
    <div class="app-load-progress__panel column items-center">
      <img
        src="icons/co21-logo.png"
        alt="CO21"
        class="app-load-progress__logo"
      />

      <div class="app-load-progress__phase text-body1">
        {{ loadCurrentPhaseLabel }}
      </div>

      <div class="app-load-progress__bar-wrap">
        <div
          class="app-load-progress__bar-fill"
          :style="{ width: `${loadProgressPercent}%` }"
        />
      </div>

      <div class="app-load-progress__meta row items-center justify-between full-width">
        <span v-if="loadHasPreviousTimings" class="text-caption">
          {{ progressHint }}
        </span>
        <span v-else class="text-caption app-load-progress__first-run">
          {{ $text('load.first_run_hint') }}
        </span>
        <span v-if="loadHasPreviousTimings" class="text-caption text-weight-medium">
          {{ loadProgressPercent }}%
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import {
  loadCurrentPhaseLabel,
  loadHasPreviousTimings,
  loadProgressPercent,
} from 'src/composables/appLoadProgress';

const progressHint = computed(() =>
  $text('load.progress_hint').replace('{percent}', String(loadProgressPercent.value)),
);
</script>

<style scoped lang="scss">
.app-load-progress {
  position: fixed;
  inset: 0;
  z-index: 7000;
  background: var(--q-dark-page, #121212);
  padding: 24px;
}

.app-load-progress__panel {
  width: min(420px, 100%);
  gap: 16px;
}

.app-load-progress__logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
  opacity: 0.95;
}

.app-load-progress__phase {
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
  min-height: 1.5em;
}

.app-load-progress__bar-wrap {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.app-load-progress__bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--q-primary, #1976d2);
  transition: width 120ms linear;
}

.app-load-progress__meta {
  color: rgba(255, 255, 255, 0.65);
  gap: 12px;
}

.app-load-progress__first-run {
  text-align: center;
  width: 100%;
  line-height: 1.4;
}
</style>
