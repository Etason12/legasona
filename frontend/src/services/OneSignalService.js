import OneSignal from '@onesignal/capacitor-plugin'
import api from './api'

let initialized = false

export const initOneSignal = async () => {
  if (initialized) return
  try {
    const res = await api.get('/onesignal-config')
    const { app_id } = res.data
    if (!app_id) {
      console.warn('OneSignal: no app ID configured')
      return
    }
    await OneSignal.initialize({ appId: app_id })
    await OneSignal.Notifications.requestPermission(false)
    initialized = true
  } catch (err) {
    console.error('OneSignal init failed', err)
  }
}
