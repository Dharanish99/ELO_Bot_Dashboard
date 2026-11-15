/**
 * ELO Pi V2 WebSocket Protocol Types
 * Source of truth: V2 wire contract (ELO_APP_HANDOFF.md + prompt spec)
 */

export interface V2BBox {
  x: number;      // normalized [0,1] left edge
  y: number;      // normalized [0,1] top edge
  width: number;  // normalized [0,1]
  height: number; // normalized [0,1]
}

export interface V2Target {
  track_id: string;
  bbox: V2BBox;
  timestamp: number;           // Unix seconds (same frame source)
  confidence: number;
  identity_confidence?: number;
  range_m?: number | null;     // null = unknown; never display as 0
  range_confidence?: number;
  label?: string;              // e.g. "Person 3"
}

export interface V2RobotInfo {
  mode: 'moving' | 'interacting' | 'stopped' | 'unknown';
  safety_locked?: boolean;
  state_reason?: string;
}

export interface V2Selection {
  target_id: string | null;
  confirmed_at?: number;
}

export interface V2Motion {
  enabled: boolean;
  reason?: string;             // Pi reason for disabled motion (shown to user)
}

export interface V2CameraPreview {
  frame_timestamp: number;     // Unix seconds
  width?: number;
  height?: number;
  available?: boolean;
}

export interface V2Capabilities {
  vision?: { active: boolean };
}

export interface V2Diagnostics {
  ai_connected?: boolean;
  audio_ready?: boolean;
  obstacle?: boolean;
  obstacle_detail?: string;
}

/** Full V2 state message from Pi WebSocket */
export interface V2StateMessage {
  type: 'state';
  schema_version: 2;
  robot: V2RobotInfo;
  targets: V2Target[];
  selection: V2Selection;
  obstacles?: { detected: boolean; detail?: string };
  camera_preview?: V2CameraPreview;
  motion: V2Motion;
  capabilities?: V2Capabilities;
  diagnostics?: V2Diagnostics;
  /** Base64-encoded JPEG of camera frame — present when preview_subscription enabled */
  preview_jpeg_b64?: string;
}

export interface V2CommandResult {
  type: 'command_result';
  success: boolean;
  error?: string;
  reason?: string;
  command?: string;
}

export type V2InboundMessage = V2StateMessage | V2CommandResult | { type: string };

/** Commands sent to Pi via WebSocket */
export interface V2SelectTargetCommand {
  type: 'select_target';
  x: number;              // normalized image x [0,1]
  y: number;              // normalized image y [0,1]
  frame_timestamp: number; // exact timestamp from displayed frame
  tolerance?: number;     // default 0.04
}

export interface V2FollowCommand { type: 'follow' }
export interface V2StopCommand   { type: 'stop' }
export interface V2InteractCommand { type: 'interact' }
export interface V2EndInteractCommand { type: 'end_interaction' }
export interface V2CapabilityCommand {
  type: 'capability';
  name: 'vision';
  action: 'acquire' | 'release';
}
export interface V2PreviewSubscriptionCommand {
  type: 'preview_subscription';
  enabled: boolean;
}

export type V2OutboundCommand =
  | V2SelectTargetCommand
  | V2FollowCommand
  | V2StopCommand
  | V2InteractCommand
  | V2EndInteractCommand
  | V2CapabilityCommand
  | V2PreviewSubscriptionCommand;

/**
 * A correlated snapshot: frame JPEG + targets from the same Pi observation.
 * Never mix images and boxes from different timestamps.
 */
export interface DisplayedFrame {
  frameTimestamp: number;      // Unix seconds from camera_preview.frame_timestamp
  jpegUri: string;             // data:image/jpeg;base64,...
  targets: V2Target[];
  capturedAt: number;          // Date.now() when we stored this
}
