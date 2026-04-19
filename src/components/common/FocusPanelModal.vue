<template>
  <teleport to="body">
    <transition name="focus-panel-fade">
      <div v-if="visible" class="focus-panel-modal" @click.self="emit('close')">
        <div class="focus-panel-modal__panel glass-card">
          <header class="focus-panel-modal__header">
            <div>
              <small v-if="eyebrow">{{ eyebrow }}</small>
              <h3>{{ title }}</h3>
              <p v-if="description">{{ description }}</p>
            </div>

            <button class="focus-panel-modal__close" type="button" @click="emit('close')">关闭</button>
          </header>

          <div class="focus-panel-modal__body">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

defineProps<{
  visible: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
.focus-panel-modal {
  position: fixed;
  inset: 0;
  z-index: 58;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(2, 10, 20, 0.7);
  backdrop-filter: blur(16px);
}

.focus-panel-modal__panel {
  width: min(70rem, calc(100vw - 2rem));
  max-height: min(88vh, 56rem);
  padding: 1.25rem;
  border-radius: 1.5rem;
  overflow: auto;
}

.focus-panel-modal__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.focus-panel-modal__header small {
  display: block;
  margin-bottom: 0.375rem;
  color: rgba(220, 239, 255, 0.56);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
}

.focus-panel-modal__header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.focus-panel-modal__header p {
  margin: 0.5rem 0 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.focus-panel-modal__close {
  flex-shrink: 0;
  align-self: flex-start;
  min-height: 2.5rem;
  padding: 0 1rem;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.18);
  background: rgba(7, 18, 35, 0.74);
  color: rgba(230, 247, 255, 0.88);
  cursor: pointer;
}

.focus-panel-modal__body {
  min-height: 18rem;
}

.focus-panel-fade-enter-active,
.focus-panel-fade-leave-active {
  transition: opacity 0.2s ease;
}

.focus-panel-fade-enter-from,
.focus-panel-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .focus-panel-modal {
    padding: 0.625rem;
  }

  .focus-panel-modal__panel {
    width: min(100vw - 1.25rem, 70rem);
    padding: 1rem;
    border-radius: 1.25rem;
  }

  .focus-panel-modal__header {
    flex-direction: column;
  }
}
</style>
