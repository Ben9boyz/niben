import type { Component } from 'vue'

// what every route carries: the page component of the plain version and the title
declare module 'vue-router' {
  interface RouteMeta {
    page?: Component
    title?: string
  }
}
