export interface Marker {
  id: string
  label: string
  timestamp: number
  timeOffset: number
}

export type PeerMessage =
  | { type: "marker"; label: string; timestamp: number }
  | { type: "ping" }
  | { type: "pong" }
