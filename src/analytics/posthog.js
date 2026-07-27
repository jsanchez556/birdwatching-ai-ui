import posthog from 'posthog-js'

const posthogProvider = {
  initialize({ key, host }) {
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      capture_pageleave: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    })
  },

  identify(userId, properties) {
    posthog.identify(userId, properties)
  },

  reset() {
    posthog.reset()
  },

  setTrackingAllowed(allowed) {
    if (allowed) {
      posthog.opt_in_capturing()
      return
    }

    posthog.opt_out_capturing()
  },

  track(event, properties) {
    posthog.capture(event, properties)
  },
}

export default posthogProvider
