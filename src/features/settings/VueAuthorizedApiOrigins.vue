<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listAuthorizedApiOrigins, revokeApiOrigin, type AuthorizedApiOrigin } from '@/services/externalHttp'
import { toast } from '@/services/toast'

const { t } = useI18n()
const origins = ref<AuthorizedApiOrigin[]>([]), loading = ref(true)
async function refresh(): Promise<void> { loading.value = true; try { origins.value = await listAuthorizedApiOrigins() } catch (error) { toast.error(error instanceof Error ? error.message : t('apiOrigins.loadFailed')) } finally { loading.value = false } }
async function revoke(origin: string): Promise<void> { try { await revokeApiOrigin(origin); origins.value = origins.value.filter((item) => item.origin !== origin); toast.success(t('apiOrigins.revoked')) } catch (error) { toast.error(error instanceof Error ? error.message : t('apiOrigins.revokeFailed')) } }
onMounted(() => { void refresh() })
</script>

<template>
  <section class="gm-vue-api-origins"><h3>{{ t('apiOrigins.title') }}</h3><p v-if="loading" class="gm-vue-settings-notice">{{ t('apiOrigins.loading') }}</p><p v-else-if="!origins.length" class="gm-vue-settings-notice">{{ t('apiOrigins.empty') }}</p><div v-else class="gm-vue-api-origins__list"><div v-for="item in origins" :key="item.origin"><span><b>{{ item.origin }}</b><small>{{ item.persistence === 'permanent' ? t('apiOrigins.permanent') : t('apiOrigins.once') }}</small></span><button type="button" class="gm-vue-settings-danger" @click="revoke(item.origin)">{{ t('apiOrigins.revoke') }}</button></div></div></section>
</template>

<style scoped>
.gm-vue-api-origins { display: grid; gap: 8px; }.gm-vue-api-origins h3 { margin-top: 15px; }.gm-vue-api-origins__list { display: grid; gap: 6px; }.gm-vue-api-origins__list > div { display: flex; padding: 8px 10px; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: var(--gm-surface-elevated); }.gm-vue-api-origins__list span { display: grid; min-width: 0; gap: 3px; }.gm-vue-api-origins__list b { overflow-wrap: anywhere; color: var(--gm-text); font-size: var(--gm-text-sm); }.gm-vue-api-origins__list small { color: var(--gm-text-tertiary); font-size: var(--gm-text-xs); }.gm-vue-api-origins__list button { padding: 4px 7px; border: 0; background: transparent; }
</style>
