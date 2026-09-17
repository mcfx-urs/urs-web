// Wraps the browser Geolocation callback API in a Promise. No permission-
// gate UI matching android's "Grant" button - the browser's permission
// model has no programmatic re-prompt once denied, so call sites show a
// plain inline error + retry instead.
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}
