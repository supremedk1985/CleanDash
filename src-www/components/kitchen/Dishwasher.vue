<script setup lang="ts">
import { dishwasher } from "../../features/dishwasher";

</script>
<template>
  <!-- Zuerst die Ehrlichkeit: ohne Cloud-Verbindung ist jeder Zustand unten alt -->
  <card v-if="dishwasher && !dishwasher.isVerbunden()">
    <template #title>Geschirrspüler</template>
    <template #content>
      <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
        <i class="mdi mdi-cloud-off-outline" style="font-size: 40px"></i>
        <div>
          <div class="text-xl font-bold">Keine Verbindung zu Home Connect</div>
          <div class="text-sm">
            Die Maschine ist im WLAN, meldet sich aber nicht bei der Cloud. Zuletzt bekannt:
            {{ dishwasher.isRunning() ? 'läuft' : dishwasher.isReady() ? 'bereit' : 'unbekannt' }}.
            Hilft meist: Maschine am Hauptschalter kurz aus- und wieder einschalten.
          </div>
        </div>
      </div>
    </template>
  </card>

  <card v-else-if="dishwasher?.isRunning()">
    <template #title>Geschirrspüler</template>
    <template #content>
      <div class="w-full flex my-3">
        <div class="flex-shrink text-center">
          <div class=" text-6xl">
            <span class="mdi mdi-timer-sand"></span>
          </div>
          <div class="mt-2  text-5xl">{{ dishwasher.getFormattedTimeRemaining() }}</div>
        </div>
        <div class="flex-1"></div>
        <div class="flex-shrink  text-center ">
          <div class=" text-6xl">
            <span class="mdi mdi-clock-time-three-outline"></span>
          </div>
          <div class="mt-2 text-5xl">{{ dishwasher.getFormattedEndTime() }}</div>
        </div>
      </div>
    </template>
    <template #footer>
      <ProgressBar :value="dishwasher.progress"></ProgressBar>
    </template>
  </card>
  <card v-else-if="dishwasher?.isDelayedStart()">
    <template #title>Geschirrspüler</template>
    <template #content>
      <div class="flex items-center">
        <i class="mdi mdi-sun-clock-outline" style="font-size: 44px"></i>
        <div class="ml-4">
          <div class="text-xl font-bold">Start geplant</div>
          <div class="text-sm">wartet auf den Startzeitpunkt</div>
        </div>
      </div>
    </template>
  </card>
  <!-- Der frühere „Smart Start"-Knopf hatte keinen Click-Handler — er sah nur bedienbar
       aus. Ein echtes Starten ginge über das Schreiben von programs.active
       (BSH_Common_Root_ActiveProgram) und gehört erst verdrahtet, wenn klar ist,
       WELCHES Programm der Knopf starten soll. Bis dahin: ehrliche Anzeige. -->
  <card v-else-if="dishwasher?.isReady()">
    <template #title>Geschirrspüler</template>
    <template #content>
      <div class="flex items-center">
        <i class="mdi mdi-check-circle-outline" style="font-size: 44px"></i>
        <div class="ml-4 text-xl font-bold">Bereit</div>
      </div>
    </template>
  </card>
  <card v-else>
    <template #title>Geschirrspüler</template>
    <template #content>
      <div class="flex items-center">
        <i class="mdi mdi-power-plug-off-outline" style="font-size: 30px"></i>
        <span class="ml-3">Aus / kein Status</span>
      </div>
    </template>
  </card>
</template>
