/**
 * WebSocket message types and interfaces
 */

export type WebSocketMessageType =
  | 'user_joined'
  | 'user_left'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'ice_candidate'
  | 'media_state_update'
  | 'pong'
  | 'error'
  | 'chat_message'
  | 'chat_message_edited'
  | 'chat_message_deleted'
  | 'file_uploaded'
  | 'screen_share_started'
  | 'screen_share_stopped'
  | 'ping'
  | 'sfu_enabled'
  | 'participant_list_request'
  | 'room_info_request'

export interface BaseWsMessage {
  type: WebSocketMessageType
  room_id?: string
  participant_id?: string
  participant_name?: string
  sender?: string
  target?: string
  timestamp?: number | string
  data?: unknown
  message?: string
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export interface WebRTCOfferMessage extends BaseWsMessage {
  type: 'webrtc_offer'
  offer: RTCSessionDescriptionInit
  target: string
}

export interface WebRTCAnswerMessage extends BaseWsMessage {
  type: 'webrtc_answer'
  answer: RTCSessionDescriptionInit
  target: string
}

export interface ICECandidateMessage extends BaseWsMessage {
  type: 'ice_candidate'
  candidate: RTCIceCandidateInit
  target: string
}

export interface MediaStateMessage extends BaseWsMessage {
  type: 'media_state_update'
  data: {
    participant_id: string
    video_enabled: boolean
    audio_enabled: boolean
  }
}

export interface ChatMessageWs extends BaseWsMessage {
  type: 'chat_message'
  message: {
    id: string
    room_id: string
    sender_id: string
    content: string
    message_type: 'text' | 'file' | 'system'
    created_at: string
    attachments?: Array<{
      id: string
      file: string
      original_filename: string
      file_size: number
    }>
  }
}

export interface RecoveryInfo {
  canRecover: boolean
  requiresReconnection: boolean
  error?: Error | unknown
  type?: string
}

